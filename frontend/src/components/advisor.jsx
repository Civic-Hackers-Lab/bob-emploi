import React from 'react'
import PropTypes from 'prop-types'
import ReactHeight from 'react-height'
import {connect} from 'react-redux'
import VisibilitySensor from 'react-visibility-sensor'

import {adviceCardIsShown, advicePageIsShown, getAdviceTips, selectAdvice,
  seeAdvice, sendAdviceFeedback} from 'store/actions'
import {getAdviceTitle} from 'store/advice'
import {hasUserEverAcceptedAdvice} from 'store/project'

import constructionImage from 'images/construction-picto.svg'
import {Modal} from 'components/modal'
import {Button, Colors, FastTransitions, Icon, SmoothTransitions, Styles} from 'components/theme'
import {TipsList} from 'components/tips'

import adviceModuleProperties from './advisor/data/advice_modules.json'

import AssociationHelp from './advisor/association_help'
import BetterJobInGroup from './advisor/better_job_in_group'
import Commute from './advisor/commute'
import Events from './advisor/events'
import ImproveInterview from './advisor/improve_interview'
import ImproveResume from './advisor/improve_resume'
import JobBoards from './advisor/job_boards'
import LifeBalance from './advisor/life_balance'
import MotivationEmail from './advisor/motivation_email'
import NetworkApplication from './advisor/network_bad'
import NetworkApplicationMedium from './advisor/network_medium'
import NetworkApplicationGood from './advisor/network_good'
import OtherWorkEnv from './advisor/other_work_env'
import SpontaneousApplication from './advisor/spontaneous'
import WowBaker from './advisor/wow_baker'
import WowHairdresser from './advisor/wow_hairdresser'


// Map of advice recommendation modules keyed by advice module IDs.
const ADVICE_MODULES = {
  'association-help': AssociationHelp,
  'better-job-in-group': BetterJobInGroup,
  'commute': Commute,
  'events': Events,
  'find-a-jobboard': JobBoards,
  'fresh-resume': ImproveResume,
  'improve-interview': ImproveInterview,
  'improve-resume': ImproveResume,
  'life-balance': LifeBalance,
  'motivation-email': MotivationEmail,
  'network-application': NetworkApplication,
  'network-application-good': NetworkApplicationGood,
  'network-application-medium': NetworkApplicationMedium,
  'other-work-env': OtherWorkEnv,
  'spontaneous-application': SpontaneousApplication,
  'wow-baker': WowBaker,
  'wow-hairdresser': WowHairdresser,
}


