export type QuestionType = 'open' | 'multiple_choice' | 'radio' | 'code_review'

export interface User {
  id: number
  email: string
  displayName: string
  role: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface Question {
  id: number
  text: string
  type: QuestionType
  options: string[]
  referenceAnswer: string
  codeSnippet: string
  deprecated: boolean
}

export type JobStatus = 'draft' | 'published' | 'deprecated'

export interface Job {
  id: number
  title: string
  description: string
  seniority: string
  position: string
  labels: string[]
  requiredSkills: string[]
  additionalSkills: string[]
  status: JobStatus
  durationMinutes: number
  questions: Question[]
  createdAt: string
}

export interface Participant {
  id: number
  firstName: string
  lastName: string
  birthday?: string
  email: string
  contactInfo: string
  photoUrl?: string
  cvFilename?: string
  cvUrl?: string
  traits: string[]
  createdAt: string
}

export interface CandidateMatch {
  participant: Participant
  score: number
  matchedTraits: string[]
  missingTraits: string[]
}

export interface Invitation {
  id: number
  jobId: number
  participantId: number
  participantName: string
  participantEmail: string
  token: string
  status: string
  outcome: 'pending' | 'passed' | 'failed'
  participantUrl: string
  acceptedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface InterviewAttendee {
  userId: number
  displayName: string
  email: string
  status: string
}

export interface InterviewNote {
  id: number
  authorUserId: number
  authorName: string
  body: string
  createdAt: string
}

export type InterviewEvent =
  | {
      type: 'note.created'
      interviewId: number
      note: InterviewNote
    }
  | {
      type: 'document.updated'
      interviewId: number
      sharedDocument: string
    }
  | {
      type: 'status.updated'
      interviewId: number
      status: string
    }
  | {
      type: 'attendee.updated'
      interviewId: number
      attendee: InterviewAttendee
    }

export interface ScheduledInterview {
  id: number
  jobId: number
  jobTitle: string
  participantId: number
  participantName: string
  startsAt: string
  location: string
  status: string
  candidateToken: string
  candidateUrl: string
  sharedDocument: string
  attendees: InterviewAttendee[]
  notes: InterviewNote[]
}

export interface CreateScheduledInterviewInput {
  invitationId: number
  startsAt: string
  location: string
  interviewerIds: number[]
  sharedDocument: string
}

export interface ParticipantMeeting {
  id: number
  jobTitle: string
  participantName: string
  startsAt: string
  location: string
  status: string
  sharedDocument: string
}

export interface Interview {
  invitation: Invitation
  job: Pick<
    Job,
    'id' | 'title' | 'description' | 'position' | 'seniority' | 'durationMinutes' | 'questions'
  >
  answers: Record<string, string>
}

export type CreateJobInput = Omit<
  Job,
  'id' | 'questions' | 'createdAt' | 'status' | 'durationMinutes'
>
export type CreateQuestionInput = Pick<
  Question,
  'text' | 'type' | 'options' | 'referenceAnswer' | 'codeSnippet'
>
export interface CreateParticipantInput {
  firstName: string
  lastName: string
  birthday?: string
  email: string
  contactInfo: string
  photo?: File
  cv?: File
}
