import {useState} from 'react'
import {authStorage} from '../api/client'
import {AppFooter} from '../components/layout/AppFooter'
import {GoGuessHeader} from '../components/layout/GoGuessHeader'
import {WorkspaceUtilities} from '../components/layout/WorkspaceUtilities'
import ApplicationRoutes from "./ApplicationRoutes";

export function AuthenticatedApp({onLogout}: { onLogout: () => void }) {
    const [open, setOpen] = useState(false)
    const user = authStorage.user()

    return (
        <div className="app-shell">
            <GoGuessHeader setOpen={setOpen} open={open} onLogout={onLogout}/>
            <main className="main-content">
                <WorkspaceUtilities user={user} onSignOut={onLogout}/>
                <ApplicationRoutes/>
                <AppFooter/>
            </main>
        </div>
    )
}
