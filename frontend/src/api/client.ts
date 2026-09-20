import type {
  AuthResponse,
  CandidateMatch,
  CreateJobInput,
  CreateParticipantInput,
  CreateQuestionInput,
  CreateScheduledInterviewInput,
  Interview,
  InterviewEvent,
  Invitation,
  Job,
  JobStatus,
  Participant,
  ParticipantMeeting,
  Question,
  ScheduledInterview,
  User,
  InterviewNote,
} from '../types'
import { publishDomainEvent } from './domainEvents'

const TOKEN_KEY = 'go-guess-token'
const USER_KEY = 'go-guess-user'
export const SESSION_EXPIRED_EVENT = 'go-guess:session-expired'

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
  expiresAt: () => {
    try {
      const payload = sessionStorage.getItem(TOKEN_KEY)?.split('.')[1]
      if (!payload) return null
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
      const claims = JSON.parse(atob(padded)) as { exp?: unknown }
      return typeof claims.exp === 'number' ? claims.exp * 1000 : null
    } catch {
      return null
    }
  },
}

export function invalidateSession() {
  authStorage.clear()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
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
    if (response.status === 401 && protectedRequest) invalidateSession()
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
  if (!response.ok) {
    if (response.status === 401) invalidateSession()
    throw new ApiError(`Request failed with status ${response.status}`, response.status)
  }

  return response.blob()
}

async function mutation<T>(
  response: Promise<T>,
  type: string,
  resources: (data: T) => string[],
): Promise<T> {
  const data = await response
  publishDomainEvent(resources(data), type, data)
  return data
}

