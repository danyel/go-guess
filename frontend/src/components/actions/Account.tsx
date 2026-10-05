import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  authStorage,
  invalidateSession,
  tenantFromHostname,
  SESSION_EXPIRED_EVENT,
} from '../../api/client'

const SESSION_PATH = '/api/auth/session'
const LOGOUT_PATH = '/api/auth/logout'

/**
 * Every tenant is served from https://<tenant>.<app domain>, on guess-dev.urpi.be
 * locally and guess.urpi.be in production, so the first DNS label of a host
 * with an app domain below it names the tenant. Those hosts may authenticate
 * through Go Loose. Whether they actually do is answered by the API, which
 * reports 404 for /api/auth/session on any host it has no Go Loose login for,
 * and that host then falls back to password sign-in.
 */
export function isSSOHost() {
  return tenantFromHostname(window.location.hostname) !== null
}

/**
 * Tracks who is signed in.
 *
 * There is deliberately no automatic redirect to the identity provider: signing in
 * starts from the sign-in screen and one button. Redirecting on sight would skip
 * past the screen, and would also fire on every anonymous visit to the
 * application, which reads as a redirect loop rather than as a choice to sign in.
 */
export function useAuthSession() {
  const location = useLocation()
  // A participant opens the application through a token link and is never a
  // member of the tenant, so nothing here may probe or redirect them.
  const participant = location.pathname.startsWith('/participant/')
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(() => Boolean(authStorage.token()))
  const [sessionExpired, setSessionExpired] = useState(false)
  // Whether Go Loose login is configured for this host. A host with no tenant
  // label cannot have it, so that is known without asking: false there, and null
  // on a tenant host until /api/auth/session has answered.
  const [ssoAvailable, setSsoAvailable] = useState<boolean | null>(() =>
    isSSOHost() ? null : false,
  )
  const storedToken = authStorage.token()

  useEffect(() => {
    function handleSessionExpired() {
      setAuthenticated(false)
      setSessionExpired(true)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  useEffect(() => {
    // A host without a tenant label cannot have Go Loose login configured, and a
    // participant is not signing in at all.
    if (participant || !isSSOHost() || storedToken) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(SESSION_PATH, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          redirect: 'manual',
        })
        if (cancelled) return
        if (response.status === 404) {
          // Go Loose login is not configured for this host: sign in with a password.
          setSsoAvailable(false)
          return
        }
        setSsoAvailable(true)
        if (response.ok) {
          authStorage.save(await response.json())
          setAuthenticated(true)
          setSessionExpired(false)
        }
      } catch {
        // An unreachable API leaves ssoAvailable null, which keeps the single
        // sign-on button on screen: it is the only way in on such a host anyway.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [storedToken, participant])

  useEffect(() => {
    if (!authenticated) return
    const expiresAt = authStorage.expiresAt()
    if (expiresAt === null) return
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) {
      invalidateSession()
      return
    }
    const timeout = window.setTimeout(invalidateSession, remaining)
    return () => window.clearTimeout(timeout)
  }, [authenticated])

  function completeLogin() {
    setAuthenticated(true)
    setSessionExpired(false)
    // The password path can be entered from any URL, so the welcome page is the
    // destination. The Go Loose path is already sent here by its redirect.
    navigate('/', { replace: true })
  }

  function logout() {
    authStorage.clear()
    setAuthenticated(false)
    setSessionExpired(false)
    // Signing out also ends the Go Loose session, so the next application in the
    // family asks for credentials again rather than letting this one back in.
    if (isSSOHost()) window.location.assign(LOGOUT_PATH)
  }

  return { authenticated, sessionExpired, ssoAvailable, completeLogin, logout }
}
