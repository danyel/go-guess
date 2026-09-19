export type QuestionType = 'open' | 'multiple_choice' | 'radio' | 'code_review'

export interface User {
  id: number
  email: string
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
  participantUrl: string
  acceptedAt: string | null
  completedAt: string | null
  createdAt: string
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
