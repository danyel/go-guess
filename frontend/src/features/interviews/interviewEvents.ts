import type { InterviewEvent, ScheduledInterview } from '../../types'

export function applyInterviewEvent(
  interview: ScheduledInterview,
  event: InterviewEvent,
): ScheduledInterview {
  if (event.type === 'status.updated') return { ...interview, status: event.status }
  if (event.type === 'document.updated') {
    return { ...interview, sharedDocument: event.sharedDocument }
  }
  if (event.type === 'attendee.updated') {
    return {
      ...interview,
      attendees: interview.attendees.map((attendee) =>
        attendee.userId === event.attendee.userId ? event.attendee : attendee,
      ),
    }
  }
  return interview
}
