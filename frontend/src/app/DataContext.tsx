import { type ReactNode, useEffect, useState } from 'react'
import { api } from '../api/client'
import { errorMessage } from '../components/actions'
import type { CreateJobInput, CreateParticipantInput, Job, Participant } from '../types'
import { DataContext } from './dataState'
import { useDomainEvent } from './useDomainEvent'

export function DataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh(showLoading: boolean) {
    if (showLoading) setLoading(true)
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
      if (showLoading) setLoading(false)
    }
  }

  async function reload() {
    await refresh(true)
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

  useDomainEvent<Job | undefined>('jobs', (event) => {
    const job = event.data
    if (job && (event.type === 'job.created' || event.type === 'job.updated')) {
      setJobs((current) => [job, ...current.filter((currentJob) => currentJob.id !== job.id)])
      return
    }
    void refresh(false)
  })

  useDomainEvent<Participant>('participants', (event) => {
    setParticipants((current) => [
      event.data,
      ...current.filter((participant) => participant.id !== event.data.id),
    ])
  })

  async function createJob(input: CreateJobInput) {
    return api.jobs.create(input)
  }

  async function createParticipant(input: CreateParticipantInput) {
    return api.participants.create(input)
  }

  return (
    <DataContext.Provider
      value={{ jobs, participants, loading, error, createJob, createParticipant, reload }}
    >
      {children}
    </DataContext.Provider>
  )
}
