import { LogOut, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '../../types'
import { Avatar } from '../ui/Avatar'

/**
 * The account menu in the workspace utilities bar.
 *
 * It is a disclosure rather than a hover menu: the trigger is a real button with
 * aria-expanded, the panel is labelled, Escape closes it, a click anywhere else
 * closes it, and focus returns to the trigger. A menu that only opens on hover
 * cannot be used from the keyboard or on a touch screen.
 *
 * The panel is not an ARIA menu. Its two actions are a link and a button, and
 * giving them menuitem roles would strip the link semantics from one of them for
 * no gain: everything here is reachable by tabbing, which is the behaviour that
 * matters.
 */
export function UserMenu({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const name = (user?.displayName || user?.email || 'Profile').trim()
  const email = user?.email ?? ''

  return (
    <div className="user-menu" ref={container}>
      <button
        type="button"
        ref={trigger}
        className="user-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar user={user} size="tiny" />
        {/* The trigger stays to the name alone: the address is one click away in
            the panel, and repeating it on every screen is noise. */}
        <span className="user-menu-identity">
          <span className="user-menu-name">{name}</span>
        </span>
      </button>

      {open && (
        <div className="user-menu-panel" id={panelId} aria-label="Account">
          <div className="user-menu-header">
            <Avatar user={user} size="large" />
            <div>
              <p className="user-menu-panel-name">{name}</p>
              {email && <p className="user-menu-panel-email">{email}</p>}
            </div>
          </div>
          <Link className="user-menu-item" to="/profile" onClick={() => setOpen(false)}>
            <UserRound size={18} aria-hidden="true" />
            <span>Profile</span>
          </Link>
          <button
            type="button"
            className="user-menu-item"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}
