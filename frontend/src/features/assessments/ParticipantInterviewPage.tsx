import { ArrowLeft, ArrowRight, Check, CircleHelp, Clock3 } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { ErrorAlert, errorMessage, Loading } from '../../components/actions'
import Logo from '../../components/layout/Logo'
import type { Interview } from '../../types'
import { CodeReviewAnswer } from './CodeReview'
import { NotFound } from '../../components/ui/NotFound'

export function ParticipantInterviewPage() {
  const token = useParams().invitationId ?? ''
  const [interview, setInterview] = useState<Interview>()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const finishing = useRef(false)
  const saveQueues = useRef<Record<string, Promise<void>>>({})

  useEffect(() => {
    let active = true
    void api.interviews
      .get(token)
      .then((value) => {
        if (!active) return
        setInterview(value)
        setAnswers(value.answers ?? {})
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  const acceptedAt = interview?.invitation.acceptedAt
  const durationMinutes = interview?.job.durationMinutes
  useEffect(() => {
    if (!acceptedAt || !durationMinutes || interview?.invitation.completedAt) return
    const update = () => {
      const deadline = new Date(acceptedAt).getTime() + durationMinutes * 60_000
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    }
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [acceptedAt, durationMinutes, interview?.invitation.completedAt])

  async function accept() {
    setWorking(true)
    setError('')
    try {
      const accepted = await api.interviews.accept(token)
      setInterview(accepted)
      setAnswers(accepted.answers ?? {})
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setWorking(false)
    }
  }

  const questions = interview?.job.questions ?? []
  const currentQuestion = questions[index]

  function updateAnswer(questionId: number, answer: string) {
    const key = String(questionId)
    setAnswers((current) => ({ ...current, [key]: answer }))
    setError('')
    const previous = saveQueues.current[key] ?? Promise.resolve()
    saveQueues.current[key] = previous
      .then(() => api.interviews.answer(token, questionId, answer))
      .catch((requestError) => {
        setError(errorMessage(requestError))
      })
  }

  async function persistCurrent() {
    if (!currentQuestion) return
    await saveQueues.current[String(currentQuestion.id)]
  }

  async function move(target: number) {
    setWorking(true)
    setError('')
    try {
      await persistCurrent()
      setIndex(Math.max(0, Math.min(target, questions.length - 1)))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setWorking(false)
    }
  }

  async function finish() {
    if (finishing.current) return
    finishing.current = true
    setWorking(true)
    setError('')
    try {
      await persistCurrent()
      setInterview(await api.interviews.finish(token))
    } catch (requestError) {
      finishing.current = false
      setError(errorMessage(requestError))
    } finally {
      setWorking(false)
    }
  }

  if (loading)
    return (
      <PublicInterviewShell>
        <Loading />
      </PublicInterviewShell>
    )
  if (error && !interview)
    return (
      <PublicInterviewShell>
        <ErrorAlert message={error} />
      </PublicInterviewShell>
    )
  if (!interview)
    return (
      <PublicInterviewShell>
        <NotFound />
      </PublicInterviewShell>
    )

  if (interview.invitation.completedAt || interview.invitation.status === 'completed') {
    return (
      <PublicInterviewShell>
        <section className="interview-card completion-card">
          <span className="completion-mark">
            <Check />
          </span>
          <span className="eyebrow">Interview complete</span>
          <h1>Thank you, {interview.invitation.participantName}.</h1>
          <p>Your answers have been submitted. You may now close this page.</p>
        </section>
      </PublicInterviewShell>
    )
  }

  if (!interview.invitation.acceptedAt) {
    return (
      <PublicInterviewShell>
        <section className="interview-card welcome-card">
          <span className="eyebrow">Interview invitation</span>
          <h1>Welcome, {interview.invitation.participantName}</h1>
          <h2>{interview.job.title}</h2>
          <p>{interview.job.description}</p>
          <p className="agreement-copy">
            By accepting, you agree to begin the timed interview and submit your responses.
          </p>
          <div className="welcome-facts">
            <span>
              <Clock3 size={18} /> {interview.job.durationMinutes} minutes
            </span>
            <span>
              <CircleHelp size={18} /> {questions.length} questions
            </span>
          </div>
          {error && <ErrorAlert message={error} />}
          <button className="button primary" type="button" disabled={working} onClick={accept}>
            {working ? 'Accepting…' : 'Accept'}
            <ArrowRight size={18} />
          </button>
        </section>
      </PublicInterviewShell>
    )
  }

  if (!currentQuestion) {
    return (
      <PublicInterviewShell>
        <section className="interview-card welcome-card">
          <h1>No interview questions</h1>
          <p>This interview does not contain any questions.</p>
          <button className="button primary" type="button" onClick={() => void finish()}>
            Finish
          </button>
        </section>
      </PublicInterviewShell>
    )
  }

  const answer = answers[String(currentQuestion.id)] ?? ''
  const selectedOptions = answer ? answer.split('\n') : []
  const countdown = remainingSeconds ?? interview.job.durationMinutes * 60
  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60
  const progress = ((index + 1) / questions.length) * 100

  return (
    <PublicInterviewShell>
      <section className="interview-card question-stage">
        <header className="interview-header">
          <div>
            <span className="eyebrow">{interview.job.title}</span>
            <strong>
              Question {index + 1} of {questions.length}
            </strong>
          </div>
          <time className={countdown < 60 ? 'timer urgent' : 'timer'}>
            <Clock3 size={18} />
            <span data-testid="countdown">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </time>
        </header>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Interview progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="interview-question">
          <span className="question-type">{currentQuestion.type.replace('_', ' ')}</span>
          <h1>{currentQuestion.text}</h1>
          {currentQuestion.type === 'radio' ? (
            <fieldset className="participant-options">
              <legend className="sr-only">Choose one answer</legend>
              {currentQuestion.options.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={answer === option}
                    onChange={() => updateAnswer(currentQuestion.id, option)}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ) : currentQuestion.type === 'multiple_choice' ? (
            <fieldset className="participant-options">
              <legend className="sr-only">Choose one or more answers</legend>
              {currentQuestion.options.map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selectedOptions, option]
                        : selectedOptions.filter((item) => item !== option)
                      updateAnswer(currentQuestion.id, next.join('\n'))
                    }}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ) : currentQuestion.type === 'code_review' ? (
            <CodeReviewAnswer
              codeSnippet={currentQuestion.codeSnippet}
              answer={answer}
              onChange={(value) => updateAnswer(currentQuestion.id, value)}
            />
          ) : (
            <label>
              <span className="sr-only">Your answer</span>
              <textarea
                aria-label="Your answer"
                rows={7}
                value={answer}
                onChange={(event) => updateAnswer(currentQuestion.id, event.target.value)}
                placeholder="Type your answer…"
              />
            </label>
          )}
        </div>
        {error && <ErrorAlert message={error} />}
        <footer className="interview-controls">
          <button
            className="button ghost"
            type="button"
            disabled={working || index === 0}
            onClick={() => void move(0)}
          >
            First
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={working || index === 0}
            onClick={() => void move(index - 1)}
          >
            <ArrowLeft size={17} /> Previous
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={working || index === questions.length - 1}
            onClick={() => void move(index + 1)}
          >
            Next <ArrowRight size={17} />
          </button>
          <button
            className="button ghost"
            type="button"
            disabled={working || index === questions.length - 1}
            onClick={() => void move(questions.length - 1)}
          >
            Last
          </button>
          <button
            className="button primary"
            type="button"
            disabled={working}
            onClick={() => void finish()}
          >
            Submit
          </button>
        </footer>
      </section>
    </PublicInterviewShell>
  )
}

function PublicInterviewShell({ children }: { children: ReactNode }) {
  return (
    <main className="public-interview">
      <header>
        <Logo />
      </header>
      {children}
    </main>
  )
}
