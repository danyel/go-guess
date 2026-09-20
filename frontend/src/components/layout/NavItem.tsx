import { NavLink } from 'react-router-dom'
import { ReactNode } from 'react'

export function NavItem({
  to,
  label,
  icon,
  close,
}: {
  to: string
  label: string
  icon: ReactNode
  close: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={close}
      className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
    >
      {icon}
      {label}
    </NavLink>
  )
}
