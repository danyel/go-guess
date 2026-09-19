import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Send,
  Inbox,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { api, ApiError, authStorage } from './api'
import {
  CalendarPage,
  InboxPage,
  ParticipantMeetingPage,
  ScheduleInterviewForm,
  ScheduledInterviewPage,
  UsersPage,
} from './interview-workflow'
import type {
  CandidateMatch,
  CreateJobInput,
  CreateParticipantInput,
  CreateQuestionInput,
  Interview,
  Invitation,
  Job,
  JobStatus,
  Participant,
  Question,
  QuestionType,
  ScheduledInterview,
} from './types'

interface AppData {
  jobs: Job[]
  participants: Participant[]
  loading: boolean
  error: string
  createJob: (input: CreateJobInput) => Promise<Job>
  createParticipant: (input: CreateParticipantInput) => Promise<Participant>
  reload: () => Promise<void>
}

const DataContext = createContext<AppData | null>(null)

function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used within DataProvider')
  return value
}

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong'
}

function DataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function reload() {
    setLoading(true)
    setError('')
    try {
      const [jobItems, participantItems] = await Promise.all([
        api.jobs.list(),
        api.participants.list(),
      ])
      setJobs(jobItems)
      setParticipants(participantItems)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void Promise.all([api.jobs.list(), api.participants.list()])
      .then(([jobItems, participantItems]) => {
        if (!active) return
        setJobs(jobItems)
        setParticipants(participantItems)
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
  }, [])

  async function createJob(input: CreateJobInput) {
    const created = await api.jobs.create(input)
    setJobs((current) => [created, ...current])
    return created
  }

  async function createParticipant(input: CreateParticipantInput) {
    const created = await api.participants.create(input)
    setParticipants((current) => [created, ...current])
    return created
  }

  return (
    <DataContext.Provider
      value={{ jobs, participants, loading, error, createJob, createParticipant, reload }}
    >
      {children}
    </DataContext.Provider>
  )
}

function Logo() {
  return (
    <Link className="logo" to="/jobs" aria-label="Go Guess home">
      <span className="logo-mark" aria-hidden="true">
        G
      </span>
      <span>
        <strong>GO GUESS</strong>
        <small>Talent workspace</small>
      </span>
    </Link>
  )
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const auth = await api.login(String(form.get('email')), String(form.get('password')))
      authStorage.save(auth)
      onLogin()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <Logo />
        <div className="story-copy">
          <span className="eyebrow">Better hiring, clearly connected</span>
          <h1>Find the right person for every journey.</h1>
          <p>Bring roles, assessments, and candidate insight together in one workspace.</p>
          <div className="story-stat">
            <Sparkles />
            <span>
              <strong>Skills-first matching</strong>
              <small>Structured signals for confident decisions</small>
            </span>
          </div>
        </div>
        <p className="login-foot">Designed for fair, collaborative recruitment.</p>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <span className="eyebrow">Welcome back</span>
          <h2 id="login-title">Sign in to your workspace</h2>
          <p className="muted">Use your work account to continue.</p>
          <form onSubmit={submit} className="stack-form">
            <FormField label="Email address" htmlFor="email">
              <input id="email" name="email" type="email" autoComplete="email" required />
            </FormField>
            <FormField label="Password" htmlFor="password">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </FormField>
            {error && <ErrorAlert message={error} />}
            <button className="button primary wide" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={18} />
            </button>
          </form>
          <p className="demo-note">
            <CircleHelp size={16} /> Contact your administrator for access.
          </p>
        </div>
      </section>
    </main>
  )
}

