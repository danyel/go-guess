import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authStorage, invalidateSession, SESSION_EXPIRED_EVENT } from '../../api/client'

export function useAuthSession() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(authStorage.token()))
  const [sessionExpired, setSessionExpired] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    function handleSessionExpired() {
      setAuthenticated(false)
      setSessionExpired(true)
      navigate('/login', { replace: true })
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [navigate])

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
    navigate('/jobs', { replace: true })
  }

  function logout() {
    authStorage.clear()
    setAuthenticated(false)
    setSessionExpired(false)
  }

  return { authenticated, sessionExpired, completeLogin, logout }
}
