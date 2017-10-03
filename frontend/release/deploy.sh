#!/bin/bash

# Script to deploy a Bob Emploi release, both server and client.
#
# The canonical place for our releases are the Docker Images in Docker Hub.
# They are generated by CircleCI in an untainted way.
#
# The server gets released by creating a new deployment on Amazon Web Service's
# (AWS) ECS (EC2 Container Service), and waiting for new containers to be
# spawned and old containers to be stopped.
#
# The client gets released by deploying static files on OVH storage.

set -e

if [ -n "${DRY_RUN}" ]; then
  echo -e "\033[31mDRY RUN: will not actually modify anything.\033[0m"
fi

if [ -z "$1" ]; then
  echo -e "ERROR: \033[31mChoose a git tag to deploy.\033[0m"
  git tag | grep ^20..-..-.. | sort | tail
  exit 1
fi
git fetch origin --tags
if [ "$1" == "latest" ]; then
  readonly TAG=$(git tag | grep ^20..-..-.. | sort | tail -n 1)
else
  readonly TAG="$1"
fi

if [ -z "$(git tag -l "${TAG}")" ]; then
  echo -e "ERROR: \033[31mThe tag ${TAG} does not exist locally.\033[0m"
  exit 2
fi

if [ -z "${OS_PASSWORD}" ]; then
  echo -e "ERROR: \033[31mSet up OpenStack credentials first.\033[0m"
  echo "* Go to https://www.ovh.com/manager/cloud and select: Servers -> OpenStack"
  echo "* Create an user if you do not have any, and copy the password"
  echo "* Click on the little wrench and select 'Downloading an Openstack configuration file'"
  echo "* Select 'GRA1 - Gravelines'"
  echo "* Source this file to export the OpenStack environment variables, it will ask for your password."
  exit 3
fi

if ! command -v aws >/dev/null 2>&1; then
  echo -e "ERROR: \033[31mInstall and configure the aws CLI that is necessary for deployment.\033[0m"
  echo "* Ask your favorite admin for the access to the AWS project if you do not have it yet"
  echo "* Log into your AWS console and go to IAM (https://console.aws.amazon.com/iam/home)"
  echo "* Create a new 'Access key ID' and the corresponding 'Secret' if you do not already have one"
  echo "* Run 'aws configure' and add your credentials (make sure to set the region to 'eu-central-1')"
  exit 4
fi

if [ -z "${SLACK_INTEGRATION_URL}" ]; then
  echo -e "ERROR: \033[31mSet up the Slack integration first.\033[0m"
  echo "* Find private URL for Slack Integration at https://bayesimpact.slack.com/apps/A0F7XDUAZ-incoming-webhooks"
  echo "* Add this URL in your bashrc as SLACK_INTEGRATION_URL env var"
  exit 6
fi

if ! command -v swift >/dev/null 2>&1; then
  echo -e "ERROR: \033[31mSet up the OpenStack Swift tool first.\033[0m"
  echo "* Installation is probably as simple as \`pip install python-swiftclient\`"
  exit 7
fi

if ! swift list > /dev/null 2>&1; then
  echo -e "ERROR: \033[31mOpenStack credentials are incorrect.\033[0m"
  echo "* Go to https://www.ovh.com/manager/cloud and select: Servers -> OpenStack"
  echo "* Create an user if you do not have any, and copy the password"
  echo "* Click on the little wrench and select 'Downloading an Openstack configuration file'"
  echo "* Select 'GRA1 - Gravelines'"
  echo "* Source this file to export the OpenStack environment variables, it will ask for your password."
fi

if ! pip show python-keystoneclient > /dev/null; then
  echo -e "ERROR: \033[31mSet up the keystoneclient first.\033[0m"
  echo "* Installation is probably as simple as \`pip install python-keystoneclient\`"
  exit 8
fi

readonly DOCKER_SERVER_REPO="bob-emploi-frontend-server"
readonly DOCKER_CLIENT_REPO="bob-emploi-frontend"
readonly DOCKER_TAG="tag-${TAG}"
readonly DOCKER_SERVER_IMAGE="bayesimpact/${DOCKER_SERVER_REPO}:${DOCKER_TAG}"
readonly DOCKER_CLIENT_IMAGE="bayesimpact/${DOCKER_CLIENT_REPO}:${DOCKER_TAG}"
readonly ECS_FAMILY="frontend-flask"
readonly ECS_SERVICE="flask-lb"
# Our OpenStack container, see
# https://www.ovh.com/manager/cloud/index.html#/iaas/pci/project/7b9ade05d5f84f719adc2cbc76c07eec/storage
readonly OPEN_STACK_CONTAINER="PE Static Assets"
readonly GITHUB_URL="$(hub browse -u)"


# Deploying the server.


echo -e "\033[32mChecking that the server Docker image exists…\033[0m"
# TODO(pascal): Check for a better way that the Docker image exists, querying
# Docker Hub is too long because you need to list all the tags.
hub ci-status "${TAG}" > /dev/null || {
  echo -e "ERROR: \033[31mThe tag \"${TAG}\" did not run properly on CircleCI, chances are the tag does not exist in Docker Registry.\033[0m"
  exit 5
}

# Prepare Release Notes.
readonly RELEASE_NOTES=$(mktemp)
if hub release show "${TAG}" 2> /dev/null > "${RELEASE_NOTES}"; then
  readonly RELEASE_COMMAND="edit"
