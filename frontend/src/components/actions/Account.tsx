import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authStorage, invalidateSession, SESSION_EXPIRED_EVENT } from '../../api/client'

const ssoHosts = new Set(['nmbs.guess.dev', 'ypto.guess.dev'])

export function isSSOHost() {
  return ssoHosts.has(window.location.hostname)
}

export function useAuthSession() {
  const location = useLocation()
  const sso = isSSOHost() && !location.pathname.startsWith('/participant/')
  const [authenticated, setAuthenticated] = useState(() => Boolean(authStorage.token()))
  const [sessionExpired, setSessionExpired] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const needsSSO = sso && !authenticated && !authStorage.token()
  const ssoStatus = !needsSSO ? 'idle' : redirecting ? 'redirecting' : 'checking'
  const navigate = useNavigate()

  useEffect(() => {
    function handleSessionExpired() {
      setAuthenticated(false)
      setSessionExpired(true)
      if (isSSOHost() && !window.location.pathname.startsWith('/participant/')) {
        window.location.replace('/api/auth/login')
        return
      }
      navigate('/login', { replace: true })
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [navigate])

  useEffect(() => {
    if (!needsSSO) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/auth/session', {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          redirect: 'manual',
        })
        if (cancelled) return
        if (response.ok) {
          authStorage.save(await response.json())
          setAuthenticated(true)
          setSessionExpired(false)
          return
        }
      } catch {
        // The browser redirect below starts a fresh Go Loose login.
      }
      if (!cancelled) {
        setRedirecting(true)
        window.location.replace('/api/auth/login')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [needsSSO])

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
    navigate('/', { replace: true })
  }

  function logout() {
    authStorage.clear()
    setAuthenticated(false)
    setSessionExpired(false)
    if (isSSOHost()) window.location.assign('/api/auth/logout')
  }

  return { authenticated, sessionExpired, ssoStatus, completeLogin, logout }
}
