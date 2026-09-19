import { CalendarDays, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ParticipantMeeting, ScheduledInterview } from '../../../types'

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
}: {
  interview: ScheduledInterview
  children?: ReactNode
}) {
  return (
    <article className="meeting-card">
      <div>
        <span className={`status status-${interview.status}`}>{interview.status}</span>
        <h2>{interview.participantName}</h2>
        <p>{interview.jobTitle}</p>
      </div>
      <DateAndPlace interview={interview} />
      {children}
    </article>
  )
}
