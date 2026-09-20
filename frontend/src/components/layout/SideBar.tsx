import {
  BriefcaseBusiness,
  CalendarDays,
  CircleHelp,
  LogOut,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import Logo from './Logo'
import { NavItem } from './NavItem'

export function SideBar({
  open,
  setOpen,
  onLogout,
}: {
  open: boolean
  setOpen: (value: boolean) => void
  onLogout: () => void
}) {
  const close = () => setOpen(false)
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-top">
        <Logo />
        <button className="icon-button mobile-only" onClick={close} aria-label="Close navigation">
          <X />
        </button>
      </div>
      <nav aria-label="Primary navigation">
        <p className="nav-label">Workspace</p>
        <NavItem to="/jobs" label="Jobs" icon={<BriefcaseBusiness size={20} />} close={close} />
        <NavItem
          to="/participants"
          label="Participants"
          icon={<UsersRound size={20} />}
          close={close}
        />
        <NavItem
          to="/questions"
          label="Question library"
          icon={<CircleHelp size={20} />}
          close={close}
        />
        <NavItem to="/users" label="Users" icon={<UserRound size={20} />} close={close} />
      </nav>
      <div className="sidebar-bottom">
        <button className="sidebar-signout" onClick={onLogout}>
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
