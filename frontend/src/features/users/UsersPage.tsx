import { Plus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { api, ApiError } from '../../api/client'
import { useDomainEvent } from '../../app/useDomainEvent'
import { ErrorAlert, Loading } from '../../components/ui/AsyncState'
import type { User } from '../../types'

function errorMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : 'Something went wrong'
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
      .catch((value) => setError(errorMessage(value)))
      .finally(() => setLoading(false))
  }, [])

  useDomainEvent<User>('users', (event) => {
    setUsers((current) => [...current.filter((user) => user.id !== event.data.id), event.data])
  })

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = event.currentTarget
    const values = new FormData(form)
    try {
      await api.users.create({
        email: String(values.get('email')),
        password: String(values.get('password')),
        displayName: String(values.get('displayName')),
      })
      form.reset()
    } catch (value) {
      setError(errorMessage(value))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Team access</span>
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
