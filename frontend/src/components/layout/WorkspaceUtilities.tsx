import { CalendarDays, Mail } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { User } from '../../types'
import { ThemeControls } from '../../theme'
import { UserMenu } from './UserMenu'

export function WorkspaceUtilities({
  user,
  onSignOut,
}: {
  user: User | null
  onSignOut: () => void
}) {
  return (
    <nav className="workspace-utilities" aria-label="Account navigation">
      <NavLink className="utility-link" to="/invitations">
        <Mail size={18} aria-hidden="true" />
        <span>Invitations</span>
      </NavLink>
      <NavLink className="utility-link" to="/schedule">
        <CalendarDays size={18} aria-hidden="true" />
        <span>Schedule</span>
      </NavLink>
      <ThemeControls />
      <UserMenu user={user} onSignOut={onSignOut} />
    </nav>
  )
}
