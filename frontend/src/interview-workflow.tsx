import { CalendarDays, Check, MapPin, Plus, UsersRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from './api'
import type { Invitation, ParticipantMeeting, ScheduledInterview, User } from './types'

function message(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong'
}

function ErrorAlert({ error }: { error: string }) {
  return (
    <div className="error-alert" role="alert">
      <strong>Request failed</strong>
      <span>{error}</span>
    </div>
  )
}

function Loading() {
  return (
    <div className="empty-state" role="status">
      <span className="loading-spinner" />
      <p>Loading…</p>
    </div>
  )
}

function DateAndPlace({ interview }: { interview: ScheduledInterview | ParticipantMeeting }) {
  return (
    <div className="meeting-facts">
      <span>
        <CalendarDays size={18} />
        {new Date(interview.startsAt).toLocaleString()}
      </span>
      <span>
        <MapPin size={18} />
        {interview.location}
      </span>
    </div>
  )
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api.users
      .list()
      .then(setUsers)
      .catch((value) => setError(message(value)))
      .finally(() => setLoading(false))
  }, [])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      const created = await api.users.create({
        email: String(values.get('email')),
        password: String(values.get('password')),
        displayName: String(values.get('displayName')),
      })
      setUsers((current) => [...current, created])
      form.reset()
    } catch (value) {
      setError(message(value))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Team access</span>
          <h1>Users</h1>
          <p>Create co-interviewers and manage the people who collaborate on interviews.</p>
        </div>
      </header>
      {error && <ErrorAlert error={error} />}
      <div className="library-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Interview team</h2>
              <p>{users.length} workspace users</p>
            </div>
          </div>
          {loading ? (
            <Loading />
          ) : (
            <div className="user-list">
              {users.map((user) => (
                <article className="user-row" key={user.id}>
                  <span className="avatar">{user.displayName.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{user.displayName}</strong>
                    <small>{user.email}</small>
                  </div>
                  <span className={`status status-${user.role}`}>{user.role}</span>
                </article>
              ))}
            </div>
          )}
        </section>
        <form className="card form-card library-form" onSubmit={create}>
          <div className="form-section">
            <h2>Create co-interviewer</h2>
            <label className="field">
              <span className="field-label">Display name</span>
              <input name="displayName" required autoComplete="name" />
            </label>
            <label className="field">
              <span className="field-label">Email address</span>
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label className="field">
              <span className="field-label">Temporary password</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <button className="button primary wide" type="submit" disabled={saving}>
              <Plus size={18} /> {saving ? 'Creating…' : 'Create co-interviewer'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export function ScheduleInterviewForm({
  jobId,
  invitation,
  onCreated,
  onCancel,
}: {
  jobId: number
  invitation: Invitation
  onCreated: (interview: ScheduledInterview) => void
  onCancel: () => void
}) {
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api.users
      .list()
      .then(setUsers)
      .catch((value) => setError(message(value)))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    try {
      const startsAt = new Date(String(values.get('startsAt'))).toISOString()
      onCreated(
        await api.jobs.scheduleInterview(jobId, {
          invitationId: invitation.id,
          startsAt,
          location: String(values.get('location')),
          interviewerIds: selected,
          sharedDocument: String(values.get('sharedDocument')),
        }),
      )
    } catch (value) {
      setError(message(value))
      setSaving(false)
    }
  }

  return (
    <form
      className="schedule-form"
      onSubmit={submit}
      aria-label={`Schedule ${invitation.participantName}`}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">Passed assessment</span>
          <h2>Schedule interview with {invitation.participantName}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onCancel}
          aria-label="Close scheduling form"
        >
          <X />
        </button>
      </div>
      <div className="form-section">
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Date and time</span>
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label className="field">
            <span className="field-label">Location or meeting link</span>
            <input name="location" required />
          </label>
        </div>
        <fieldset className="interviewer-picker">
          <legend className="field-label">Co-interviewers</legend>
          {users.map((user) => (
            <label key={user.id}>
              <input
                type="checkbox"
                checked={selected.includes(user.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, user.id]
                      : current.filter((id) => id !== user.id),
                  )
                }
              />
              <span>
                <strong>{user.displayName}</strong>
                <small>{user.email}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="field shared-document-field">
          <span className="field-label">Shared documentation</span>
          <textarea
            name="sharedDocument"
            rows={10}
            required
            placeholder="Add the agenda, exercise, links, and information shared with the candidate…"
          />
        </label>
        {error && <ErrorAlert error={error} />}
        <div className="question-form-actions">
          <button className="button ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? 'Scheduling…' : 'Create interview'}
          </button>
        </div>
      </div>
    </form>
  )
}

function InterviewCard({
  interview,
  children,
}: {
  interview: ScheduledInterview
  children?: React.ReactNode
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

export function InboxPage() {
  const [items, setItems] = useState<ScheduledInterview[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.inbox
      .list()
      .then(setItems)
      .catch((value) => setError(message(value)))
      .finally(() => setLoading(false))
  }, [])

  async function respond(id: number, status: 'accepted' | 'declined') {
    setError('')
    try {
      const updated = await api.inbox.respond(id, status)
      setItems((current) => current.map((item) => (item.id === id ? updated : item)))
    } catch (value) {
      setError(message(value))
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Invitations</span>
          <h1>Inbox</h1>
          <p>Respond to interview invitations assigned to you.</p>
        </div>
      </header>
      {error && <ErrorAlert error={error} />}
      {loading ? (
        <Loading />
      ) : (
        <section className="meeting-list">
          {items.map((item) => (
            <InterviewCard interview={item} key={item.id}>
              <div className="meeting-actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={() => void respond(item.id, 'accepted')}
                >
                  <Check size={17} /> Accept
                </button>
                <button
                  className="button secondary danger"
                  type="button"
                  onClick={() => void respond(item.id, 'declined')}
                >
                  <X size={17} /> Decline
                </button>
              </div>
            </InterviewCard>
          ))}
          {!items.length && (
            <div className="card empty-state">
              <h3>Inbox zero</h3>
              <p>You have no interview invitations.</p>
            </div>
          )}
        </section>
      )}
    </>
  )
}

export function CalendarPage() {
  const [items, setItems] = useState<ScheduledInterview[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    void api
      .calendar()
      .then(setItems)
      .catch((value) => setError(message(value)))
      .finally(() => setLoading(false))
  }, [])
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
          <span className="eyebrow">Schedule</span>
          <h1>Calendar</h1>
          <p>Your accepted and organized interviews, grouped by date.</p>
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
                <InterviewCard interview={item} key={item.id}>
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

export function ScheduledInterviewPage() {
  const id = Number(useParams().id)
  const [interview, setInterview] = useState<ScheduledInterview>()
  const [document, setDocument] = useState('')
  const [notes, setNotes] = useState<ScheduledInterview['notes']>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([api.scheduledInterviews.get(id), api.scheduledInterviews.notes(id)])
      .then(([item, loadedNotes]) => {
        if (!active) return
        setInterview(item)
        setDocument(item.sharedDocument)
        setNotes(loadedNotes)
      })
      .catch((value) => active && setError(message(value)))
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (interview?.status !== 'started') return
    const controller = new AbortController()
    void api.scheduledInterviews
      .subscribe(
        id,
        (note) => {
          setNotes((current) =>
            current.some((item) => item.id === note.id) ? current : [...current, note],
          )
        },
        controller.signal,
      )
      .catch((value) => {
        if (!controller.signal.aborted) setError(message(value))
      })
    return () => controller.abort()
  }, [id, interview?.status])

  async function setStatus(status: string) {
    setError('')
    try {
      setInterview(await api.scheduledInterviews.setStatus(id, status))
    } catch (value) {
      setError(message(value))
    }
  }

  async function saveDocument(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      setInterview(await api.scheduledInterviews.updateDocument(id, document))
    } catch (value) {
      setError(message(value))
    } finally {
      setSaving(false)
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = String(new FormData(form).get('body')).trim()
    if (!body) return
    try {
      const note = await api.scheduledInterviews.addNote(id, body)
      setNotes((current) =>
        current.some((item) => item.id === note.id) ? current : [...current, note],
      )
      form.reset()
    } catch (value) {
      setError(message(value))
    }
  }

  if (!interview && !error) return <Loading />
  if (!interview) return <ErrorAlert error={error} />
  return (
    <>
      <Link className="back-link" to="/calendar">
        ← Calendar
      </Link>
      <header className="page-header">
        <div>
          <span className="eyebrow">Interviewer session</span>
          <h1>{interview.participantName}</h1>
          <p>{interview.jobTitle}</p>
        </div>
        <span className={`status status-${interview.status}`}>{interview.status}</span>
      </header>
      {error && <ErrorAlert error={error} />}
      <DateAndPlace interview={interview} />
      <div className="session-actions">
        {interview.status !== 'started' && interview.status !== 'completed' && (
          <button
            className="button primary"
            type="button"
            onClick={() => void setStatus('started')}
          >
            Start interview
          </button>
        )}
        {interview.status === 'started' && (
          <button
            className="button primary"
            type="button"
            onClick={() => void setStatus('completed')}
          >
            Complete interview
          </button>
        )}
      </div>
      <div className="session-grid">
        <form className="card shared-document" onSubmit={saveDocument}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Visible to candidate</span>
              <h2>Shared documentation</h2>
            </div>
          </div>
          <div className="form-section">
            <textarea
              aria-label="Shared documentation"
              rows={18}
              value={document}
              onChange={(event) => setDocument(event.target.value)}
            />
            <button className="button primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save shared documentation'}
            </button>
          </div>
        </form>
        <section className="card notes-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Interviewers only</span>
              <h2>Live notes</h2>
            </div>
          </div>
          <div className="notes-list" aria-live="polite">
            {notes.map((note) => (
              <article className="note" key={note.id}>
                <strong>{note.authorName}</strong>
                <time>{new Date(note.createdAt).toLocaleTimeString()}</time>
                <p>{note.body}</p>
              </article>
            ))}
          </div>
          {interview.status === 'started' ? (
            <form className="note-form" onSubmit={addNote}>
              <label className="sr-only" htmlFor="interview-note">
                Add a note
              </label>
              <textarea
                id="interview-note"
                name="body"
                rows={3}
                required
                placeholder="Add a private interviewer note…"
              />
              <button className="button primary" type="submit">
                Post note
              </button>
            </form>
          ) : (
            <p className="panel-padding muted">
              Notes can be added while the interview is started.
            </p>
          )}
        </section>
      </div>
      <section className="card attendee-section">
        <div className="section-heading">
          <div>
            <h2>Attendees</h2>
            <p>Interview team and response status.</p>
          </div>
        </div>
        <div className="user-list">
          {interview.attendees.map((attendee) => (
            <article className="user-row" key={attendee.userId}>
              <UsersRound />
              <div>
                <strong>{attendee.displayName}</strong>
                <small>{attendee.email}</small>
              </div>
              <span className={`status status-${attendee.status}`}>{attendee.status}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

export function ParticipantMeetingPage() {
  const token = useParams().token ?? ''
  const [meeting, setMeeting] = useState<ParticipantMeeting>()
  const [error, setError] = useState('')
  useEffect(() => {
    void api.participantMeetings
      .get(token)
      .then(setMeeting)
      .catch((value) => setError(message(value)))
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
