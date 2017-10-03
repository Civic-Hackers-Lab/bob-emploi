# encoding: utf-8
"""Script to send a mailing to compute the Net Promoter Score.

We send it to users that signed up more than N days ago (N to be set as a
commandline flag) but we send it only once.

Usage:

docker-compose run --rm \
    -e MONGO_URL ... \
    frontend-flask python bob_emploi/frontend/asynchronous/mail_nps.py 2
"""
import datetime
import logging
import os
import signal
import sys
from urllib import parse

import pymongo

from google.protobuf import json_format

from bob_emploi.frontend import mail
from bob_emploi.frontend.api import user_pb2
from bob_emploi.frontend.asynchronous import report

_DB = pymongo.MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost/test'))\
    .get_default_database()

# The base URL to use as the prefix of all links to the website. E.g. in dev,
# you should use http://localhost:3000.
_BASE_URL = os.getenv('BASE_URL', 'https://www.bob-emploi.fr')

# For a dry run we do not send emails to users nor modify the database.
DRY_RUN = not bool(os.getenv('NODRY_RUN'))
if DRY_RUN:
    logging.getLogger().setLevel(logging.INFO)

# ID of the email template in MailJet. See
# https://app.mailjet.com/template/100819/build
_MAILJET_TEMPLATE_ID = '100819'

# ID of the email template in MailJet to report the final count of the blast. See
# https://app.mailjet.com/tempate/74071/build
_MAILJET_REPORT_TEMPLATE_ID = '74071'

# Hour of the day (considered in UTC) at which we decide it is a new day: we
# only send NPS email on the next day.
_DAY_CUT_UTC_HOUR = 1


def send_email_to_user(user, base_url, now):
    """Sends an email to the user to measure the Net Promoter Score."""
    # Renew actions for the day if needed.
    mail_result = mail.send_template(
        _MAILJET_TEMPLATE_ID,
        user.profile,
        {
            'baseUrl': base_url,
            'firstName': user.profile.name,
            'emailInUrl': parse.quote(user.profile.email),
            'dateInUrl': parse.quote(now.strftime('%Y-%m-%d')),
        },
        dry_run=DRY_RUN,
    )
    mail_result.raise_for_status()
    return True


def _break_on_signal(signums, iterator):
    """Wrapper for an iterator to stop iterating when kernal signal is received.

    Args:
        signums: a list of signal numbers to break on.
        iterator: the iterator to wrap.
    Yields:
        the item of the iterator as long as no signal has been caught.
    """
    signals = []

    def _record_signal(signum, unused_frame):
        # TODO(pascal): Update the report email to write that the blast was
        # interrupted.
        signals.append(signum)

    for signum in signums:
        signal.signal(signum, _record_signal)
    for item in iterator:
        yield item
        if signals:
            break


def _send_reports(count, errors):
    logging.warning('%d emails sent.', count)

    report.notify_slack(
        "Report for NPS blast: I've sent {:d} emails (with {:d} errors).".format(
            count, len(errors)))
    report.send_to_admins('NPS', count, errors)


def main(user_db, base_url, now, days_before_sending):
    """Send an email to users that signed up more than n days ago list of users."""
    query = {
        'featuresEnabled.netPromoterScoreEmail': 'NPS_EMAIL_PENDING',
        'projects': {'$exists': True},
        'projects.isIncomplete': {'$ne': True},
    }
    count = 0
    user_iterator = user_db.find(
        query,
        {
            '_id': 1,
            'registeredAt': 1,
            'featuresEnabled.netPromoterScoreEmail': 1,
            'profile.email': 1,
            'profile.lastName': 1,
            'profile.name': 1,
        })
    errors = []
    registered_before = (now - datetime.timedelta(days=int(days_before_sending)))\
        .replace(hour=_DAY_CUT_UTC_HOUR, minute=0, second=0, microsecond=0)
    for user_in_db in _break_on_signal([signal.SIGTERM], user_iterator):
        user = user_pb2.User()
        user_id = user_in_db.pop('_id')
        json_format.ParseDict(user_in_db, user)
        if user.features_enabled.net_promoter_score_email != user_pb2.NPS_EMAIL_PENDING:
            # Skip silently: NPS was sent already.
            continue

        if user.registered_at.ToDatetime() > registered_before:
            # Skip silently: will send another day.
            continue

        try:
            result = send_email_to_user(user, base_url, now)
        except (IOError, json_format.ParseError) as err:
            errors.append('{} - {}'.foramt(err, user_id))
            logging.error(err)
            continue

        if not result:
            continue

        if not DRY_RUN:
            user_db.update_one(
                {'_id': user_id},
                {'$set': {'featuresEnabled.netPromoterScoreEmail': 'NPS_EMAIL_SENT'}})

        count += 1

    _send_reports(count, errors)


if __name__ == '__main__':
    _DAYS_BEFORE_SENDING, = sys.argv[1:]  # pylint: disable=unbalanced-tuple-unpacking
    main(_DB.user, _BASE_URL, datetime.datetime.utcnow(), _DAYS_BEFORE_SENDING)
