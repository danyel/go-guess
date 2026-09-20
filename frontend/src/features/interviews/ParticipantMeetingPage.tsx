import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { errorMessage } from '../../components/actions'
import { ErrorAlert, Loading } from '../../components/ui/AsyncState'
import type { ParticipantMeeting } from '../../types'
import { DateAndPlace } from './components/InterviewCard'

export function ParticipantMeetingPage() {
  const token = useParams().token ?? ''
  const [meeting, setMeeting] = useState<ParticipantMeeting>()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let latestDocument: string | undefined
    let latestStatus: string | undefined
    const controller = new AbortController()
    void api.participantMeetings
      .subscribe(
        token,
        (event) => {
          if (event.type === 'document.updated') latestDocument = event.sharedDocument
          if (event.type === 'status.updated') latestStatus = event.status
          setMeeting((current) => {
            if (!current) return current
            if (event.type === 'document.updated') {
              return { ...current, sharedDocument: event.sharedDocument }
            }
            if (event.type === 'status.updated') return { ...current, status: event.status }
            return current
          })
        },
        controller.signal,
        (value) => {
          if (active) setError(errorMessage(value))
        },
      )
      .catch((value) => {
        if (active && !controller.signal.aborted) setError(errorMessage(value))
      })
    void api.participantMeetings
      .get(token)
      .then((value) => {
        if (active) {
          setMeeting({
            ...value,
            status: latestStatus ?? value.status,
            sharedDocument: latestDocument ?? value.sharedDocument,
          })
        }
      })
      .catch((value) => {
        if (active) setError(errorMessage(value))
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [token])

  return (
    <main className="public-interview">
      <header>
        <Link className="logo" to="/" aria-label="Go Guess home">
          <span className="logo-mark">G</span>
          <span>
            <strong>GO GUESS</strong>
            <small>Talent workspace</small>
          </span>
        </Link>
      </header>
      {!meeting && !error && (
        <section className="interview-card">
          <Loading />
        </section>
      )}
      {error && (
        <section className="interview-card">
          <ErrorAlert error={error} />
        </section>
      )}
      {meeting && (
        <section className="interview-card meeting-public-card">
          <span className="eyebrow">Your scheduled interview</span>
          <h1>{meeting.jobTitle}</h1>
          <p>Welcome, {meeting.participantName}.</p>
          <span className={`status status-${meeting.status}`}>{meeting.status}</span>
          <DateAndPlace interview={meeting} />
          <section className="public-document" aria-labelledby="shared-document-title">
            <h2 id="shared-document-title">Shared documentation</h2>
            <div>{meeting.sharedDocument || 'No shared documentation has been added yet.'}</div>
          </section>
        </section>
      )}
    </main>
  )
}
