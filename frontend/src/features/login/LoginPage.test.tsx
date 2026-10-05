import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

function stubLocation() {
  const location = { assign: vi.fn(), replace: vi.fn(), hostname: 'nmbs.guess.urpi.be' }
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: location,
  })
  return location
}

function renderPage(ssoAvailable: boolean | null) {
  return render(
    <MemoryRouter>
      <LoginPage onLogin={vi.fn()} sessionExpired={false} ssoAvailable={ssoAvailable} />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('offers only the Go Loose button while the answer is unknown', () => {
    renderPage(null)
    expect(screen.getByRole('button', { name: /sign in with go loose/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument()
  })

  it('offers only the Go Loose button where Go Loose is configured', () => {
    renderPage(true)
    expect(screen.getByRole('button', { name: /sign in with go loose/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument()
  })

  it('sends the browser to Go Loose rather than routing there', async () => {
    // A router push cannot follow a redirect chain across two origins, so this has
    // to be a real navigation.
    const location = stubLocation()
    const user = userEvent.setup()
    renderPage(true)
    await user.click(screen.getByRole('button', { name: /sign in with go loose/i }))
    expect(location.assign).toHaveBeenCalledWith('/api/auth/login')
  })

  it('falls back to the password form on a host without Go Loose login', () => {
    renderPage(false)
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in with go loose/i })).not.toBeInTheDocument()
  })

  it('says why the password form is being shown', () => {
    renderPage(false)
    expect(screen.getByText(/single sign-on is not configured/i)).toBeInTheDocument()
  })
})
