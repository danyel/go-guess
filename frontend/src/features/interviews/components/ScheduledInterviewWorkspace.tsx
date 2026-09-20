import { Check, Copy, UsersRound } from 'lucide-react'
import { type FormEvent, type ReactNode } from 'react'
import type { InterviewNote, ScheduledInterview } from '../../../types'

export function InterviewActions({
  interview,
  linkCopied,
  onCopyLink,
  onSetStatus,
}: {
  interview: ScheduledInterview
  linkCopied: boolean
  onCopyLink: () => void
  onSetStatus: (status: string) => void
}) {
  return (
    <div className="session-actions">
      <button
        className="button secondary"
        type="button"
        onClick={onCopyLink}
        aria-label="Copy participant interview link"
      >
        {linkCopied ? <Check size={17} /> : <Copy size={17} />}
        {linkCopied ? 'Link copied' : 'Copy participant link'}
      </button>
      {interview.status !== 'started' && interview.status !== 'completed' && (
        <button className="button primary" type="button" onClick={() => onSetStatus('started')}>
          Start interview
        </button>
      )}
      {interview.status === 'started' && (
        <button className="button primary" type="button" onClick={() => onSetStatus('completed')}>
          Complete interview
        </button>
      )}
    </div>
  )
}

export function SharedDocumentPanel({
  document,
  saving,
  onDocumentChange,
  onSave,
}: {
  document: string
  saving: boolean
  onDocumentChange: (value: string) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="card shared-document" onSubmit={onSave}>
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
          onChange={(event) => onDocumentChange(event.target.value)}
        />
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save shared documentation'}
        </button>
      </div>
    </form>
  )
}

export function NotesPanel({
  notes,
  canAdd,
  onAdd,
}: {
  notes: InterviewNote[]
  canAdd: boolean
  onAdd: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
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
      {canAdd ? (
        <form className="note-form" onSubmit={onAdd}>
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
        <p className="panel-padding muted">Notes can be added while the interview is started.</p>
      )}
    </section>
  )
}

export function AttendeeList({ interview }: { interview: ScheduledInterview }) {
  return (
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
  )
}

export function SessionGrid({ children }: { children: ReactNode }) {
  return <div className="session-grid">{children}</div>
}
