import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSSOHost, useAuthSession } from './Account'

interface FakeLocation {
  hostname: string
  pathname: string
  assign: ReturnType<typeof vi.fn>
  replace: ReturnType<typeof vi.fn>
}

function setHost(hostname: string, pathname = '/'): FakeLocation {
  const location: FakeLocation = {
    hostname,
    pathname,
    assign: vi.fn(),
    replace: vi.fn(),
  }
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: location,
  })
  return location
}

function json(body: unknown, status: number) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function Probe() {
  const { authenticated, ssoAvailable } = useAuthSession()
  return <p>{`${String(ssoAvailable)}|${String(authenticated)}`}</p>
}

function renderProbe(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  )
}

const authResponse = {
  token: 'sso-token',
  user: { id: 1, email: 'ssuser@example.com', displayName: 'SSO', role: 'interviewer' },
}

describe('isSSOHost', () => {
  it('recognises tenant hosts on the development and production domains', () => {
    for (const hostname of [
      'nmbs.guess-dev.urpi.be',
      'ypto.guess-dev.urpi.be',
      'nmbs.guess.urpi.be',
      'ypto.guess.urpi.be',
    ]) {
      setHost(hostname)
      expect(isSSOHost(), hostname).toBe(true)
    }
  })

  it('ignores localhost and raw addresses', () => {
    for (const hostname of ['localhost', '127.0.0.1', '']) {
      setHost(hostname)
      expect(isSSOHost(), hostname).toBe(false)
    }
  })
})

describe('useAuthSession Go Loose bootstrap', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('signs in from an existing Go Loose session without leaving the page', async () => {
    const location = setHost('nmbs.guess-dev.urpi.be')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json(authResponse, 200)),
    )

    renderProbe()

    await waitFor(() => expect(screen.getByText('true|true')).toBeInTheDocument())
    expect(sessionStorage.getItem('go-guess-token')).toBe('sso-token')
    expect(location.replace).not.toHaveBeenCalled()
  })

  it('leaves the sign-in screen in place when there is no session', async () => {
    // Signing in starts from the screen and one button. Redirecting on sight would
    // skip past the screen and fire on every anonymous visit, which reads as a
    // redirect loop rather than as a choice to sign in.
    const location = setHost('nmbs.guess.urpi.be')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ error: 'missing Go Loose session' }, 401)),
    )

    renderProbe()

    await waitFor(() => expect(screen.getByText('true|false')).toBeInTheDocument())
    expect(location.replace).not.toHaveBeenCalled()
    expect(location.assign).not.toHaveBeenCalled()
  })

  it('keeps the single sign-on button when the API cannot be reached', async () => {
    // Nothing answers, so there is no way to know whether Go Loose is configured.
    // The button is the only way in on such a host, so it stays.
    const location = setHost('nmbs.guess.urpi.be')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    )

    renderProbe()

    await waitFor(() => expect(screen.getByText('null|false')).toBeInTheDocument())
    expect(location.assign).not.toHaveBeenCalled()
  })

  it('falls back to password sign-in when the API reports no Go Loose login', async () => {
    const location = setHost('nmbs.guess-dev.urpi.be')
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ error: 'Go Loose browser login is not enabled' }, 404)),
    )

    renderProbe()

    // false is what switches the screen from the button to the password form.
    await waitFor(() => expect(screen.getByText('false|false')).toBeInTheDocument())
    expect(location.replace).not.toHaveBeenCalled()
  })

  it('never probes the session outside a tenant host', async () => {
    setHost('localhost')
    const fetchMock = vi.fn(() => json(authResponse, 200))
    vi.stubGlobal('fetch', fetchMock)

    renderProbe()

    // A host with no tenant label cannot have Go Loose login, so it is false
    // without asking the API anything.
    await waitFor(() => expect(screen.getByText('false|false')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips the bootstrap on participant routes', async () => {
    const location = setHost('nmbs.guess-dev.urpi.be', '/participant/meeting/token')
    const fetchMock = vi.fn(() => json(authResponse, 200))
    vi.stubGlobal('fetch', fetchMock)

    renderProbe('/participant/meeting/token')

    await waitFor(() => expect(screen.getByText('null|false')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
    expect(location.replace).not.toHaveBeenCalled()
  })
})
