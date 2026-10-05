import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '../../types'
import { UserMenu } from './UserMenu'

const user: User = {
  id: 1,
  email: 'ada@example.test',
  displayName: 'Ada Lovelace',
  role: 'interviewer',
  avatarUrl: 'https://auth.example.test/api/v1/avatars/kZ3abc',
}

function renderMenu(onSignOut = vi.fn()) {
  render(
    <MemoryRouter>
      <UserMenu user={user} onSignOut={onSignOut} />
    </MemoryRouter>,
  )
  return onSignOut
}

function trigger() {
  return screen.getByRole('button', { name: /Ada Lovelace/ })
}

describe('UserMenu', () => {
  it('starts closed and says so', () => {
    renderMenu()
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument()
  })

  it('opens and closes on the trigger', async () => {
    const user_ = userEvent.setup()
    renderMenu()
    await user_.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile')

    await user_.click(trigger())
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user_ = userEvent.setup()
    renderMenu()
    await user_.click(trigger())
    await user_.keyboard('{Escape}')
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
    expect(trigger()).toHaveFocus()
  })

  it('closes when the click lands outside it', async () => {
    const user_ = userEvent.setup()
    render(
      <MemoryRouter>
        <div>
          <UserMenu user={user} onSignOut={vi.fn()} />
          <button type="button">elsewhere</button>
        </div>
      </MemoryRouter>,
    )
    await user_.click(trigger())
    await user_.click(screen.getByRole('button', { name: 'elsewhere' }))
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('signs out and closes', async () => {
    const user_ = userEvent.setup()
    const onSignOut = renderMenu()
    await user_.click(trigger())
    await user_.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(trigger()).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the picture and the address once open', async () => {
    const user_ = userEvent.setup()
    renderMenu()
    await user_.click(trigger())
    const panel = screen.getByRole('link', { name: 'Profile' }).closest('.user-menu-panel')!
    expect(within(panel as HTMLElement).getByText('ada@example.test')).toBeInTheDocument()
    expect(within(panel as HTMLElement).getByTestId('avatar-image')).toBeInTheDocument()
  })

  it('falls back to the address when there is no name', () => {
    render(
      <MemoryRouter>
        <UserMenu user={{ ...user, displayName: '' }} onSignOut={vi.fn()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /ada@example.test/ })).toBeInTheDocument()
  })
})
