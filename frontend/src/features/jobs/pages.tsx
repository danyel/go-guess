import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { ErrorAlert, errorMessage, Loading } from '../../components/actions'
import { FormActions, FormField } from '../../components/form'
import { EmptyState, Fact, Metric, StatusBadge } from '../../components/ui/Display'
import { NotFound } from '../../components/ui/NotFound'
import { PageHeader } from '../../components/ui/PageHeader'
import { useData } from '../../app/useData'
import { CodePanel } from '../assessments/CodeReview'
import { ScheduleInterviewForm } from '../interviews'
import { Avatar, SkillList } from '../participants'
import type {
  CandidateMatch,
  Interview,
  Invitation,
  Job,
  JobStatus,
  Question,
  ScheduledInterview,
} from '../../types'

export function JobsPage() {
  const { jobs, loading, error, reload } = useData()
  const [query, setQuery] = useState('')
  const filtered = jobs.filter((job) =>
    `${job.title} ${job.position} ${job.seniority} ${job.labels.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHeader
        eyebrow="Recruitment"
        title="Job postings"
        description="Create roles, build assessments, and compare candidate fit."
        action={
          <Link to="/jobs/new" className="button primary">
            <Plus size={18} /> Create job
          </Link>
        }
      />
      {error && <ErrorAlert message={error} retry={reload} />}
      <section className="metrics">
        <Metric label="Job postings" value={String(jobs.length)} />
        <Metric label="Participants" value="—" />
        <Metric
          label="Assessments"
          value={String(jobs.reduce((sum, job) => sum + job.questions.length, 0))}
        />
      </section>
      <section className="card">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <span className="sr-only">Search jobs</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search jobs…"
            />
          </label>
          <span className="result-count">{filtered.length} jobs</span>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Seniority</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Questions</th>
                  <th>
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link className="table-title" to={`/jobs/${job.id}`}>
                        {job.title}
                      </Link>
                      <small>{job.labels.join(' · ') || 'No labels'}</small>
                    </td>
                    <td>
                      <StatusBadge value={job.seniority} />
                    </td>
                    <td>{job.position}</td>
                    <td>
                      <StatusBadge value={job.status} />
                    </td>
                    <td>{job.questions.length}</td>
                    <td>
                      <Link
                        className="icon-link"
                        to={`/jobs/${job.id}`}
                        aria-label={`View ${job.title}`}
                      >
                        <ChevronRight />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !filtered.length && !error && (
          <EmptyState title="No jobs found" description="Create a job or adjust your search." />
        )}
      </section>
    </>
  )
}

export function JobDetailPage() {
  const id = Number(useParams().jobId)
  const [job, setJob] = useState<Job>()
  const [matches, setMatches] = useState<CandidateMatch[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'questions' | 'candidates' | 'invitations'>(
    'overview',
  )

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [jobValue, candidates, invitationItems, scheduledItems] = await Promise.all([
        api.jobs.get(id),
        api.jobs.candidates(id),
        api.jobs.invitations(id),
        api.jobs.interviews(id),
      ])
      setJob(jobValue)
      setMatches(candidates)
      setInvitations(invitationItems)
      setScheduledInterviews(scheduledItems)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([
      api.jobs.get(id),
      api.jobs.candidates(id),
      api.jobs.invitations(id),
      api.jobs.interviews(id),
    ])
      .then(([jobValue, candidates, invitationItems, scheduledItems]) => {
        if (!active) return
        setJob(jobValue)
        setMatches(candidates)
        setInvitations(invitationItems)
        setScheduledInterviews(scheduledItems)
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])
  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} retry={load} />
  if (!job) return <NotFound />

  return (
    <>
      <Link className="back-link" to="/jobs">
        <ArrowLeft size={17} /> All jobs
      </Link>
      <PageHeader
        eyebrow={`${job.seniority} · ${job.position}`}
        title={job.title}
        description={job.description}
      />
      <div className="tabs" role="tablist">
        {(['overview', 'questions', 'candidates', 'invitations'] as const).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? 'active' : ''}
            onClick={() => setTab(item)}
          >
            {item === 'overview'
              ? 'Overview'
              : item === 'questions'
                ? `Questions (${job.questions.length})`
                : item === 'candidates'
                  ? `Candidate match (${matches.length})`
                  : `Invitations (${invitations.length})`}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="detail-grid">
          <section className="card prose">
            <h2>About the role</h2>
            <p>{job.description}</p>
            <h3>Required skills</h3>
            <SkillList skills={job.requiredSkills} />
            <h3>Additional skills</h3>
            <SkillList skills={job.additionalSkills} />
          </section>
          <aside className="card facts">
            <h2>Job details</h2>
            <Fact label="Seniority" value={job.seniority} />
            <Fact label="Position" value={job.position} />
            <Fact label="Status" value={job.status} />
            <Fact label="Duration" value={`${job.durationMinutes} minutes`} />
            <Fact label="Labels" value={job.labels.join(', ') || 'None'} />
            <Fact label="Created" value={new Date(job.createdAt).toLocaleDateString()} />
            <JobSettings job={job} onUpdated={setJob} />
          </aside>
        </div>
      )}
      {tab === 'questions' && <JobQuestionsView job={job} onUpdated={setJob} />}
      {tab === 'candidates' && <CandidateMatchView matches={matches} />}
      {tab === 'invitations' && (
        <InvitationsView
          job={job}
          matches={matches}
          invitations={invitations}
          scheduledInterviews={scheduledInterviews}
          onInvited={(invitation) => setInvitations((current) => [invitation, ...current])}
          onInvitationUpdated={(invitation) =>
            setInvitations((current) =>
              current.map((item) => (item.id === invitation.id ? invitation : item)),
            )
          }
          onScheduled={(interview) => setScheduledInterviews((current) => [interview, ...current])}
        />
      )}
    </>
  )
}

function JobSettings({ job, onUpdated }: { job: Job; onUpdated: (job: Job) => void }) {
  const [status, setStatus] = useState<JobStatus>(job.status)
  const [durationMinutes, setDurationMinutes] = useState(job.durationMinutes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      onUpdated(await api.jobs.update(job.id, { status, durationMinutes }))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inline-settings" onSubmit={save}>
      <FormField label="Interview status" htmlFor="job-status">
        <select
          id="job-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as JobStatus)}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </FormField>
      <FormField label="Duration (minutes)" htmlFor="job-duration">
        <input
          id="job-duration"
          type="number"
          min="1"
          required
          value={durationMinutes}
          onChange={(event) => setDurationMinutes(Number(event.target.value))}
        />
      </FormField>
      {error && <ErrorAlert message={error} />}
      <button className="button secondary wide" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save interview settings'}
      </button>
    </form>
  )
}

function JobQuestionsView({ job, onUpdated }: { job: Job; onUpdated: (job: Job) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Question[]>([])
  const [error, setError] = useState('')
  const attached = new Set(job.questions.map((question) => question.id))

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      void api.questions
        .list(query)
        .then((questions) => {
          if (active) setResults(questions)
        })
        .catch((requestError) => {
          if (active) setError(errorMessage(requestError))
        })
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query])

  async function attach(question: Question) {
    setError('')
    try {
      await api.jobs.attachQuestion(job.id, question.id)
      onUpdated({ ...job, questions: [...job.questions, question] })
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  async function detach(question: Question) {
    setError('')
    try {
      await api.jobs.detachQuestion(job.id, question.id)
      onUpdated({
        ...job,
        questions: job.questions.filter((item) => item.id !== question.id),
      })
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  return (
    <div className="split-panels">
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Assessment questions</h2>
            <p>Detach removes only this job’s link to the library question.</p>
          </div>
        </div>
        <div className="question-list">
          {job.questions.map((question, index) => (
            <QuestionRow
              key={question.id}
              question={question}
              number={index + 1}
              action={
                <button
                  className="button ghost danger"
                  type="button"
                  onClick={() => void detach(question)}
                  aria-label={`Detach ${question.text}`}
                >
                  <Trash2 size={16} /> Detach
                </button>
              }
            />
          ))}
          {!job.questions.length && (
            <EmptyState
              title="No questions yet"
              description="Search the library to attach a question."
            />
          )}
        </div>
      </section>
      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Question library</h2>
            <p>Search reusable, active questions.</p>
          </div>
          <Link className="button secondary" to="/questions">
            Manage library
          </Link>
        </div>
        <div className="panel-padding">
          <label className="search-field">
            <Search size={18} />
            <span className="sr-only">Search question library</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search question library…"
            />
          </label>
          {error && <ErrorAlert message={error} />}
        </div>
        <div className="question-list compact">
          {results
            .filter((question) => !question.deprecated && !attached.has(question.id))
            .map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                action={
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => void attach(question)}
                  >
                    <Plus size={16} /> Attach
                  </button>
                }
              />
            ))}
        </div>
      </section>
    </div>
  )
}

function InvitationsView({
  job,
  matches,
  invitations,
  scheduledInterviews,
  onInvited,
  onInvitationUpdated,
  onScheduled,
}: {
  job: Job
  matches: CandidateMatch[]
  invitations: Invitation[]
  scheduledInterviews: ScheduledInterview[]
  onInvited: (invitation: Invitation) => void
  onInvitationUpdated: (invitation: Invitation) => void
  onScheduled: (interview: ScheduledInterview) => void
}) {
  const [sendingId, setSendingId] = useState<number>()
  const [review, setReview] = useState<Interview>()
  const [reviewingId, setReviewingId] = useState<number>()
  const [error, setError] = useState('')
  const [scheduling, setScheduling] = useState<Invitation>()
  const invitedIds = new Set(invitations.map((invitation) => invitation.participantId))
  const eligible = matches.filter((match) => !invitedIds.has(match.participant.id))

  async function send(participantId: number) {
    setSendingId(participantId)
    setError('')
    try {
      onInvited(await api.jobs.invite(job.id, participantId))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSendingId(undefined)
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      setError('Could not copy the participant URL')
    }
  }

  async function reviewAnswers(invitationId: number) {
    setReviewingId(invitationId)
    setError('')
    try {
      setReview(await api.jobs.invitation(job.id, invitationId))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setReviewingId(undefined)
    }
  }

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Interview invitations</h2>
          <p>Invite an eligible candidate and share their private participant URL.</p>
        </div>
      </div>
      <div className="eligible-list">
        {eligible.map(({ participant }) => (
          <article className="eligible-row" key={participant.id}>
            <Avatar person={participant} />
            <div>
              <strong>
                {participant.firstName} {participant.lastName}
              </strong>
              <small>{participant.email}</small>
            </div>
            <button
              className="button primary"
              type="button"
              disabled={sendingId === participant.id}
              onClick={() => void send(participant.id)}
            >
              <Send size={16} />{' '}
              {sendingId === participant.id ? 'Generating…' : 'Generate invitation'}
            </button>
          </article>
        ))}
        {!eligible.length && <p className="muted">All eligible candidates have been invited.</p>}
      </div>
      {error && <ErrorAlert message={error} />}
      <div className="invitation-list">
        {invitations.map((invitation) => (
          <article className="invitation-row" key={invitation.id}>
            <div>
              <strong>{invitation.participantName}</strong>
              <small>{invitation.participantEmail}</small>
            </div>
            <StatusBadge value={invitation.status} />
            <code>{invitation.participantUrl}</code>
            <button
              className="button secondary"
              type="button"
              onClick={() => void copy(invitation.participantUrl)}
              aria-label={`Copy interview URL for ${invitation.participantName}`}
            >
              <Copy size={16} /> Copy URL
            </button>
            {['accepted', 'completed'].includes(invitation.status) && (
              <button
                className="button secondary"
                type="button"
                disabled={reviewingId === invitation.id}
                onClick={() => void reviewAnswers(invitation.id)}
              >
                {reviewingId === invitation.id ? 'Loading…' : 'Review answers'}
              </button>
            )}
          </article>
        ))}
        {!invitations.length && (
          <EmptyState title="No invitations" description="Invite a candidate to this interview." />
        )}
      </div>
      {review && (
        <InvitationAnswerReview
          interview={review}
          onClose={() => setReview(undefined)}
          onOutcome={(invitation) => {
            onInvitationUpdated(invitation)
            setReview((current) => current && { ...current, invitation })
          }}
        />
      )}
      {scheduling && (
        <ScheduleInterviewForm
          jobId={job.id}
          invitation={scheduling}
          onCancel={() => setScheduling(undefined)}
          onCreated={(interview) => {
            onScheduled(interview)
            setScheduling(undefined)
          }}
        />
      )}
      <div className="scheduled-list">
        {invitations
          .filter((invitation) => invitation.outcome === 'passed')
          .filter(
            (invitation) =>
              !scheduledInterviews.some(
                (interview) => interview.participantId === invitation.participantId,
              ),
          )
          .map((invitation) => (
            <button
              className="button primary"
              type="button"
              key={invitation.id}
              onClick={() => setScheduling(invitation)}
            >
              <CalendarDays size={17} /> Schedule {invitation.participantName}
            </button>
          ))}
        {scheduledInterviews.map((interview) => (
          <Link
            className="scheduled-summary"
            to={`/scheduled-interviews/${interview.id}`}
            key={interview.id}
          >
            <span>
              <strong>{interview.participantName}</strong>
              <small>
                {new Date(interview.startsAt).toLocaleString()} · {interview.location}
              </small>
            </span>
            <StatusBadge value={interview.status} />
          </Link>
        ))}
      </div>
    </section>
  )
}

function InvitationAnswerReview({
  interview,
  onClose,
  onOutcome,
}: {
  interview: Interview
  onClose: () => void
  onOutcome: (invitation: Invitation) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function decide(outcome: 'passed' | 'failed') {
    setSaving(true)
    setError('')
    try {
      onOutcome(
        await api.jobs.setInvitationOutcome(
          interview.invitation.jobId,
          interview.invitation.id,
          outcome,
        ),
      )
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="answer-review" aria-labelledby="answer-review-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Participant submission</span>
          <h2 id="answer-review-title">{interview.invitation.participantName}</h2>
          <p>{interview.invitation.participantEmail}</p>
        </div>
        {interview.invitation.status === 'completed' && (
          <div className="outcome-actions" aria-label="Candidate outcome">
            <div>
              <strong>Assessment decision</strong>
              <p>Record whether this candidate should proceed to a scheduled interview.</p>
            </div>
            <button
              className="button pass"
              type="button"
              disabled={saving}
              onClick={() => void decide('passed')}
            >
              <Check size={18} /> Pass candidate
            </button>
            <button
              className="button fail"
              type="button"
              disabled={saving}
              onClick={() => void decide('failed')}
            >
              <X size={18} /> Fail candidate
            </button>
            {interview.invitation.outcome && <StatusBadge value={interview.invitation.outcome} />}
          </div>
        )}
        {error && <ErrorAlert message={error} />}
        <div className="review-heading-actions">
          <StatusBadge value={interview.invitation.status} />
          <button className="button ghost" type="button" onClick={onClose}>
            Close review
          </button>
        </div>
      </div>
      <div className="review-question-list">
        {interview.job.questions.map((question, index) => {
          const answer = interview.answers[String(question.id)]?.trim()
          return (
            <article className="review-question" key={question.id}>
              <span className="question-number">{index + 1}</span>
              <div>
                <span className="question-type">{question.type.replace('_', ' ')}</span>
                <h3>{question.text}</h3>
                {question.type === 'code_review' && question.codeSnippet && (
                  <CodePanel codeSnippet={question.codeSnippet} />
                )}
                {(question.type === 'multiple_choice' || question.type === 'radio') &&
                  question.options.length > 0 && (
                    <div className="review-options">
                      <strong>Possible options</strong>
                      <span>{question.options.join(' · ')}</span>
                    </div>
                  )}
                {(question.type === 'open' || question.type === 'code_review') &&
                  question.referenceAnswer && (
                    <div className="reference-answer">
                      <strong>Reference answer</strong>
                      <p>{question.referenceAnswer}</p>
                    </div>
                  )}
                <div className={answer ? 'participant-answer' : 'participant-answer unanswered'}>
                  <strong>Participant answer</strong>
                  <p>{answer || 'Unanswered'}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function QuestionRow({
  question,
  number,
  action,
}: {
  question: Question
  number?: number
  action?: ReactNode
}) {
  return (
    <article className="question-row">
      {number ? <span className="question-number">{number}</span> : <CircleHelp size={22} />}
      <div>
        <div className="question-meta">
          <h3>{question.type.replace('_', ' ')}</h3>
          {question.deprecated && <StatusBadge value="deprecated" />}
        </div>
        <p>{question.text}</p>
        {question.options.length > 0 && <small>{question.options.join(' · ')}</small>}
        {question.type === 'code_review' && question.codeSnippet && (
          <pre className="interviewer-code-snippet">
            <code>{question.codeSnippet}</code>
          </pre>
        )}
        {question.referenceAnswer && (
          <div className="reference-answer">
            <strong>Reference answer</strong>
            <p>{question.referenceAnswer}</p>
          </div>
        )}
      </div>
      {action && <div className="question-action">{action}</div>}
    </article>
  )
}

function CandidateMatchView({ matches }: { matches: CandidateMatch[] }) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Candidate match</h2>
          <p>Trait alignment calculated by the API.</p>
        </div>
        <span className="ai-label">
          <Sparkles size={16} /> Match insight
        </span>
      </div>
      <div className="match-list">
        {matches.map((match, index) => (
          <article className="match-card" key={match.participant.id}>
            <span className="rank">{index + 1}</span>
            <Avatar person={match.participant} />
            <div className="match-person">
              <Link to={`/participants/${match.participant.id}`}>
                {match.participant.firstName} {match.participant.lastName}
              </Link>
              <small>{match.participant.email}</small>
            </div>
            <div className="score">
              <div>
                <span>Matched</span>
                <strong>{match.matchedTraits.length}</strong>
              </div>
              <span className="score-track">
                <span style={{ width: `${Math.min(match.score, 100)}%` }} />
              </span>
            </div>
            <div className="score">
              <div>
                <span>Missing</span>
                <strong>{match.missingTraits.length}</strong>
              </div>
            </div>
            <div className="match-total">
              <strong>{Math.round(match.score)}%</strong>
              <small>Overall match</small>
            </div>
          </article>
        ))}
        {!matches.length && (
          <EmptyState
            title="No candidate matches"
            description="Matches appear when participants have extractable CV traits."
          />
        )}
      </div>
    </section>
  )
}

export function CreateJobPage() {
  const { createJob } = useData()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const split = (name: string) =>
      String(form.get(name))
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    try {
      const job = await createJob({
        title: String(form.get('title')),
        description: String(form.get('description')),
        seniority: String(form.get('seniority')),
        position: String(form.get('position')),
        labels: split('labels'),
        requiredSkills: split('requiredSkills'),
        additionalSkills: split('additionalSkills'),
      })
      navigate(`/jobs/${job.id}`)
    } catch (requestError) {
      setError(errorMessage(requestError))
      setSaving(false)
    }
  }

  return (
    <>
      <Link className="back-link" to="/jobs">
        <ArrowLeft size={17} /> Cancel
      </Link>
      <PageHeader
        eyebrow="New posting"
        title="Create a job"
        description="Define the role and skills used for candidate matching."
      />
      <form className="card form-card" onSubmit={submit}>
        <div className="form-section">
          <h2>Role information</h2>
          <div className="form-grid">
            <FormField label="Job title" htmlFor="title">
              <input id="title" name="title" required />
            </FormField>
            <FormField label="Position" htmlFor="position">
              <input id="position" name="position" required placeholder="e.g. Backend Engineer" />
            </FormField>
            <FormField label="Seniority" htmlFor="seniority">
              <input id="seniority" name="seniority" required placeholder="e.g. Senior" />
            </FormField>
            <FormField label="Labels" htmlFor="labels" hint="Comma separated">
              <input id="labels" name="labels" />
            </FormField>
          </div>
        </div>
        <div className="form-section">
          <h2>Role profile</h2>
          <FormField label="Description" htmlFor="description">
            <textarea id="description" name="description" required rows={7} />
          </FormField>
          <FormField label="Required skills" htmlFor="requiredSkills" hint="Comma separated">
            <input id="requiredSkills" name="requiredSkills" required />
          </FormField>
          <FormField label="Additional skills" htmlFor="additionalSkills" hint="Comma separated">
            <input id="additionalSkills" name="additionalSkills" />
          </FormField>
        </div>
        {error && <ErrorAlert message={error} />}
        <FormActions saving={saving} cancelTo="/jobs" label="Create job" />
      </form>
    </>
  )
}