class WhiteAdviceCard extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    children: PropTypes.node,
    dispatch: PropTypes.func.isRequired,
    onExpandChanged: PropTypes.func,
    onHoverChanged: PropTypes.func,
    onShow: PropTypes.func,
    project: PropTypes.object.isRequired,
    scrollParent: PropTypes.func,
    style: PropTypes.object,
  }

  state = {
    hasBeenSeen: false,
    isExpanded: false,
    isHovered: false,
  }

  componentWillMount() {
    const {advice, dispatch, project} = this.props
    dispatch(adviceCardIsShown(project, advice))
  }

  changeExpand = isExpanded => {
    const {onExpandChanged} = this.props
    this.setState({isExpanded})
    onExpandChanged && onExpandChanged(isExpanded)
  }

  changeHover = isHovered => {
    const {onHoverChanged} = this.props
    this.setState({isHovered})
    onHoverChanged && onHoverChanged(isHovered)
  }

  gotoAdvicePage = visualElement => event => {
    const {advice, dispatch, project} = this.props
    event.stopPropagation()
    this.changeExpand(true)
    dispatch(selectAdvice(project, advice, visualElement))
    dispatch(getAdviceTips(project, advice))
    dispatch(advicePageIsShown(project, advice))
  }

  handleVisibilityChange = isVisible => {
    if (!isVisible) {
      return
    }
    const {advice, dispatch, onShow, project} = this.props
    this.setState({hasBeenSeen: true})
    dispatch(seeAdvice(project, advice))
    onShow && onShow()
  }

  collapse = () => {
    const {scrollParent} = this.props
    const {collapsedHeight, expandedHeight} = this.state
    this.changeExpand(false)
    if (collapsedHeight && expandedHeight && scrollParent) {
      scrollParent(collapsedHeight - expandedHeight)
    }
  }

  renderTitle() {
    const {advice, project} = this.props
    const {isExpanded} = this.state
    const isAdviceUnread = advice.status === 'ADVICE_RECOMMENDED'
    const style = {
      alignItems: 'center',
      color: isExpanded ? '#fff' : Colors.CHARCOAL_GREY,
      display: 'flex',
      fontSize: isExpanded ? 25 : 18,
      fontStyle: isExpanded ? 'italic' : 'normal',
      fontWeight: isExpanded ? 'normal': isAdviceUnread ? 'bold' : 500,
    }
    const tagStyle = {
      backgroundColor: Colors.GREENISH_TEAL,
      borderRadius: 2,
      color: '#fff',
      display: 'inline-block',
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: .3,
      marginLeft: 15,
      padding: 6,
      textTransform: 'uppercase',
    }
    return <header style={style}>
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {getAdviceTitle(advice)}
      </span>
      {(isExpanded || !isAdviceUnread) ? null : <span style={tagStyle}>
        <div style={Styles.CENTER_FONT_VERTICALLY}>
          Nouveau
        </div>
      </span>}
      <span style={{flex: 1}} />
      {isExpanded ? <FeedbackButton advice={advice} project={project} /> : null}
    </header>
  }

  renderExpandButtonBar(style) {
    const {advice} = this.props
    const {isHovered} = this.state
    const {callToAction} = adviceModuleProperties[advice.adviceId] || {}
    const plusStyle = {
      backgroundColor: isHovered ? Colors.SKY_BLUE : 'transparent',
      border: `solid 1px ${isHovered ? Colors.SKY_BLUE : Colors.MODAL_PROJECT_GREY}`,
      borderRadius: 25,
      color: isHovered ? '#fff' : Colors.CHARCOAL_GREY,
      display: 'inline-block',
      height: 25,
      lineHeight: '25px',
      marginRight: 15,
      textAlign: 'center',
      verticalAlign: 'middle',
      width: 25,
      ...SmoothTransitions,
    }
    return <div style={{alignItems: 'center', display: 'flex', ...style}}>
      <span style={plusStyle}>+</span>
      <span style={Styles.CENTER_FONT_VERTICALLY}>
        {callToAction || 'Voir plus'}
      </span>
    </div>
  }

  renderCollapseButtonBar() {
    const buttonBarStyle = {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'center',
      padding: 22,
    }
    return <div style={buttonBarStyle}>
      <Button onClick={this.collapse} type="back">
        Fermer
      </Button>
    </div>
  }

  render() {
    const {advice, children, project, style} = this.props
    const {isExpanded} = this.state
    const isAdviceUnread = advice.status === 'ADVICE_RECOMMENDED'
    const cardStyle = {
      backgroundColor: '#fff',
      boxShadow: isAdviceUnread ? '0 2px 10px 0 rgba(0, 0, 0, .25)' :
        isExpanded ? '0 2px 14px 0 rgba(0, 0, 0, 0.15)' : 'initial',
      color: Colors.CHARCOAL_GREY,
      cursor: isExpanded ? 'initial' : 'pointer',
      ...SmoothTransitions,
      ...style,
    }
    const headerStyle = {
      backgroundColor: isExpanded ? Colors.DARK_TWO : 'transparent',
      color: isExpanded ? '#fff' : 'initial',
      padding: '35px 40px',
      ...SmoothTransitions,
    }
    const contentStyle = {
      backgroundColor: isExpanded ? Colors.LIGHT_GREY : 'transparent',
      padding: isExpanded ? 40 : '0 40px 40px',
      ...SmoothTransitions,
    }
    return <VisibilitySensor
        active={!this.state.hasBeenSeen} intervalDelay={250} minTopValue={50}
        partialVisibility={true} onChange={this.handleVisibilityChange}>
      <ReactHeight
          onHeightReady={height => this.setState({
            [isExpanded ? 'expandedHeight' : 'collapsedHeight']: height})}>
        <section
            style={cardStyle}
            onClick={isExpanded ? null : this.gotoAdvicePage('advice-card')}
            onMouseEnter={() => this.changeHover(true)}
            onMouseLeave={() => this.changeHover(false)}>
          <header style={headerStyle}>
            {this.renderTitle()}
          </header>
          <div style={contentStyle}>
            {this.state.isExpanded ? <AdvicePageContent {...this.props} /> : children}
            {this.state.isExpanded ?
              <TipsList project={project} advice={advice} /> :
              this.renderExpandButtonBar({marginTop: 40})}
          </div>
          {this.state.isExpanded ? this.renderCollapseButtonBar() : null}
        </section>
      </ReactHeight>
    </VisibilitySensor>
  }
}


class AdviceCardBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    refDom: PropTypes.func,
    style: PropTypes.object,
  }
  static contextTypes = {
    isMobileVersion: PropTypes.bool,
  }

  componentWillMount() {
    this.setState({
      isExpanded: false,
      isHovered: false,
      isJustMounted: true,
      isVisible: false,
    })
    this.timeout = setTimeout(() => this.setState({isJustMounted: false}), 100)
  }

  componentWillUnmount() {
    clearTimeout(this.timeout)
  }

  renderTimeline(style) {
    const {advice} = this.props
    const {isMobileVersion} = this.context
    const {isHovered} = this.state
    if (isMobileVersion) {
      return null
    }
    const numStars = advice.numStars || 1
    const backgroundColor = numStars < 2 ? Colors.GREENISH_TEAL :
        numStars >= 3 ? Colors.RED_PINK : Colors.SQUASH
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }
    const bubbleStyle = {
      backgroundColor,
      borderRadius: 100,
      height: 20,
      margin: 22,
      opacity: isHovered ? 1 : .7,
      padding: 7,
      width: 20,
      ...SmoothTransitions,
    }
    const verticalLineStyle = {
      border: `solid 1px ${isHovered ? backgroundColor : Colors.SILVER}`,
      flex: 1,
      width: 0,
      ...SmoothTransitions,
    }
    return <header style={containerStyle}>
      <div style={bubbleStyle} />
      <div style={verticalLineStyle} />
    </header>
  }

  isCardShown() {
    const {project} = this.props
    const {isJustMounted, isVisible} = this.state
    return hasUserEverAcceptedAdvice(project) || isVisible && !isJustMounted
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {advice, dispatch, project, refDom, style, ...extraProps} = this.props
    const {isExpanded} = this.state
    const {isMobileVersion} = this.context
    const isCardShown = this.isCardShown()
    const module = ADVICE_MODULES[advice.adviceId] || null
    const CardComponent = module && module.FullAdviceCard || null
    if (!CardComponent) {
      return null
    }
    const containerStyle = {
      display: 'flex',
      flexDirection: isMobileVersion ? 'column' : 'row',
      maxWidth: '100%',
      overflow: 'hidden',
      ...style,
    }
    const cardStyle = {
      flex: 1,
      marginLeft: isMobileVersion ? 0 : 10,
      opacity: isCardShown ? 1 : 0,
      transform: isExpanded ? 'initial' : `translateX(${isCardShown ? '0' : '50%'})`,
      ...FastTransitions,
    }
    return <div style={containerStyle} ref={refDom}>
      {this.renderTimeline({width: 80})}
      <div style={cardStyle}>
        <WhiteAdviceCard
            {...extraProps} advice={advice} dispatch={dispatch} project={project}
            onShow={() => this.setState({isVisible: true})}
            onExpandChanged={isExpanded => this.setState({isExpanded})}
            onHoverChanged={isHovered => this.setState({isHovered})}>
          <CardComponent {...extraProps} advice={advice} project={project} />
        </WhiteAdviceCard>
      </div>
    </div>
  }
}
const AdviceCard = connect(({app}, {advice, project}) => ({
  tips: (app.adviceTips[project.projectId] || {})[advice.adviceId] || [],
}))(AdviceCardBase)


