import {NotFound} from "../components/ui/NotFound";
import {Route, Routes} from "react-router-dom";
import {InvitationPage, ScheduledInterviewPage} from "../features/interviews";
import {ProfilePage, SchedulePage, UsersPage} from "../features/users";
import {CreateParticipantPage, ParticipantDetailPage, ParticipantsPage} from "../features/participants";
import {QuestionLibraryPage, QuestionPage} from "../features/questions";
import {CreateJobPage, JobDetailPage, JobsPage} from "../features/jobs";
import {DashboardPage} from "../features/dashboard/DashboardPage";

export default function ApplicationRoutes() {
    return (
        <div className="workspace-content">
            <Routes>
                <Route index element={<DashboardPage/>}/>
                <Route path="/jobs" element={<JobsPage/>}/>
                <Route path="/jobs/new" element={<CreateJobPage/>}/>
                <Route path="/jobs/:jobId" element={<JobDetailPage/>}/>
                <Route path="/jobs/:jobId/questions/new" element={<QuestionPage/>}/>
                <Route path="/questions" element={<QuestionLibraryPage/>}/>
                <Route path="/participants" element={<ParticipantsPage/>}/>
                <Route path="/participants/new" element={<CreateParticipantPage/>}/>
                <Route path="/participants/:participantId" element={<ParticipantDetailPage/>}/>
                <Route path="/users" element={<UsersPage/>}/>
                <Route path="/profile" element={<ProfilePage/>}/>
                <Route path="/invitations" element={<InvitationPage/>}/>
                <Route path="/schedule" element={<SchedulePage/>}/>
                <Route path="/scheduled-interviews/:id" element={<ScheduledInterviewPage/>}/>
                <Route path="*" element={<NotFound/>}/>
            </Routes>
        </div>

    );
}