function AppLayout({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const user = authStorage.user()
  return (
    <div className="app-shell">
      <header className="mobile-header">
        <Logo />
        <button className="icon-button" onClick={() => setOpen(true)} aria-label="Open navigation">
          <Menu />
        </button>
      </header>
      {open && (
        <button
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Logo />
          <button
            className="icon-button mobile-only"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <NavItem
            to="/jobs"
            label="Jobs"
            icon={<BriefcaseBusiness size={20} />}
            close={() => setOpen(false)}
          />
          <NavItem
            to="/participants"
            label="Participants"
            icon={<UsersRound size={20} />}
            close={() => setOpen(false)}
          />
          <NavItem
            to="/questions"
            label="Question library"
            icon={<CircleHelp size={20} />}
            close={() => setOpen(false)}
          />
          <NavItem
            to="/inbox"
            label="Inbox"
            icon={<Inbox size={20} />}
            close={() => setOpen(false)}
          />
          <NavItem
            to="/calendar"
            label="Calendar"
            icon={<CalendarDays size={20} />}
            close={() => setOpen(false)}
          />
          <NavItem
            to="/users"
            label="Users"
            icon={<UserRound size={20} />}
            close={() => setOpen(false)}
          />
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <span className="avatar tiny">{user?.email.slice(0, 2).toUpperCase() ?? 'U'}</span>
            <span>
              <strong>{user?.email ?? 'Signed in'}</strong>
              <small>{user?.role ?? 'User'}</small>
            </span>
          </div>
          <button className="icon-button" onClick={onLogout} aria-label="Sign out">
            <LogOut size={19} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route index element={<Navigate to="/jobs" replace />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/new" element={<CreateJobPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
          <Route path="/jobs/:jobId/questions/new" element={<QuestionPage />} />
          <Route path="/questions" element={<QuestionLibraryPage />} />
          <Route path="/participants" element={<ParticipantsPage />} />
          <Route path="/participants/new" element={<CreateParticipantPage />} />
          <Route path="/participants/:participantId" element={<ParticipantDetailPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/scheduled-interviews/:id" element={<ScheduledInterviewPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  )
}

function NavItem({
  to,
  label,
  icon,
  close,
}: {
  to: string
  label: string
  icon: ReactNode
  close: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={close}
      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
    >
      {icon}
      {label}
    </NavLink>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  )
}

function JobsPage() {
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

function JobDetailPage() {
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

function QuestionRow({
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

function CreateJobPage() {
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

function QuestionPage() {
  const id = Number(useParams().jobId)
  const navigate = useNavigate()
  const [job, setJob] = useState<Job>()
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    void api.jobs
      .get(id)
      .then(setJob)
      .catch((value) => setLoadError(errorMessage(value)))
  }, [id])
  if (loadError) return <ErrorAlert message={loadError} />
  if (!job) return <Loading />

  async function createAndAttach(input: CreateQuestionInput) {
    const question = await api.questions.create(input)
    await api.jobs.attachQuestion(id, question.id)
    navigate(`/jobs/${id}`)
  }

  return (
    <>
      <Link className="back-link" to={`/jobs/${id}`}>
        <ArrowLeft size={17} /> {job.title}
      </Link>
      <PageHeader
        eyebrow="Assessment builder"
        title="Create a question"
        description="Create a reusable library question and attach it to this job."
      />
      <QuestionForm
        submitLabel="Create and attach question"
        onSubmit={createAndAttach}
        onCancel={() => navigate(`/jobs/${id}`)}
      />
    </>
  )
}

function QuestionForm({
  initialQuestion,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialQuestion?: Question
  submitLabel: string
  onSubmit: (input: CreateQuestionInput) => Promise<void>
  onCancel?: () => void
}) {
  const [text, setText] = useState(initialQuestion?.text ?? '')
  const [type, setType] = useState<QuestionType>(initialQuestion?.type ?? 'open')
  const [options, setOptions] = useState(
    initialQuestion?.type === 'multiple_choice' || initialQuestion?.type === 'radio'
      ? initialQuestion.options
      : [],
  )
  const [referenceAnswer, setReferenceAnswer] = useState(initialQuestion?.referenceAnswer ?? '')
  const [codeSnippet, setCodeSnippet] = useState(
    initialQuestion?.type === 'code_review' ? initialQuestion.codeSnippet : '',
  )
  const [optionDraft, setOptionDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const choiceType = type === 'multiple_choice' || type === 'radio'

  function changeType(nextType: QuestionType) {
    setType(nextType)
    setError('')
    if (nextType === 'open' || nextType === 'code_review') {
      setOptions([])
      setOptionDraft('')
    } else {
      setReferenceAnswer('')
    }
    if (nextType !== 'code_review') setCodeSnippet('')
  }

  function addOption() {
    const option = optionDraft.trim()
    if (!option) return
    setOptions((current) => [...current, option])
    setOptionDraft('')
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (choiceType && options.length < 2) {
      setError('Add at least two options before saving this question.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        text: text.trim(),
        type,
        options: choiceType ? options : [],
        referenceAnswer: choiceType ? '' : referenceAnswer.trim(),
        codeSnippet: type === 'code_review' ? codeSnippet : '',
      })
      if (!initialQuestion) {
        setText('')
        setType('open')
        setOptions([])
        setOptionDraft('')
        setReferenceAnswer('')
        setCodeSnippet('')
      }
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card form-card library-form" onSubmit={submit}>
      <div className="form-section">
        <h2>{initialQuestion ? 'Edit question' : 'Create question'}</h2>
        <FormField label="Question prompt" htmlFor="question-form-text">
          <textarea
            id="question-form-text"
            name="text"
            rows={type === 'code_review' ? 10 : 5}
            value={text}
            onChange={(event) => setText(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Response type" htmlFor="question-form-type">
          <select
            id="question-form-type"
            value={type}
            onChange={(event) => changeType(event.target.value as QuestionType)}
          >
            <option value="open">Open answer</option>
            <option value="multiple_choice">Multiple choice</option>
            <option value="radio">Single choice</option>
            <option value="code_review">Code review</option>
          </select>
        </FormField>
        {type === 'code_review' && (
          <FormField label="Code snippet" htmlFor="question-form-code-snippet">
            <textarea
              id="question-form-code-snippet"
              rows={12}
              value={codeSnippet}
              onChange={(event) => setCodeSnippet(event.target.value)}
              required
            />
          </FormField>
        )}
        {!choiceType && (
          <FormField
            label={type === 'code_review' ? 'Expected answer' : 'Reference answer'}
            htmlFor="question-form-reference-answer"
          >
            <textarea
              id="question-form-reference-answer"
              rows={5}
              value={referenceAnswer}
              onChange={(event) => setReferenceAnswer(event.target.value)}
            />
          </FormField>
        )}
        {choiceType && (
          <fieldset className="option-builder">
            <legend className="field-label">Answer options</legend>
            <div className="option-entry">
              <input
                aria-label="New option"
                value={optionDraft}
                onChange={(event) => setOptionDraft(event.target.value)}
                placeholder="Type an option"
              />
              <button
                className="button secondary option-add"
                type="button"
                onClick={addOption}
                disabled={!optionDraft.trim()}
                aria-label="Add option"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="option-list" aria-live="polite">
              {options.map((option, index) => (
                <div className="option-item" key={`${option}-${index}`}>
                  <span>{option}</span>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() =>
                      setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    aria-label={`Remove option ${option}`}
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>
            <small className="field-hint">Add at least two options.</small>
          </fieldset>
        )}
        {error && <ErrorAlert message={error} />}
        <div className="question-form-actions">
          {onCancel && (
            <button className="button ghost" type="button" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          )}
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}

function QuestionLibraryPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Question>()
  const [formVersion, setFormVersion] = useState(0)
  const [error, setError] = useState('')

  async function load(search = query) {
    setError('')
    try {
      setQuestions(await api.questions.list(search))
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      void api.questions
        .list(query)
        .then((items) => {
          if (active) setQuestions(items)
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

  async function create(input: CreateQuestionInput) {
    const created = await api.questions.create(input)
    setQuestions((current) => [created, ...current])
    setFormVersion((current) => current + 1)
  }

  async function update(input: CreateQuestionInput) {
    if (!editing) return
    const updated = await api.questions.update(editing.id, input)
    setQuestions((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setEditing(undefined)
  }

  async function toggle(question: Question) {
    setError('')
    try {
      const updated = await api.questions.setDeprecated(question.id, !question.deprecated)
      setQuestions((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      if (editing?.id === updated.id) setEditing(updated)
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Assessment builder"
        title="Question library"
        description="Create reusable interview questions and retire questions without deleting them."
      />
      {error && <ErrorAlert message={error} retry={load} />}
      <div className="library-grid">
        <section className="card">
          <div className="toolbar">
            <label className="search-field">
              <Search size={18} />
              <span className="sr-only">Search questions</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search questions…"
              />
            </label>
            <span className="result-count">{questions.length} questions</span>
          </div>
          <div className="question-list">
            {questions.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                action={
                  <div className="library-question-actions">
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => setEditing(question)}
                      aria-label={`Edit ${question.text}`}
                    >
                      <Pencil size={16} /> Edit
                    </button>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={question.deprecated}
                        onChange={() => void toggle(question)}
                        aria-label={`Deprecated: ${question.text}`}
                      />
                      <span>Deprecated</span>
                    </label>
                  </div>
                }
              />
            ))}
            {!questions.length && (
              <EmptyState
                title="No questions found"
                description="Create a question or adjust your search."
              />
            )}
          </div>
        </section>
        <QuestionForm
          key={editing ? `edit-${editing.id}` : `create-${formVersion}`}
          initialQuestion={editing}
          submitLabel={editing ? 'Save changes' : 'Create question'}
          onSubmit={editing ? update : create}
          onCancel={editing ? () => setEditing(undefined) : undefined}
        />
      </div>
    </>
  )
}

function ParticipantsPage() {
  const { participants, loading, error, reload } = useData()
  const [query, setQuery] = useState('')
  const filtered = participants.filter((person) =>
    `${person.firstName} ${person.lastName} ${person.email} ${person.traits.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHeader
        eyebrow="Talent pool"
        title="Participants"
        description="Manage candidate profiles and application documents."
        action={
          <Link to="/participants/new" className="button primary">
            <Plus size={18} /> Add participant
          </Link>
        }
      />
      {error && <ErrorAlert message={error} retry={reload} />}
      <section className="card">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <span className="sr-only">Search participants</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people or traits…"
            />
          </label>
          <span className="result-count">{filtered.length} participants</span>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <div className="people-grid">
            {filtered.map((person) => (
              <Link className="person-card" to={`/participants/${person.id}`} key={person.id}>
                <Avatar person={person} large />
                <div>
                  <h2>
                    {person.firstName} {person.lastName}
                  </h2>
                  <p>{person.email}</p>
                  <small>{person.contactInfo}</small>
                </div>
                <div className="tag-list">
                  {person.traits.slice(0, 3).map((trait) => (
                    <span key={trait}>{trait}</span>
                  ))}
                </div>
                <ChevronRight className="person-arrow" />
              </Link>
            ))}
          </div>
        )}
        {!loading && !filtered.length && !error && (
          <EmptyState
            title="No participants found"
            description="Add a participant or adjust your search."
          />
        )}
      </section>
    </>
  )
}

function CreateParticipantPage() {
  const { createParticipant } = useData()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photo, setPhoto] = useState<File>()
  const [cv, setCv] = useState<File>()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const person = await createParticipant({
        firstName: String(form.get('firstName')),
        lastName: String(form.get('lastName')),
        birthday: String(form.get('birthday')),
        email: String(form.get('email')),
        contactInfo: String(form.get('contactInfo')),
        photo,
        cv,
      })
      navigate(`/participants/${person.id}`)
    } catch (requestError) {
      setError(errorMessage(requestError))
      setSaving(false)
    }
  }
  return (
    <>
      <Link className="back-link" to="/participants">
        <ArrowLeft size={17} /> Cancel
      </Link>
      <PageHeader
        eyebrow="New profile"
        title="Add a participant"
        description="Create a candidate profile and attach application documents."
      />
      <form className="card form-card" onSubmit={submit}>
        <div className="form-section">
          <h2>Profile photo</h2>
          <div className="photo-upload">
            <span className="avatar upload-avatar">
              {photoPreview ? (
                <img src={photoPreview} alt="Selected profile preview" />
              ) : (
                <UserRound />
              )}
            </span>
            <label className="button secondary file-button">
              <Upload size={17} /> Choose photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setPhoto(file)
                  if (file) setPhotoPreview(URL.createObjectURL(file))
                }}
              />
            </label>
            <small>JPG, PNG or WebP.</small>
          </div>
        </div>
        <div className="form-section">
          <h2>Personal information</h2>
          <div className="form-grid">
            <FormField label="First name" htmlFor="firstName">
              <input id="firstName" name="firstName" required />
            </FormField>
            <FormField label="Last name" htmlFor="lastName">
              <input id="lastName" name="lastName" required />
            </FormField>
            <FormField label="Birthday" htmlFor="birthday">
              <input id="birthday" name="birthday" type="date" />
            </FormField>
            <FormField label="Email address" htmlFor="email">
              <input id="email" name="email" type="email" required />
            </FormField>
          </div>
          <FormField
            label="Contact information"
            htmlFor="contactInfo"
            hint="Phone, location, or preferred contact details."
          >
            <textarea id="contactInfo" name="contactInfo" rows={3} required />
          </FormField>
        </div>
        <div className="form-section">
          <h2>Curriculum vitae</h2>
          <label className="dropzone">
            <FileText size={28} />
            <span>
              <strong>{cv?.name ?? 'Upload CV'}</strong>
              <small>PDF or Word document</small>
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => setCv(event.target.files?.[0])}
            />
          </label>
        </div>
        {error && <ErrorAlert message={error} />}
        <FormActions saving={saving} cancelTo="/participants" label="Create participant" />
      </form>
    </>
  )
}

function ParticipantDetailPage() {
  const id = Number(useParams().participantId)
  const [person, setPerson] = useState<Participant>()
  const [error, setError] = useState('')
  useEffect(() => {
    void api.participants
      .get(id)
      .then(setPerson)
      .catch((value) => setError(errorMessage(value)))
  }, [id])
  if (error) return <ErrorAlert message={error} />
  if (!person) return <Loading />

  async function downloadCV() {
    try {
      const blob = await api.participants.cv(id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = person?.cvFilename ?? 'cv'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(errorMessage(requestError))
    }
  }
  return (
    <>
      <Link className="back-link" to="/participants">
        <ArrowLeft size={17} /> All participants
      </Link>
      <section className="profile-hero">
        <Avatar person={person} large />
        <div>
          <span className="eyebrow">Candidate profile</span>
          <h1>
            {person.firstName} {person.lastName}
          </h1>
          <p>{person.email}</p>
        </div>
        <a className="button secondary" href={`mailto:${person.email}`}>
          Contact candidate
        </a>
      </section>
      <div className="detail-grid">
        <section className="card prose">
          <h2>Extracted traits</h2>
          <div className="tag-list large">
            {person.traits.map((trait) => (
              <span key={trait}>{trait}</span>
            ))}
          </div>
          {!person.traits.length && <p className="muted">No traits extracted.</p>}
        </section>
        <aside className="card facts">
          <h2>Contact & documents</h2>
          <Fact label="Email" value={person.email} />
          <Fact label="Contact information" value={person.contactInfo} />
          <Fact label="Birthday" value={person.birthday ?? 'Not provided'} />
          <Fact label="Created" value={new Date(person.createdAt).toLocaleDateString()} />
          {person.cvUrl && (
            <button className="document-row" type="button" onClick={downloadCV}>
              <FileText />
              <span>
                <strong>{person.cvFilename}</strong>
                <small>Download candidate CV</small>
              </span>
            </button>
          )}
        </aside>
      </div>
    </>
  )
}

function Avatar({ person, large = false }: { person: Participant; large?: boolean }) {
  const [source, setSource] = useState('')
  useEffect(() => {
    if (!person.photoUrl) return
    let active = true
    let objectUrl = ''
    void api.participants
      .photo(person.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (active) setSource(objectUrl)
      })
      .catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [person.id, person.photoUrl])
  return (
    <span className={`avatar ${large ? 'large' : ''}`}>
      {source ? <img src={source} alt="" /> : `${person.firstName[0]}${person.lastName[0]}`}
    </span>
  )
}

function SkillList({ skills }: { skills: string[] }) {
  return skills.length ? (
    <ul className="check-list">
      {skills.map((skill) => (
        <li key={skill}>
          <Check size={17} /> {skill}
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">None specified.</p>
  )
}
function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  )
}
function FormActions({
  saving,
  cancelTo,
  label,
}: {
  saving: boolean
  cancelTo: string
  label: string
}) {
  return (
    <div className="form-actions">
      <Link className="button ghost" to={cancelTo}>
        Cancel
      </Link>
      <button className="button primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : label}
        <ArrowRight size={17} />
      </button>
    </div>
  )
}
function ErrorAlert({ message, retry }: { message: string; retry?: () => void | Promise<void> }) {
  return (
    <div className="error-alert" role="alert">
      <strong>Request failed</strong>
      <span>{message}</span>
      {retry && (
        <button type="button" onClick={() => void retry()}>
          Try again
        </button>
      )}
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
function StatusBadge({ value }: { value: string }) {
  return <span className={`status status-${value.toLowerCase()}`}>{value}</span>
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}
function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <LayoutDashboard />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function CodePanel({ codeSnippet }: { codeSnippet: string }) {
  return (
    <section className="code-review-panel" aria-label="Code changes">
      <header>
        <FileText size={17} />
        <strong>Code changes</strong>
      </header>
      <div className="code-lines">
        {codeSnippet.split('\n').map((line, index) => {
          const added = line.startsWith('+') && !line.startsWith('+++')
          return (
            <div className={added ? 'code-line added' : 'code-line'} key={index}>
              <span className="line-number" aria-hidden="true">
                {index + 1}
              </span>
              <code>{line || ' '}</code>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CodeReviewAnswer({
  codeSnippet,
  answer,
  onChange,
}: {
  codeSnippet: string
  answer: string
  onChange: (answer: string) => void
}) {
  return (
    <div className="code-review-answer">
      <CodePanel codeSnippet={codeSnippet} />
      <FormField label="Review comment" htmlFor="review-comment">
        <textarea
          id="review-comment"
          rows={7}
          value={answer}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Describe issues, suggestions, and approval notes…"
        />
      </FormField>
    </div>
  )
}

function ParticipantInterviewPage() {
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

function NotFound() {
  return (
    <section className="empty-page">
      <span className="eyebrow">404</span>
      <h1>Page not found</h1>
      <p>The page you requested is not available.</p>
      <Link className="button primary" to="/jobs">
        Back to jobs
      </Link>
    </section>
  )
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(authStorage.token()))
  const navigate = useNavigate()
  const location = useLocation()

  function completeLogin() {
    setAuthenticated(true)
    navigate('/jobs', { replace: true })
  }

  function logout() {
    authStorage.clear()
    setAuthenticated(false)
  }
  if (location.pathname.startsWith('/participant/')) {
    return (
      <Routes>
        <Route path="/participant/meeting/:token" element={<ParticipantMeetingPage />} />
        <Route path="/participant/:invitationId" element={<ParticipantInterviewPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    )
  }
  if (!authenticated) return <LoginPage onLogin={completeLogin} />
  return (
    <DataProvider>
      <AppLayout onLogout={logout} />
    </DataProvider>
  )
}
