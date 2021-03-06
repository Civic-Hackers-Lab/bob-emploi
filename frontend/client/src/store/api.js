function cleanHtmlError(htmlErrorPage) {
  const page = document.createElement('html')
  page.innerHTML = htmlErrorPage
  const content = page.getElementsByTagName('P')
  return content.length && content[0].innerText || page.innerText
}

function handleJsonResponse(response) {
  // Errors are in HTML, not JSON.
  if (response.status >= 400 || response.status < 200) {
    return response.text().then(errorMessage => {
      throw cleanHtmlError(errorMessage)
    })
  }
  return response.json()
}

const fetchWithoutCookies = (path, request) => fetch(path, {credentials: 'omit', ...request})

function postJson(path, data, isExpectingResponse, authToken) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  const fetchPromise = fetchWithoutCookies(path, {
    body: JSON.stringify(data),
    headers,
    method: 'post',
  })
  if (isExpectingResponse) {
    return fetchPromise.then(handleJsonResponse)
  }
  return fetchPromise
}

function deleteJson(path, data, authToken) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  return fetchWithoutCookies(path, {
    body: JSON.stringify(data),
    headers,
    method: 'delete',
  }).then(handleJsonResponse)
}

function getJson(path, authToken) {
  const headers = {
    'Accept': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken
  }
  return fetchWithoutCookies(path, {headers}).then(handleJsonResponse)
}

function adviceTipsGet({userId}, {projectId}, {adviceId}, authToken) {
  return getJson(`/api/advice/tips/${adviceId}/${userId}/${projectId}`, authToken).
    then(response => response.tips)
}

function convertUserWithAdviceSelectionFromProtoPost(proto) {
  return fetchWithoutCookies('/api/user/proto', {
    body: proto,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-protobuf-base64',
    },
    method: 'post',
  }).then(handleJsonResponse)
}

function convertUserWithAdviceSelectionToProtoPost(proto) {
  return fetchWithoutCookies('/api/user/proto', {
    body: JSON.stringify(proto),
    headers: {
      'Accept': 'application/x-protobuf-base64',
      'Content-Type': 'application/json',
    },
    method: 'post',
  }).then(response => response.text()).then(response => response.replace(/\n/g, ''))
}

function createEvalUseCasePost(poolName, email, googleIdToken) {
  return postJson('/api/eval/use-case/create', {email, poolName}, true, googleIdToken)
}

function evalUseCasePoolsGet(authToken) {
  return getJson('/api/eval/use-case-pools', authToken).
    then(response => response.useCasePools || [])
}

function evalUseCasesGet(poolName, authToken) {
  return getJson(`/api/eval/use-cases/${poolName}`, authToken).
    then(response => response.useCases || [])
}

function expandedCardContentGet(user, project, {adviceId}, authToken) {
  if (user.userId && project.projectId) {
    return getJson(`/api/advice/${adviceId}/${user.userId}/${project.projectId}`, authToken)
  }
  return postJson(
    `/api/advice/${adviceId}`,
    {
      ...user,
      projects: (user.projects || []).filter(p => p.projectId === project.projectId),
    },
    true)
}

function jobRequirementsGet(romeId) {
  return getJson(`/api/job/requirements/${romeId}`)
}

function jobsGet(romeId) {
  return getJson(`/api/jobs/${romeId}`)
}

function markUsedAndRetrievePost(userId, authToken) {
  return postJson(`/api/app/use/${userId}`, undefined, true, authToken)
}

function migrateUserToAdvisorPost({userId}, authToken) {
  return postJson(`/api/user/${userId}/migrate-to-advisor`, undefined, true, authToken)
}

function onboardingDiagnosePost(data, authToken) {
  const {userId, projects: [{projectId} = {}] = []} = data.user
  const path = projectId ? `/api/user/${userId}/update-and-quick-diagnostic/project/${projectId}` :
    `/api/user/${userId}/update-and-quick-diagnostic`
  return postJson(path, data, true, authToken)
}

function projectComputeAdvicesPost(user) {
  return postJson('/api/project/compute-advices', user, true)
}

function projectDiagnosePost(user, source) {
  const path = `/api/project/diagnose${source ? '?source=' + encodeURIComponent(source) : ''}`
  return postJson(path, user, true)
}

function resetPasswordPost(email) {
  return postJson('/api/user/reset-password', {email}, true)
}

function userPost(user, token) {
  return postJson('/api/user', user, true, token)
}

function projectPost({userId}, {projectId}, project, authToken) {
  return postJson(
    `/api/user/${userId}/project/${projectId}`, project, true, authToken)
}

function advicePost({userId}, {projectId}, {adviceId}, advice, authToken) {
  return postJson(
    `/api/user/${userId}/project/${projectId}/advice/${adviceId}`, advice, true, authToken)
}

function userDelete(user, authToken) {
  return deleteJson('/api/user', user, authToken)
}

function userAuthenticate(authRequest) {
  return postJson('/api/user/authenticate', authRequest, true)
}

function feedbackPost(feedback, authToken) {
  return postJson('/api/feedback', feedback, false, authToken)
}

export {
  advicePost,
  adviceTipsGet,
  convertUserWithAdviceSelectionFromProtoPost,
  convertUserWithAdviceSelectionToProtoPost,
  createEvalUseCasePost,
  evalUseCasePoolsGet,
  evalUseCasesGet,
  expandedCardContentGet,
  feedbackPost,
  jobRequirementsGet,
  jobsGet,
  markUsedAndRetrievePost,
  migrateUserToAdvisorPost,
  onboardingDiagnosePost,
  projectComputeAdvicesPost,
  projectDiagnosePost,
  projectPost,
  resetPasswordPost,
  userAuthenticate,
  userDelete,
  userPost,
}