else
  readonly RELEASE_COMMAND="create"

  echo -e "${TAG}\\n" > "${RELEASE_NOTES}"
  echo -e "# Edit these release notes to make them more readable (lines starting with # are ignored, and an empty file cancels the deployment)." >> "${RELEASE_NOTES}"
  git log "origin/prod..${TAG}" --format=%B -- frontend >> "${RELEASE_NOTES}"

  "${EDITOR:-${GIT_EDITOR:-$(git config core.editor || echo 'vim')}}" "${RELEASE_NOTES}"

  echo -e "Release notes are:"
  cat "${RELEASE_NOTES}"
  sed -i -e "/^#/d" "${RELEASE_NOTES}"
  if [ -z "$(grep "^." "${RELEASE_NOTES}")" ]; then
    echo -e "Canceling deployment due to empty release notes."
    rm -f "${RELEASE_NOTES}"
    exit 9
  fi
fi

echo -e "\033[32mCreating a new task definition…\033[0m"
readonly CONTAINERS_DEFINITION=$(
  aws ecs describe-task-definition --task-definition "${ECS_FAMILY}" | \
    python3 -c "import sys, json; containers = json.load(sys.stdin)['taskDefinition']['containerDefinitions']; containers[0]['environment'] = [dict(env_var, value='prod.${TAG}') if env_var['name'] == 'SERVER_VERSION' else env_var for env_var in containers[0]['environment']]; containers[0]['image'] = '${DOCKER_SERVER_IMAGE}'; print(json.dumps(containers))")

if [ -z "${DRY_RUN}" ]; then
  aws ecs register-task-definition --family="${ECS_FAMILY}" --container-definitions "${CONTAINERS_DEFINITION}" > /dev/null
fi

echo -e "\033[32mRolling out the new task definition…\033[0m"
if [ -z "${DRY_RUN}" ]; then
  aws ecs update-service --service="${ECS_SERVICE}" --task-definition="${ECS_FAMILY}" > /dev/null

  function count_deployments()
  {
    aws ecs describe-services --services "${ECS_SERVICE}" | \
      python3 -c "import sys, json; deployments = json.load(sys.stdin)['services'][0]['deployments']; print(len(deployments))"
  }

  while [ "$(count_deployments)" != "1" ]; do
    printf .
    sleep 10
  done
fi

echo -e "\033[32mServer Deployed!\033[0m"


# Deploying the client.


# To get the files, this script downloads the Docker Images from Docker
# Registry, then extract the html folder from the Docker Image (note that to do
# that we need to create a temporary container using that image). The html
# folder is extracted as a TAR archive that we unpack in a local dir.
#
# Once we have the file we can upload them to OVH Storage using the OpenStack
# tool swift.

echo -e "\033[32mDownloading the client Docker Image…\033[0m"
docker pull "${DOCKER_CLIENT_IMAGE}"

echo -e "\033[32mExtracting the archive from the Docker Image…\033[0m"
readonly TMP_TAR_FILE="$(mktemp).tar"
readonly TMP_DOCKER_CONTAINER=$(docker create "${DOCKER_CLIENT_IMAGE}")
docker cp "${TMP_DOCKER_CONTAINER}":/usr/share/bob-emploi/html - > "${TMP_TAR_FILE}"
docker rm ${TMP_DOCKER_CONTAINER}

echo -e "\033[32mExtracting files from the archive…\033[0m"
readonly TMP_DIR=$(mktemp -d)
tar -xf "${TMP_TAR_FILE}" -C "${TMP_DIR}" --strip-components 1
rm -r "${TMP_TAR_FILE}"

echo -e "\033[32mUploading files to the OpenStack container…\033[0m"
pushd "${TMP_DIR}"
if [ -z "${DRY_RUN}" ]; then
  swift upload "${OPEN_STACK_CONTAINER}" --skip-identical *
fi
popd

rm -r "${TMP_DIR}"

echo -e "\033[32mLogging the deployment on GitHub…\033[0m"
echo "Deployed on $(date -R -u)" >> "${RELEASE_NOTES}"
readonly PREVIOUS_RELEASE="$(git describe --tags origin/prod)"
if [ -z "${DRY_RUN}" ]; then
  hub release "${RELEASE_COMMAND}" --file="${RELEASE_NOTES}" "${TAG}"
  git push -f origin "${TAG}":prod
fi

# Ping Slack to say the deployment is done.
readonly SLACK_MESSAGE=$(mktemp)
readonly ROLLBACK_COMMAND=\`"frontend/release/deploy.sh ${PREVIOUS_RELEASE}"\`
python3 -c "import json
release_notes = open('${RELEASE_NOTES}', 'r').read()
slack_message = {'text': 'A new version of Bob has been deployed ($TAG).\n%s\nTo rollback run: ${ROLLBACK_COMMAND}' % release_notes}
with open('${SLACK_MESSAGE}', 'w') as slack_message_file:
  json.dump(slack_message, slack_message_file)"
if [ -z "${DRY_RUN}" ]; then
  wget -o /dev/null -O /dev/null --post-file=${SLACK_MESSAGE} "$SLACK_INTEGRATION_URL"
else
  echo "Would send the following message to Slack:"
  cat "${SLACK_MESSAGE}"
  echo ""
fi
rm -f "${SLACK_MESSAGE}"
rm -f "${RELEASE_NOTES}"

echo -e "\033[32mSuccess!\033[0m"
echo "Please wait ~15 minutes and check that everything works. If needed rollback using: ${ROLLBACK_COMMAND}."
