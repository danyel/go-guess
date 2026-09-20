import {
  ArrowRight,
  BriefcaseBusiness,
  CircleHelp,
  Plus,
  Sparkles,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useData } from '../../app/useData'
import { ErrorAlert, Loading } from '../../components/actions'
import { StatusBadge } from '../../components/ui/Display'
import type { JobStatus } from '../../types'

const jobStatuses: { value: JobStatus; label: string }[] = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'deprecated', label: 'Deprecated' },
]

export function DashboardPage() {
  const { jobs, participants, loading, error, reload } = useData()
  const questionCount = jobs.reduce((total, job) => total + job.questions.length, 0)
  const publishedCount = jobs.filter((job) => job.status === 'published').length
  const statusCounts = jobStatuses.map((status) => ({
    ...status,
    count: jobs.filter((job) => job.status === status.value).length,
  }))
  const maxStatusCount = Math.max(...statusCounts.map((status) => status.count), 1)
  const skillCounts = participants
    .flatMap((participant) => participant.traits)
    .reduce<Map<string, number>>((counts, skill) => {
      counts.set(skill, (counts.get(skill) ?? 0) + 1)
      return counts
    }, new Map())
  const topSkills = [...skillCounts.entries()]
    .sort(([leftSkill, leftCount], [rightSkill, rightCount]) =>
      rightCount === leftCount ? leftSkill.localeCompare(rightSkill) : rightCount - leftCount,
    )
    .slice(0, 5)
  const maxSkillCount = Math.max(...topSkills.map(([, count]) => count), 1)
  const recentJobs = [...jobs]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 4)

  if (loading) return <Loading />

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Workspace overview</span>
          <h1>Your hiring pipeline, at a glance.</h1>
          <p>
            Track open roles, assessment coverage, and the skills available in your talent pool.
          </p>
          <div className="dashboard-hero-actions">
            <Link to="/jobs/new" className="button primary">
              <Plus size={18} /> Create job
            </Link>
            <Link to="/participants/new" className="button dashboard-secondary">
              <UserPlus size={18} /> Add participant
            </Link>
          </div>
        </div>
        <div className="dashboard-hero-art" aria-hidden="true">
          <Sparkles size={24} />
          <div className="hero-orbit hero-orbit-large" />
          <div className="hero-orbit hero-orbit-small" />
          <strong>{publishedCount}</strong>
          <span>published roles</span>
        </div>
      </section>

      {error && <ErrorAlert message={error} retry={reload} />}

      <section className="dashboard-metrics" aria-label="Recruitment summary">
        <Link to="/jobs" className="dashboard-metric">
          <span className="dashboard-metric-icon cyan">
            <BriefcaseBusiness size={20} />
          </span>
          <span>
            <small>Total jobs</small>
            <strong>{jobs.length}</strong>
          </span>
          <ArrowRight size={18} />
        </Link>
        <Link to="/participants" className="dashboard-metric">
          <span className="dashboard-metric-icon lime">
            <UsersRound size={20} />
          </span>
          <span>
            <small>Participants</small>
            <strong>{participants.length}</strong>
          </span>
          <ArrowRight size={18} />
        </Link>
        <Link to="/questions" className="dashboard-metric">
          <span className="dashboard-metric-icon orange">
            <CircleHelp size={20} />
          </span>
          <span>
            <small>Questions in use</small>
            <strong>{questionCount}</strong>
          </span>
          <ArrowRight size={18} />
        </Link>
      </section>

      <div className="dashboard-grid">
        <section className="card dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="eyebrow">Pipeline health</span>
              <h2>Jobs by status</h2>
            </div>
            <Link to="/jobs">
              View jobs <ArrowRight size={16} />
            </Link>
          </div>
          <div className="dashboard-bars">
            {statusCounts.map((status) => (
              <div className="dashboard-bar-row" key={status.value}>
                <div>
                  <span>{status.label}</span>
                  <strong>{status.count}</strong>
                </div>
                <div
                  className={`dashboard-bar status-bar-${status.value}`}
                  role="meter"
                  aria-label={`${status.label} jobs`}
                  aria-valuenow={status.count}
                  aria-valuemin={0}
                  aria-valuemax={maxStatusCount}
                >
                  <span style={{ width: `${(status.count / maxStatusCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {!jobs.length && <p className="dashboard-empty">Create a job to start your pipeline.</p>}
        </section>

        <section className="card dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <span className="eyebrow">Talent signals</span>
              <h2>Top participant skills</h2>
            </div>
            <Link to="/participants">
              View people <ArrowRight size={16} />
            </Link>
          </div>
          {topSkills.length ? (
            <div className="dashboard-skill-chart">
              {topSkills.map(([skill, count]) => (
                <div className="dashboard-skill-row" key={skill}>
                  <span>{skill}</span>
                  <div
                    className="dashboard-skill-track"
                    role="meter"
                    aria-label={`${skill}: ${count} participants`}
                    aria-valuenow={count}
                    aria-valuemin={0}
                    aria-valuemax={maxSkillCount}
                  >
                    <span style={{ width: `${(count / maxSkillCount) * 100}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">Participant skills will appear here.</p>
          )}
        </section>

        <section className="card dashboard-panel dashboard-recent">
          <div className="dashboard-panel-heading">
            <div>
              <span className="eyebrow">Latest activity</span>
              <h2>Recent jobs</h2>
            </div>
            <Link to="/jobs">
              See all <ArrowRight size={16} />
            </Link>
          </div>
          {recentJobs.length ? (
            <div className="dashboard-job-list">
              {recentJobs.map((job) => (
                <Link to={`/jobs/${job.id}`} key={job.id}>
                  <span>
                    <strong>{job.title}</strong>
                    <small>
                      {job.position} · {job.questions.length} questions
                    </small>
                  </span>
                  <StatusBadge value={job.status} />
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No jobs have been created yet.</p>
          )}
        </section>

        <section className="dashboard-quick-links">
          <span className="eyebrow">Quick actions</span>
          <h2>Keep things moving</h2>
          <Link to="/questions">
            <CircleHelp size={20} />
            <span>
              <strong>Build an assessment</strong>
              <small>Browse the question library</small>
            </span>
            <ArrowRight size={18} />
          </Link>
          <Link to="/schedule">
            <Sparkles size={20} />
            <span>
              <strong>Review the calendar</strong>
              <small>See upcoming interviews</small>
            </span>
            <ArrowRight size={18} />
          </Link>
        </section>
      </div>
    </div>
  )
}
