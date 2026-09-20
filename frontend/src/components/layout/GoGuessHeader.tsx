import { Menu } from 'lucide-react'
import Logo from './Logo'
import { SideBar } from './SideBar'

export function GoGuessHeader({
  open,
  setOpen,
  onLogout,
}: {
  open: boolean
  setOpen: (value: boolean) => void
  onLogout: () => void
}) {
  return (
    <>
      <header className="mobile-header">
        <Logo />
        <button className="icon-button" onClick={() => setOpen(true)} aria-label="Open navigation">
          <Menu />
        </button>
      </header>
      {open && (
        <button
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <SideBar open={open} setOpen={setOpen} onLogout={onLogout} />
    </>
  )
}
