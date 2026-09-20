import { createContext } from 'react'
import type { CreateJobInput, CreateParticipantInput, Job, Participant } from '../types'

export interface AppData {
  jobs: Job[]
  participants: Participant[]
  loading: boolean
  error: string
  createJob: (input: CreateJobInput) => Promise<Job>
  createParticipant: (input: CreateParticipantInput) => Promise<Participant>
  reload: () => Promise<void>
}

export const DataContext = createContext<AppData | null>(null)
