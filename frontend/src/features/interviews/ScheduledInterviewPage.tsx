import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useDomainEvent } from '../../app/useDomainEvent'
import { errorMessage } from '../../components/actions'
import { ErrorAlert, Loading } from '../../components/ui/AsyncState'
import type { InterviewEvent, InterviewNote, ScheduledInterview } from '../../types'
import { DateAndPlace } from './components/InterviewCard'
import {
  AttendeeList,
  InterviewActions,
  NotesPanel,
  SessionGrid,
  SharedDocumentPanel,
} from './components/ScheduledInterviewWorkspace'
import { applyInterviewEvent } from './interviewEvents'

export function ScheduledInterviewPage() {
  const id = Number(useParams().id)
  const [interview, setInterview] = useState<ScheduledInterview>()
  const [document, setDocument] = useState('')
  const [notes, setNotes] = useState<InterviewNote[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([api.scheduledInterviews.get(id), api.scheduledInterviews.notes(id)])
      .then(([item, loadedNotes]) => {
        if (!active) return
        setInterview(item)
        setDocument(item.sharedDocument)
        setNotes(loadedNotes)
      })
      .catch((value) => active && setError(errorMessage(value)))
    return () => {
      active = false
    }
  }, [id])

  useDomainEvent<ScheduledInterview>(`scheduled-interviews/${id}`, (event) => {
    if (event.type === 'scheduled-interview.note-created') return
    setInterview(event.data)
    setDocument(event.data.sharedDocument)
  })

  useDomainEvent<InterviewNote>(`scheduled-interviews/${id}/notes`, (event) => {
    setNotes((current) =>
      current.some((note) => note.id === event.data.id) ? current : [...current, event.data],
    )
  })

  const interviewLoaded = interview !== undefined
  useEffect(() => {
    if (!interviewLoaded) return
    const controller = new AbortController()
    void api.scheduledInterviews
      .subscribe(
        id,
        (event) => {
          setInterview((current) => (current ? applyInterviewEvent(current, event) : current))
          applyContentEvent(event, setDocument, setNotes)
        },
        controller.signal,
        (value) => setError(errorMessage(value)),
      )
      .catch((value) => {
        if (!controller.signal.aborted) setError(errorMessage(value))
      })
    return () => controller.abort()
  }, [id, interviewLoaded])

  async function setStatus(status: string) {
    setError('')
    try {
      await api.scheduledInterviews.setStatus(id, status)
    } catch (value) {
      setError(errorMessage(value))
    }
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.scheduledInterviews.updateDocument(id, document)
    } catch (value) {
      setError(errorMessage(value))
    } finally {
      setSaving(false)
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = String(new FormData(form).get('body')).trim()
    if (!body) return
    setError('')
    try {
      await api.scheduledInterviews.addNote(id, body)
      form.reset()
    } catch (value) {
      setError(errorMessage(value))
    }
  }

  async function copyParticipantLink() {
    if (!interview) return
    setError('')
    try {
      await navigator.clipboard.writeText(interview.candidateUrl)
      setLinkCopied(true)
    } catch {
      setError('Could not copy the participant interview link')
    }
  }

  if (!interview && !error) return <Loading />
  if (!interview) return <ErrorAlert error={error} />

  return (
    <>
      <Link className="back-link" to="/schedule">
        ← Schedule
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
      <InterviewActions
        interview={interview}
        linkCopied={linkCopied}
        onCopyLink={() => void copyParticipantLink()}
        onSetStatus={(status) => void setStatus(status)}
      />
      <SessionGrid>
        <SharedDocumentPanel
          document={document}
          saving={saving}
          onDocumentChange={setDocument}
          onSave={saveDocument}
        />
        <NotesPanel notes={notes} canAdd={interview.status === 'started'} onAdd={addNote} />
      </SessionGrid>
      <AttendeeList interview={interview} />
    </>
  )
}

function applyContentEvent(
  event: InterviewEvent,
  setDocument: (value: string) => void,
  setNotes: Dispatch<SetStateAction<InterviewNote[]>>,
) {
  if (event.type === 'document.updated') setDocument(event.sharedDocument)
  if (event.type === 'note.created') {
    setNotes((current) =>
      current.some((note) => note.id === event.note.id) ? current : [...current, event.note],
    )
  }
}
