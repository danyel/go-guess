import { type ReactNode, useEffect, useState } from 'react'
import { api } from '../api/client'
import { errorMessage } from '../components/actions'
import type { CreateJobInput, CreateParticipantInput, Job, Participant } from '../types'
import { DataContext } from './dataState'

export function DataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function reload() {
    setLoading(true)
    setError('')
    try {
      const [jobItems, participantItems] = await Promise.all([
        api.jobs.list(),
        api.participants.list(),
      ])
      setJobs(jobItems)
      setParticipants(participantItems)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([api.jobs.list(), api.participants.list()])
      .then(([jobItems, participantItems]) => {
        if (!active) return
        setJobs(jobItems)
        setParticipants(participantItems)
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function createJob(input: CreateJobInput) {
    const created = await api.jobs.create(input)
    setJobs((current) => [created, ...current])
    return created
  }

  async function createParticipant(input: CreateParticipantInput) {
    const created = await api.participants.create(input)
    setParticipants((current) => [created, ...current])
    return created
  }

  return (
    <DataContext.Provider
      value={{ jobs, participants, loading, error, createJob, createParticipant, reload }}
    >
      {children}
    </DataContext.Provider>
  )
}
