import { Mail, ShieldCheck, UserRound } from 'lucide-react'
import { authStorage } from '../../api/client'

export function ProfilePage() {
  const user = authStorage.user()
  if (!user) return null

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Your account</span>
        </div>
      </header>
      <section className="card profile-card">
        <div className="profile-identity">
          <span className="avatar profile-avatar" aria-hidden="true">
            {user.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1>{user.displayName}</h1>
            <span className={`status status-${user.role}`}>{user.role}</span>
          </div>
        </div>
        <dl className="profile-details">
          <div>
            <dt>
              <Mail size={18} aria-hidden="true" />
              Email address
            </dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>
              <UserRound size={18} aria-hidden="true" />
              User ID
            </dt>
            <dd>{user.id}</dd>
          </div>
          <div>
            <dt>
              <ShieldCheck size={18} aria-hidden="true" />
              Workspace role
            </dt>
            <dd>{user.role}</dd>
          </div>
        </dl>
      </section>
    </>
  )
}