class AdvicePageContent extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  renderGeneric(style) {
    const containerStyle = {
      alignItems: 'center',
      display: 'flex',
      ...style,
    }
    return <div style={containerStyle}>
      <div style={{flex: 1, textAlign: 'center'}}>
        <img src={constructionImage} />
        <div style={{fontStyle: 'italic', fontWeight: 500}}>
          Module en construction
        </div>
      </div>

      <div style={{flex: 2}}>
        <p>
          Vous serez notifié lorsque le module sera prêt pour vous aider à
          avancer sur ce sujet.
        </p>
      </div>
    </div>
  }

  render() {
    const {advice, style} = this.props
    const module = ADVICE_MODULES[advice.adviceId] || null
    const PageComponent = module && module.AdvicePageContent || null
    if (PageComponent) {
      return <PageComponent {...this.props} />
    }
    return this.renderGeneric(style)
  }
}


class FeedbackButtonBase extends React.Component {
  static propTypes = {
    advice: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    project: PropTypes.object.isRequired,
    style: PropTypes.object,
  }

  state = {
    isFeedbackModalShown: false,
    isHovered: false,
  }

  sendFeedback = () => {
    const {advice, dispatch, project} = this.props
    const feedback = this.feedbackDom && this.feedbackDom.value
    dispatch(sendAdviceFeedback(project, advice, feedback))
    this.setState({isFeedbackModalShown: false})
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.isFeedbackModalShown && !prevState.isFeedbackModalShown) {
      this.feedbackDom && this.feedbackDom.focus()
    }
  }

  render() {
    const {style} = this.props
    const {hasFeedback, isHovered} = this.state
    const iconStyle = {
      color: isHovered ? '#fff' : Colors.COOL_GREY,
      cursor: 'pointer',
      ...SmoothTransitions,
      ...style,
    }
    return <div
        style={style}
        onMouseEnter={() => this.setState({isHovered: true})}
        onMouseLeave={() => this.setState({isHovered: false})}>
      <Modal
          isShown={this.state.isFeedbackModalShown}
          title="Nous sommes à votre écoute"
          onClose={() => this.setState({isFeedbackModalShown: false})}
          style={{fontSize: 14, fontStyle: 'normal'}}>
        <div style={{display: 'flex', flexDirection: 'column', margin: '25px 50px'}}>
            Qu'avez vous pensé de ce conseil&nbsp;?
          <textarea
              style={{height: 300, marginTop: 5, padding: '15px 12px', width: 380}}
              onChange={event => this.setState({hasFeedback: !!event.target.value})}
              placeholder="Écrivez votre commentaire ici" ref={feedbackDom => {
                this.feedbackDom = feedbackDom
              }} />
        </div>
        <div style={{marginBottom: 25, textAlign: 'center'}}>
          <Button disabled={!hasFeedback} onClick={hasFeedback ? this.sendFeedback : null}>
            Envoyer
          </Button>
        </div>
      </Modal>
      <Icon
          name="pencil-box-outline" style={iconStyle}
          onClick={() => this.setState({isFeedbackModalShown: true})} />
    </div>
  }
}
const FeedbackButton = connect()(FeedbackButtonBase)


export {AdviceCard, AdvicePageContent}
