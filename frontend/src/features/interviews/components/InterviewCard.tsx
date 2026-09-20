import { CalendarDays, MapPin } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { api } from '../../../api/client'
import { useDomainEvent } from '../../../app/useDomainEvent'
import type { ParticipantMeeting, ScheduledInterview } from '../../../types'
import { applyInterviewEvent } from '../interviewEvents'

export function DateAndPlace({
  interview,
}: {
  interview: ScheduledInterview | ParticipantMeeting
}) {
  return (
    <div className="meeting-facts">
      <span>
        <CalendarDays size={18} aria-hidden="true" />
        {new Date(interview.startsAt).toLocaleString()}
      </span>
      <span>
        <MapPin size={18} aria-hidden="true" />
        {interview.location}
      </span>
    </div>
  )
}

export function InterviewCard({
  interview,
  children,
  onConnectionError,
}: {
  interview: ScheduledInterview
  children?: ReactNode | ((current: ScheduledInterview) => ReactNode)
  onConnectionError?: (error: unknown) => void
}) {
  const [current, setCurrent] = useState(interview)

  useDomainEvent<ScheduledInterview>(`scheduled-interviews/${interview.id}`, (event) => {
    if (
      event.type === 'scheduled-interview.created' ||
      event.type === 'scheduled-interview.status-updated' ||
      event.type === 'scheduled-interview.document-updated' ||
      event.type === 'interview-invitation.responded'
    ) {
      setCurrent(event.data)
    }
  })

  useEffect(() => {
    const controller = new AbortController()
    const reportError = (error: unknown) => {
      if (onConnectionError) onConnectionError(error)
      else console.error('interview event stream failed', error)
    }
    void api.scheduledInterviews
      .subscribe(
        interview.id,
        (event) => setCurrent((value) => applyInterviewEvent(value, event)),
        controller.signal,
        reportError,
      )
      .catch((error) => {
        if (!controller.signal.aborted) reportError(error)
      })
    return () => controller.abort()
  }, [interview.id, onConnectionError])

  return (
    <article className="meeting-card">
      <div>
        <span className={`status status-${current.status}`}>{current.status}</span>
        <h2>{current.participantName}</h2>
        <p>{current.jobTitle}</p>
      </div>
      <DateAndPlace interview={current} />
      {typeof children === 'function' ? children(current) : children}
    </article>
  )
}
