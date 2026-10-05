import { ArrowRight, CircleHelp, KeyRound, Sparkles } from 'lucide-react'
import { SyntheticEvent, useState } from 'react'
import Logo from '../../components/layout/Logo'
import { FormField } from '../../components/form'
import { ErrorAlert, errorMessage } from '../../components/actions'
import { api, authStorage } from '../../api/client'

const LOGIN_PATH = '/api/auth/login'

/**
 * The sign-in screen.
 *
 * Signing in happens at Go Loose, so the usual case is one button that hands the
 * browser over to it and comes back to the welcome page. That also means a person
 * who already signed in at another application passes straight through, because
 * Go Loose recognises the session it already holds and issues a code without
 * asking anything.
 *
 * The password form is only for a host where Go Loose login is not configured:
 * the API answers /api/auth/session with 404 there, and without a fallback the
 * application would be unreachable on a bare localhost. It is not offered where
 * the identity provider is in charge.
 */
export function LoginPage({
  onLogin,
  sessionExpired,
  ssoAvailable,
}: {
  onLogin: () => void
  sessionExpired: boolean
  /** null until the API has said whether Go Loose login is configured here. */
  ssoAvailable: boolean | null
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function beginExternalLogin() {
    setLoading(true)
    // A full navigation, not a router push: Go Loose answers with a redirect
    // chain across two origins that the router has no part in.
    window.location.assign(LOGIN_PATH)
  }

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
          <p className="muted">
            Use your work account to continue. If you are already signed in elsewhere, this takes
            you straight through.
          </p>

          {ssoAvailable === false ? (
            <form onSubmit={submit} className="stack-form">
              <p className="muted">
                Single sign-on is not configured for this host. Sign in with a local account.
              </p>
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
          ) : (
            <div className="stack-form">
              <button
                className="button primary wide"
                type="button"
                onClick={beginExternalLogin}
                disabled={loading}
              >
                {loading ? 'Redirecting…' : 'Sign in with Go Loose'} <KeyRound size={18} />
              </button>
            </div>
          )}

          <p className="demo-note">
            <CircleHelp size={16} /> Contact your administrator for access.
          </p>
        </div>
      </section>
    </main>
  )
}