async function subscribeToInterviewEvents(
  path: string,
  onEvent: (event: InterviewEvent) => void,
  signal: AbortSignal,
  protectedRequest: boolean,
  onConnectionError?: (error: unknown) => void,
) {
  while (!signal.aborted) {
    try {
      const token = authStorage.token()
      const response = await fetch(`/api${path}`, {
        headers: {
          Accept: 'text/event-stream',
          ...(protectedRequest && token ? { Authorization: 'Bearer ' + token } : {}),
        },
        signal,
      })
      if (!response.ok || !response.body) {
        if (response.status === 401 && protectedRequest) invalidateSession()
        throw new ApiError(`Live updates failed with status ${response.status}`, response.status)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const message = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const data = message
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n')
          if (data) onEvent(JSON.parse(data) as InterviewEvent)
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (error) {
      if (signal.aborted) return
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) throw error
      onConnectionError?.(error)
    }
    if (!signal.aborted) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
    }
  }
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
      mutation(
        request<Job>('/jobs', { method: 'POST', body: JSON.stringify(input) }),
        'job.created',
        (job) => ['jobs', `jobs/${job.id}`],
      ),
    update: (jobId: number, input: { status: JobStatus; durationMinutes: number }) =>
      mutation(
        request<Job>(`/jobs/${jobId}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),
        'job.updated',
        () => ['jobs', `jobs/${jobId}`],
      ),
    attachQuestion: (jobId: number, questionId: number) =>
      mutation(
        request<void>(`/jobs/${jobId}/questions/${questionId}`, {
          method: 'POST',
        }),
        'job.question-attached',
        () => ['jobs', `jobs/${jobId}`, `questions/${questionId}`],
      ),
    detachQuestion: (jobId: number, questionId: number) =>
      mutation(
        request<void>(`/jobs/${jobId}/questions/${questionId}`, { method: 'DELETE' }),
        'job.question-detached',
        () => ['jobs', `jobs/${jobId}`, `questions/${questionId}`],
      ),
    candidates: async (jobId: number) => {
      const matches = await request<CandidateMatch[]>(`/jobs/${jobId}/candidates`)
      return matches.map((match) => ({
        ...match,
        matchedTraits: match.matchedTraits ?? [],
        missingTraits: match.missingTraits ?? [],
      }))
    },
    invitations: (jobId: number) => request<Invitation[]>(`/jobs/${jobId}/invitations`),
    invitation: (jobId: number, invitationId: number) =>
      request<Interview>(`/jobs/${jobId}/invitations/${invitationId}`),
    invite: (jobId: number, participantId: number) =>
      mutation(
        request<Invitation>(`/jobs/${jobId}/invitations`, {
          method: 'POST',
          body: JSON.stringify({ participantId }),
        }),
        'invitation.created',
        (invitation) => [
          `jobs/${jobId}`,
          `job-invitations/${jobId}`,
          `assessment-invitations/${invitation.id}`,
        ],
      ),
    setInvitationOutcome: (jobId: number, invitationId: number, outcome: Invitation['outcome']) =>
      mutation(
        request<Invitation>(`/jobs/${jobId}/invitations/${invitationId}/outcome`, {
          method: 'PATCH',
          body: JSON.stringify({ outcome }),
        }),
        'invitation.outcome-updated',
        () => [
          `jobs/${jobId}`,
          `job-invitations/${jobId}`,
          `assessment-invitations/${invitationId}`,
        ],
      ),
    interviews: (jobId: number) => request<ScheduledInterview[]>(`/jobs/${jobId}/interviews`),
    scheduleInterview: (jobId: number, input: CreateScheduledInterviewInput) =>
      mutation(
        request<ScheduledInterview>(`/jobs/${jobId}/interviews`, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
        'scheduled-interview.created',
        (interview) => [
          `jobs/${jobId}`,
          'scheduled-interviews',
          `scheduled-interviews/${interview.id}`,
          'invitations',
          'schedule',
        ],
      ),
  },
  questions: {
    list: (search = '') =>
      request<Question[]>(`/questions${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    create: (input: CreateQuestionInput) =>
      mutation(
        request<Question>('/questions', { method: 'POST', body: JSON.stringify(input) }),
        'question.created',
        (question) => ['questions', `questions/${question.id}`],
      ),
    update: (id: number, input: CreateQuestionInput) =>
      mutation(
        request<Question>(`/questions/${id}`, {
          method: 'PUT',
          body: JSON.stringify(input),
        }),
        'question.updated',
        () => ['questions', `questions/${id}`],
      ),
    setDeprecated: (id: number, deprecated: boolean) =>
      mutation(
        request<Question>(`/questions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ deprecated }),
        }),
        'question.deprecation-updated',
        () => ['questions', `questions/${id}`],
      ),
  },
  interviews: {
    get: (token: string) => request<Interview>(`/interviews/${token}`, {}, false),
    accept: (token: string) =>
      mutation(
        request<Interview>(`/interviews/${token}/accept`, { method: 'POST' }, false),
        'assessment-invitation.accepted',
        (interview) => [`interviews/${token}`, `assessment-invitations/${interview.invitation.id}`],
      ),
    answer: (token: string, questionId: number, answer: string) =>
      mutation(
        request<void>(
          `/interviews/${token}/answers/${questionId}`,
          { method: 'PUT', body: JSON.stringify({ answer }) },
          false,
        ),
        'assessment-answer.saved',
        () => [`interviews/${token}`],
      ),
    finish: (token: string) =>
      mutation(
        request<Interview>(`/interviews/${token}/finish`, { method: 'POST' }, false),
        'assessment-invitation.completed',
        (interview) => [`interviews/${token}`, `assessment-invitations/${interview.invitation.id}`],
      ),
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
      return mutation(
        request<Participant>('/participants', { method: 'POST', body: form }),
        'participant.created',
        (participant) => ['participants', `participants/${participant.id}`],
      )
    },
  },
  users: {
    list: () => request<User[]>('/users'),
    create: (input: { email: string; password: string; displayName: string }) =>
      mutation(
        request<User>('/users', { method: 'POST', body: JSON.stringify(input) }),
        'user.created',
        (user) => ['users', `users/${user.id}`],
      ),
  },
  inbox: {
    list: () => request<ScheduledInterview[]>('/invitations'),
    respond: (interviewId: number, status: 'accepted' | 'declined') =>
      mutation(
        request<ScheduledInterview>(`/invitations/${interviewId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
        'interview-invitation.responded',
        () => [
          'invitations',
          `invitations/${interviewId}`,
          'schedule',
          `scheduled-interviews/${interviewId}`,
        ],
      ),
  },
  calendar: () => request<ScheduledInterview[]>('/schedule'),
  scheduledInterviews: {
    get: (id: number) => request<ScheduledInterview>(`/scheduled-interviews/${id}`),
    setStatus: (id: number, status: string) =>
      mutation(
        request<ScheduledInterview>(`/scheduled-interviews/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }),
        'scheduled-interview.status-updated',
        () => ['scheduled-interviews', `scheduled-interviews/${id}`, 'schedule', 'invitations'],
      ),
    updateDocument: (id: number, sharedDocument: string) =>
      mutation(
        request<ScheduledInterview>(`/scheduled-interviews/${id}/document`, {
          method: 'PATCH',
          body: JSON.stringify({ sharedDocument }),
        }),
        'scheduled-interview.document-updated',
        () => [`scheduled-interviews/${id}`],
      ),
    notes: (id: number) => request<InterviewNote[]>(`/scheduled-interviews/${id}/notes`),
    addNote: (id: number, body: string) =>
      mutation(
        request<InterviewNote>(`/scheduled-interviews/${id}/notes`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        }),
        'scheduled-interview.note-created',
        () => [`scheduled-interviews/${id}/notes`],
      ),
    subscribe: (
      id: number,
      onEvent: (event: InterviewEvent) => void,
      signal: AbortSignal,
      onConnectionError?: (error: unknown) => void,
    ) =>
      subscribeToInterviewEvents(
        `/scheduled-interviews/${id}/events`,
        onEvent,
        signal,
        true,
        onConnectionError,
      ),
  },
  participantMeetings: {
    get: (token: string) =>
      request<ParticipantMeeting>(`/participant-meetings/${token}`, {}, false),
    subscribe: (
      token: string,
      onEvent: (event: InterviewEvent) => void,
      signal: AbortSignal,
      onConnectionError?: (error: unknown) => void,
    ) =>
      subscribeToInterviewEvents(
        `/participant-meetings/${token}/events`,
        onEvent,
        signal,
        false,
        onConnectionError,
      ),
  },
}
