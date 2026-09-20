import { Inbox } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { User } from '../../types'

export function WorkspaceUtilities({ user }: { user: User | null }) {
  const profileLabel = user?.displayName || user?.email || 'Profile'
  return (
    <nav className="workspace-utilities" aria-label="Account navigation">
      <NavLink className="utility-link" to="/inbox">
        <Inbox size={18} aria-hidden="true" />
        <span>Inbox</span>
      </NavLink>
      <NavLink className="utility-link profile-utility" to="/profile">
        <span className="avatar tiny" aria-hidden="true">
          {profileLabel.slice(0, 2).toUpperCase()}
        </span>
        <span>{profileLabel}</span>
      </NavLink>
    </nav>
  )
}
