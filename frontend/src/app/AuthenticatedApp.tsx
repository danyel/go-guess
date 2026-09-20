import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { authStorage } from '../api/client'
import { AppFooter } from '../components/layout/AppFooter'
import { GoGuessHeader } from '../components/layout/GoGuessHeader'
import { WorkspaceUtilities } from '../components/layout/WorkspaceUtilities'
import { NotFound } from '../components/ui/NotFound'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { InvitationPage, ScheduledInterviewPage } from '../features/interviews'
import { CreateJobPage, JobDetailPage, JobsPage } from '../features/jobs'
import {
  CreateParticipantPage,
  ParticipantDetailPage,
  ParticipantsPage,
} from '../features/participants'
import { QuestionLibraryPage, QuestionPage } from '../features/questions'
import { SchedulePage, ProfilePage, UsersPage } from '../features/users'

export function AuthenticatedApp({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const user = authStorage.user()
  return (
    <div className="app-shell">
      <GoGuessHeader setOpen={setOpen} open={open} onLogout={onLogout} />
      <main className="main-content">
        <WorkspaceUtilities user={user} />
        <div className="workspace-content">
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/new" element={<CreateJobPage />} />
            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
            <Route path="/jobs/:jobId/questions/new" element={<QuestionPage />} />
            <Route path="/questions" element={<QuestionLibraryPage />} />
            <Route path="/participants" element={<ParticipantsPage />} />
            <Route path="/participants/new" element={<CreateParticipantPage />} />
            <Route path="/participants/:participantId" element={<ParticipantDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/invitations" element={<InvitationPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/scheduled-interviews/:id" element={<ScheduledInterviewPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <AppFooter />
      </main>
    </div>
  )
}
