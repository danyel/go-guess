import type {
  AuthResponse,
  CandidateMatch,
  CreateJobInput,
  CreateParticipantInput,
  CreateQuestionInput,
  Interview,
  Invitation,
  Job,
  JobStatus,
  Participant,
  Question,
} from './types'

const TOKEN_KEY = 'go-guess-token'
const USER_KEY = 'go-guess-user'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const authStorage = {
  token: () => sessionStorage.getItem(TOKEN_KEY),
  user: () => {
    const value = sessionStorage.getItem(USER_KEY)
    return value ? (JSON.parse(value) as AuthResponse['user']) : null
  },
  save: (auth: AuthResponse) => {
    sessionStorage.setItem(TOKEN_KEY, auth.token)
    sessionStorage.setItem(USER_KEY, JSON.stringify(auth.user))
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
  },
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  protectedRequest = true,
): Promise<T> {
  const token = authStorage.token()
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(protectedRequest && token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    let details: unknown
    let message = `Request failed with status ${response.status}`
    try {
      details = await response.json()
      if (
        typeof details === 'object' &&
        details !== null &&
        'error' in details &&
        typeof details.error === 'string'
      ) {
        message = details.error
      }
    } catch {
      details = undefined
    }
    if (response.status === 401 && protectedRequest) authStorage.clear()
    throw new ApiError(message, response.status, details)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function requestBlob(path: string): Promise<Blob> {
  const token = authStorage.token()
  const response = await fetch(`/api${path}`, {
    headers: {
      Accept: '*/*',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok)
    throw new ApiError(`Request failed with status ${response.status}`, response.status)
  return response.blob()
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    ),
  jobs: {
    list: () => request<Job[]>('/jobs'),
    get: (id: number) => request<Job>(`/jobs/${id}`),
    create: (input: CreateJobInput) =>
      request<Job>('/jobs', { method: 'POST', body: JSON.stringify(input) }),
    update: (jobId: number, input: { status: JobStatus; durationMinutes: number }) =>
      request<Job>(`/jobs/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    attachQuestion: (jobId: number, questionId: number) =>
      request<void>(`/jobs/${jobId}/questions/${questionId}`, {
        method: 'POST',
      }),
    detachQuestion: (jobId: number, questionId: number) =>
      request<void>(`/jobs/${jobId}/questions/${questionId}`, { method: 'DELETE' }),
    candidates: (jobId: number) => request<CandidateMatch[]>(`/jobs/${jobId}/candidates`),
    invitations: (jobId: number) => request<Invitation[]>(`/jobs/${jobId}/invitations`),
    invitation: (jobId: number, invitationId: number) =>
      request<Interview>(`/jobs/${jobId}/invitations/${invitationId}`),
    invite: (jobId: number, participantId: number) =>
      request<Invitation>(`/jobs/${jobId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ participantId }),
      }),
  },
  questions: {
    list: (search = '') =>
      request<Question[]>(`/questions${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    create: (input: CreateQuestionInput) =>
      request<Question>('/questions', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: number, input: CreateQuestionInput) =>
      request<Question>(`/questions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    setDeprecated: (id: number, deprecated: boolean) =>
      request<Question>(`/questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deprecated }),
      }),
  },
  interviews: {
    get: (token: string) => request<Interview>(`/interviews/${token}`, {}, false),
    accept: (token: string) =>
      request<Interview>(`/interviews/${token}/accept`, { method: 'POST' }, false),
    answer: (token: string, questionId: number, answer: string) =>
      request<void>(
        `/interviews/${token}/answers/${questionId}`,
        { method: 'PUT', body: JSON.stringify({ answer }) },
        false,
      ),
    finish: (token: string) =>
      request<Interview>(`/interviews/${token}/finish`, { method: 'POST' }, false),
  },
  participants: {
    list: () => request<Participant[]>('/participants'),
    get: (id: number) => request<Participant>(`/participants/${id}`),
    photo: (id: number) => requestBlob(`/participants/${id}/photo`),
    cv: (id: number) => requestBlob(`/participants/${id}/cv`),
    create: (input: CreateParticipantInput) => {
      const form = new FormData()
      form.append('firstName', input.firstName)
      form.append('lastName', input.lastName)
      form.append('birthday', input.birthday ?? '')
      form.append('email', input.email)
      form.append('contactInfo', input.contactInfo)
      if (input.photo) form.append('photo', input.photo)
      if (input.cv) form.append('cv', input.cv)
      return request<Participant>('/participants', { method: 'POST', body: form })
    },
  },
}
