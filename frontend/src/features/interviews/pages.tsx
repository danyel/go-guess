import {Check, Copy, UsersRound, X} from 'lucide-react'
import {type FormEvent, useEffect, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {api} from '../../api/client'
import type {ParticipantMeeting, ScheduledInterview} from '../../types'
import {ErrorAlert, Loading} from '../../components/ui/AsyncState'
import {DateAndPlace, InterviewCard} from './components/InterviewCard'
import {message} from "../../components/actions";

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
            {error && <ErrorAlert error={error}/>}
            {loading ? (
                <Loading/>
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
                                    <Check size={17}/> Accept
                                </button>
                                <button
                                    className="button secondary danger"
                                    type="button"
                                    onClick={() => void respond(item.id, 'declined')}
                                >
                                    <X size={17}/> Decline
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


export function ScheduledInterviewPage() {
    const id = Number(useParams().id)
    const [interview, setInterview] = useState<ScheduledInterview>()
    const [document, setDocument] = useState('')
    const [notes, setNotes] = useState<ScheduledInterview['notes']>([])
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [linkCopied, setLinkCopied] = useState(false)
    const loadedInterviewID = interview?.id

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
        if (!loadedInterviewID) return
        const controller = new AbortController()
        void api.scheduledInterviews
            .subscribe(
                id,
                (event) => {
                    if (event.type === 'note.created') {
                        setNotes((current) =>
                            current.some((item) => item.id === event.note.id)
                                ? current
                                : [...current, event.note],
                        )
                    }
                    if (event.type === 'document.updated') {
                        setDocument(event.sharedDocument)
                        setInterview((current) =>
                            current ? {...current, sharedDocument: event.sharedDocument} : current,
                        )
                    }
                },
                controller.signal,
                (value) => setError(message(value)),
            )
            .catch((value) => {
                if (!controller.signal.aborted) setError(message(value))
            })
        return () => controller.abort()
    }, [id, loadedInterviewID])

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

    async function copyParticipantLink(url: string) {
        setError('')
        try {
            await navigator.clipboard.writeText(url)
            setLinkCopied(true)
        } catch {
            setError('Could not copy the participant interview link')
        }
    }

    if (!interview && !error) return <Loading/>
    if (!interview) return <ErrorAlert error={error}/>
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
            {error && <ErrorAlert error={error}/>}
            <DateAndPlace interview={interview}/>
            <div className="session-actions">
                <button
                    className="button secondary"
                    type="button"
                    onClick={() => void copyParticipantLink(interview.candidateUrl)}
                    aria-label="Copy participant interview link"
                >
                    {linkCopied ? <Check size={17}/> : <Copy size={17}/>}
                    {linkCopied ? 'Link copied' : 'Copy participant link'}
                </button>
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
                            <UsersRound/>
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
        let active = true
        let latestDocument: string | undefined
        const controller = new AbortController()
        void api.participantMeetings
            .subscribe(
                token,
                (event) => {
                    if (event.type !== 'document.updated') return
                    latestDocument = event.sharedDocument
                    setMeeting((current) =>
                        current ? {...current, sharedDocument: event.sharedDocument} : current,
                    )
                },
                controller.signal,
                (value) => {
                    if (active) setError(message(value))
                },
            )
            .catch((value) => {
                if (active && !controller.signal.aborted) setError(message(value))
            })
        void api.participantMeetings
            .get(token)
            .then((value) => {
                if (active) {
                    setMeeting({
                        ...value,
                        sharedDocument: latestDocument ?? value.sharedDocument,
                    })
                }
            })
            .catch((value) => {
                if (active) setError(message(value))
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
                    <Loading/>
                </section>
            )}
            {error && (
                <section className="interview-card">
                    <ErrorAlert error={error}/>
                </section>
            )}
            {meeting && (
                <section className="interview-card meeting-public-card">
                    <span className="eyebrow">Your scheduled interview</span>
                    <h1>{meeting.jobTitle}</h1>
                    <p>Welcome, {meeting.participantName}.</p>
                    <span className={`status status-${meeting.status}`}>{meeting.status}</span>
                    <DateAndPlace interview={meeting}/>
                    <section className="public-document" aria-labelledby="shared-document-title">
                        <h2 id="shared-document-title">Shared documentation</h2>
                        <div>{meeting.sharedDocument || 'No shared documentation has been added yet.'}</div>
                    </section>
                </section>
            )}
        </main>
    )
}
