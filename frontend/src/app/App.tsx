import { Route, Routes, useLocation } from 'react-router-dom'
import { useAuthSession } from '../components/actions'
import { NotFound } from '../components/ui/NotFound'
import { ParticipantInterviewPage } from '../features/assessments'
import { ParticipantMeetingPage } from '../features/interviews'
import { LoginPage } from '../features/login/LoginPage'
import { AuthenticatedApp } from './AuthenticatedApp'
import { DataProvider } from './DataContext'

export default function App() {
  const location = useLocation()
  const { authenticated, sessionExpired, ssoAvailable, completeLogin, logout } = useAuthSession()
  if (location.pathname.startsWith('/participant/')) {
    return (
      <Routes>
        <Route path="/participant/meeting/:token" element={<ParticipantMeetingPage />} />
        <Route path="/participant/:invitationId" element={<ParticipantInterviewPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    )
  }
  // The sign-in screen is the entry point, so nothing redirects to the identity
  // provider on its own. While the API is still answering there is nothing
  // useful to show, but not a spinner either: the button is correct either way,
  // because it is what the screen offers whether or not Go Loose is configured.
  if (!authenticated) {
    return (
      <LoginPage
        onLogin={completeLogin}
        sessionExpired={sessionExpired}
        ssoAvailable={ssoAvailable}
      />
    )
  }
  return (
    <DataProvider>
      <AuthenticatedApp onLogout={logout} />
    </DataProvider>
  )
}
