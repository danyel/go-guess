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
  const { authenticated, sessionExpired, completeLogin, logout } = useAuthSession()

  if (location.pathname.startsWith('/participant/')) {
    return (
      <Routes>
        <Route path="/participant/meeting/:token" element={<ParticipantMeetingPage />} />
        <Route path="/participant/:invitationId" element={<ParticipantInterviewPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    )
  }
  if (!authenticated) {
    return <LoginPage onLogin={completeLogin} sessionExpired={sessionExpired} />
  }
  return (
    <DataProvider>
      <AuthenticatedApp onLogout={logout} />
    </DataProvider>
  )
}
