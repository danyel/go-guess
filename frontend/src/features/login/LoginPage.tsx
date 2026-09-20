import { ArrowRight, CircleHelp, Sparkles } from 'lucide-react'
import { SyntheticEvent, useState } from 'react'
import Logo from '../../components/layout/Logo'
import { FormField } from '../../components/form'
import { ErrorAlert, errorMessage } from '../../components/actions'
import { api, authStorage } from '../../api/client'

export function LoginPage({
  onLogin,
  sessionExpired,
}: {
  onLogin: () => void
  sessionExpired: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
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
          {sessionExpired && (
            <div className="session-notice" role="status">
              Your session is no longer active. Sign in again to continue.
            </div>
          )}
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
