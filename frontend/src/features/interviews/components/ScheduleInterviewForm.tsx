import { CalendarDays, FileText, MapPin, UsersRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { api, ApiError, authStorage } from '../../../api/client'
import type { Invitation, ScheduledInterview, User } from '../../../types'

interface ScheduleInterviewFormProps {
  jobId: number
  invitation: Invitation
  onCreated: (interview: ScheduledInterview) => void
  onCancel: () => void
}

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong'
}

export function ScheduleInterviewForm({
  jobId,
  invitation,
  onCreated,
  onCancel,
}: ScheduleInterviewFormProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [error, setError] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void api.users
      .list()
      .then((items) => {
        if (active) {
          const currentUserId = authStorage.user()?.id
          setUsers(items.filter((user) => user.id !== currentUserId))
        }
      })
      .catch((value) => {
        if (active) setError(errorMessage(value))
      })
      .finally(() => {
        if (active) setLoadingUsers(false)
      })
    return () => {
      active = false
    }
  }, [])

  function toggleInterviewer(userId: number, checked: boolean) {
    setSelected((current) =>
      checked ? [...new Set([...current, userId])] : current.filter((id) => id !== userId),
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setSaving(true)
    setError('')
    try {
      const startsAt = new Date(String(values.get('startsAt'))).toISOString()
      const interview = await api.jobs.scheduleInterview(jobId, {
        invitationId: invitation.id,
        startsAt,
        location: String(values.get('location')),
        interviewerIds: selected,
        sharedDocument: String(values.get('sharedDocument')),
      })
      onCreated(interview)
    } catch (value) {
      setError(errorMessage(value))
      setSaving(false)
    }
  }

  return (
    <form
      className="schedule-form"
      onSubmit={submit}
      aria-label={`Schedule ${invitation.participantName}`}
    >
      <header className="schedule-form-header">
        <div>
          <span className="eyebrow">Passed assessment</span>
          <h2>Schedule interview</h2>
          <p>
            Set up the next conversation with <strong>{invitation.participantName}</strong>.
          </p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onCancel}
          aria-label="Close scheduling form"
        >
          <X />
        </button>
      </header>

      <div className="schedule-form-layout">
        <section className="schedule-form-details" aria-labelledby="schedule-details-title">
          <div className="schedule-form-section-heading">
            <CalendarDays aria-hidden="true" />
            <div>
              <h3 id="schedule-details-title">Interview details</h3>
              <p>Choose when and where the interview takes place.</p>
            </div>
          </div>
          <div className="schedule-form-fields">
            <label className="field">
              <span className="field-label">Date and time</span>
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label className="field">
              <span className="field-label">Location or meeting link</span>
              <span className="input-with-icon">
                <MapPin aria-hidden="true" />
                <input name="location" required placeholder="Meeting room or https://…" />
              </span>
            </label>
          </div>

          <label className="field schedule-document-field">
            <span className="schedule-field-heading">
              <FileText aria-hidden="true" />
              <span>
                <strong>Shared documentation</strong>
                <small>Visible to the candidate and all interviewers</small>
              </span>
            </span>
            <textarea
              name="sharedDocument"
              aria-label="Shared documentation"
              rows={8}
              required
              placeholder="Add the agenda, exercise, preparation links, and other shared information…"
            />
          </label>
        </section>

        <aside className="schedule-team-panel" aria-labelledby="schedule-team-title">
          <div className="schedule-form-section-heading">
            <UsersRound aria-hidden="true" />
            <div>
              <h3 id="schedule-team-title">Interview team</h3>
              <p>The organizer is included automatically.</p>
            </div>
          </div>
          <fieldset className="interviewer-picker" disabled={loadingUsers}>
            <legend className="sr-only">Select co-interviewers</legend>
            {loadingUsers && <p className="muted">Loading team members…</p>}
            {!loadingUsers && users.length === 0 && (
              <p className="muted">No co-interviewers are available yet.</p>
            )}
            {users.map((user) => {
              const checked = selected.includes(user.id)
              return (
                <label className={checked ? 'selected' : ''} key={user.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleInterviewer(user.id, event.target.checked)}
                  />
                  <span className="avatar" aria-hidden="true">
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="interviewer-details">
                    <strong>{user.displayName}</strong>
                    <small>{user.email}</small>
                  </span>
                </label>
              )
            })}
          </fieldset>
          <p className="schedule-team-summary" aria-live="polite">
            {selected.length === 0
              ? 'No additional interviewers selected'
              : `${selected.length} co-interviewer${selected.length === 1 ? '' : 's'} selected`}
          </p>
        </aside>
      </div>

      {error && (
        <div className="schedule-form-error" role="alert">
          <strong>Could not schedule interview</strong>
          <span>{error}</span>
        </div>
      )}
      <footer className="schedule-form-actions">
        <button className="button ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary" type="submit" disabled={saving}>
          <CalendarDays size={17} />
          {saving ? 'Scheduling…' : 'Create interview'}
        </button>
      </footer>
    </form>
  )
}
