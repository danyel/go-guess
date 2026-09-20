import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, authStorage } from '../../api/client'
import { useDomainEvent } from '../../app/useDomainEvent'
import { errorMessage } from '../../components/actions'
import { ErrorAlert, Loading } from '../../components/ui/AsyncState'
import type { ScheduledInterview } from '../../types'
import { InterviewCard } from '../interviews/components/InterviewCard'

export function SchedulePage() {
  const [items, setItems] = useState<ScheduledInterview[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api
      .calendar()
      .then(setItems)
      .catch((value) => setError(errorMessage(value)))
      .finally(() => setLoading(false))
  }, [])

  useDomainEvent<ScheduledInterview>('schedule', (event) => {
    setItems((current) => {
      const attendee = event.data.attendees.find((item) => item.userId === authStorage.user()?.id)
      const accepted = attendee?.status === 'accepted'
      if (!accepted) return current.filter((item) => item.id !== event.data.id)
      return [event.data, ...current.filter((item) => item.id !== event.data.id)]
    })
  })

  const groups = useMemo(() => {
    return [...items]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .reduce<Record<string, ScheduledInterview[]>>((result, item) => {
        const key = new Date(item.startsAt).toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        ;(result[key] ??= []).push(item)
        return result
      }, {})
  }, [items])

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Interviews</span>
          <h1>Schedule</h1>
          <p>Review accepted and upcoming interviews.</p>
        </div>
      </header>
      {error && <ErrorAlert error={error} />}
      {loading ? (
        <Loading />
      ) : (
        Object.entries(groups).map(([date, interviews]) => (
          <section className="calendar-day" key={date}>
            <h2>{date}</h2>
            <div className="meeting-list">
              {interviews.map((item) => (
                <InterviewCard
                  interview={item}
                  key={item.id}
                  onConnectionError={(value) => setError(errorMessage(value))}
                >
                  <Link className="button secondary" to={`/scheduled-interviews/${item.id}`}>
                    Open session
                  </Link>
                </InterviewCard>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
