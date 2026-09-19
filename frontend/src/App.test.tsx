import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Job, Participant } from './types'

const question = {
  id: 11,
  text: 'How do you design a resilient Go service?',
  type: 'open' as const,
  options: [],
  referenceAnswer: 'Use timeouts, retries, and idempotency.',
  deprecated: false,
}

const job: Job = {
  id: 7,
  title: 'Senior Go Engineer',
  description: 'Build reliable services.',
  seniority: 'Senior',
  position: 'Backend Engineer',
  labels: ['Platform'],
  requiredSkills: ['Go'],
  additionalSkills: ['Kubernetes'],
  status: 'draft',
  durationMinutes: 10,
  questions: [],
  createdAt: '2026-09-01T10:00:00Z',
}

const participant: Participant = {
  id: 3,
  firstName: 'Amélie',
  lastName: 'Dubois',
  email: 'amelie@example.com',
  contactInfo: 'Brussels · +32 470 00 00 00',
  traits: ['Go', 'PostgreSQL'],
  createdAt: '2026-09-02T10:00:00Z',
}

function response(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input)
      const method = options?.method ?? 'GET'
      if (path === '/api/auth/login')
        return response({
          token: 'jwt-token',
          user: { id: 1, email: 'admin@example.com', role: 'admin' },
        })
      if (path === '/api/jobs') return response([job])
      if (path === '/api/participants') return response([participant])
      if (path === '/api/jobs/7') return response(job)
      if (path === '/api/jobs/7/candidates')
        return response([
          {
            participant,
            score: 90,
            matchedTraits: ['Go'],
            missingTraits: [],
          },
        ])
      if (path === '/api/jobs/7/invitations' && method === 'GET') return response([])
      if (path === '/api/jobs/7/invitations' && method === 'POST')
        return response({
          id: 31,
          jobId: 7,
          participantId: 3,
          participantName: 'Amélie Dubois',
          participantEmail: 'amelie@example.com',
          token: 'invite-token',
          status: 'pending',
          participantUrl: 'https://example.test/interview/invite-token',
          acceptedAt: null,
          completedAt: null,
          createdAt: '2026-09-19T10:00:00Z',
        })
      if (path.startsWith('/api/questions') && method === 'GET') return response([question])
      if (path === '/api/questions' && method === 'POST')
        return response({ ...question, id: 12, text: 'Explain channels.' }, 201)
      if (path === '/api/questions/11' && method === 'PATCH')
        return response({ ...question, deprecated: true })
      if (path === '/api/questions/11' && method === 'PUT')
        return response({
          ...question,
          text: 'Updated resilience question',
          referenceAnswer: 'Prefer bounded retries with jitter.',
        })
      if (path === '/api/jobs/7/questions/11') return response({}, method === 'DELETE' ? 200 : 201)
      throw new Error(`Unexpected request: ${path}`)
    }),
  )
}

function authenticate() {
  sessionStorage.setItem('go-guess-token', 'jwt-token')
  sessionStorage.setItem(
    'go-guess-user',
    JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }),
  )
}

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Go Guess frontend', () => {
  beforeEach(() => {
    vi.useRealTimers()
    sessionStorage.clear()
    mockApi()
  })

  it('persists login, navigates from the login URL, and shows API jobs', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/login')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    await user.type(screen.getByLabelText(/email address/i), 'interviewer@go-guess.local')
    await user.type(screen.getByLabelText(/password/i), 'admin123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('heading', { name: 'Job postings' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Senior Go Engineer' })).toBeInTheDocument()
    expect(sessionStorage.getItem('go-guess-token')).toBe('jwt-token')
    expect(window.location.pathname).toBe('/jobs')
  })

  it('filters jobs by title', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/jobs')
    expect(await screen.findByRole('link', { name: 'Senior Go Engineer' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /search jobs/i }), 'designer')
    expect(screen.queryByRole('link', { name: 'Senior Go Engineer' })).not.toBeInTheDocument()
  })

  it('adds multiple choice options with the accessible plus button', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/jobs/7/questions/new')
    await screen.findByRole('heading', { name: 'Create a question' })
    await user.type(screen.getByLabelText('Reference answer'), 'This should be cleared.')
    await user.selectOptions(screen.getByLabelText('Response type'), 'multiple_choice')
    expect(screen.queryByLabelText('Reference answer')).not.toBeInTheDocument()

    const optionInput = screen.getByRole('textbox', { name: 'New option' })
    await user.type(optionInput, 'Retries')
    await user.click(screen.getByRole('button', { name: 'Add option' }))

    expect(screen.getByText('Retries')).toBeInTheDocument()
    expect(optionInput).toHaveValue('')

    await user.selectOptions(screen.getByLabelText('Response type'), 'open')
    expect(screen.getByLabelText('Reference answer')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Remove option Retries' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Response type'), 'code_review')
    expect(screen.getByLabelText('Expected answer')).toBeInTheDocument()
  })

  it('surfaces API failures instead of demo content', async () => {
    authenticate()
    vi.mocked(fetch).mockImplementation(() => response({ error: 'database unavailable' }, 500))
    renderApp('/jobs')

    expect(await screen.findByRole('alert')).toHaveTextContent('database unavailable')
    expect(screen.queryByRole('link', { name: 'Senior Go Engineer' })).not.toBeInTheDocument()
  })

  it('exposes participant multipart fields', async () => {
    authenticate()
    renderApp('/participants/new')
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    expect(screen.getByRole('heading', { name: 'Add a participant' })).toBeInTheDocument()
    expect(screen.getByLabelText(/birthday/i)).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText(/contact information/i)).toBeRequired()
    expect(screen.getByLabelText(/upload cv/i)).toHaveAttribute('accept', '.pdf,.doc,.docx')
  })

  it('creates and deprecates questions in the standalone library', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/questions')

    expect(await screen.findByText(question.text)).toBeInTheDocument()
    expect(screen.getByText(question.referenceAnswer)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: `Deprecated: ${question.text}` }))
    await user.type(screen.getByLabelText('Question prompt'), 'Explain channels.')
    await user.type(screen.getByLabelText('Reference answer'), 'Mention ownership and closure.')
    await user.click(screen.getByRole('button', { name: /create question/i }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/questions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: 'Explain channels.',
          type: 'open',
          options: [],
          referenceAnswer: 'Mention ownership and closure.',
        }),
      }),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/questions/11',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ deprecated: true }) }),
    )
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('populates and persists the reference answer while editing', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/questions')

    await user.click(await screen.findByRole('button', { name: `Edit ${question.text}` }))
    const prompt = screen.getByLabelText('Question prompt')
    await user.clear(prompt)
    await user.type(prompt, 'Updated resilience question')
    const reference = screen.getByLabelText('Reference answer')
    expect(reference).toHaveValue(question.referenceAnswer)
    await user.clear(reference)
    await user.type(reference, 'Prefer bounded retries with jitter.')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/questions/11',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          text: 'Updated resilience question',
          type: 'open',
          options: [],
          referenceAnswer: 'Prefer bounded retries with jitter.',
        }),
      }),
    )
  })

  it('attaches and detaches library questions without deleting them', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/jobs/7')

    await user.click(await screen.findByRole('tab', { name: /questions/i }))
    await user.click(await screen.findByRole('button', { name: 'Attach' }))
    await user.click(screen.getByRole('button', { name: `Detach ${question.text}` }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/jobs/7/questions/11',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/jobs/7/questions/11',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(fetch).not.toHaveBeenCalledWith(
      '/api/questions/11',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('sends invitations and displays the generated participant URL', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/jobs/7')

    await user.click(await screen.findByRole('tab', { name: /invitations/i }))
    await user.selectOptions(screen.getByLabelText('Eligible candidate'), '3')
    await user.click(screen.getByRole('button', { name: /send invitation/i }))

    expect(
      await screen.findByText('https://example.test/interview/invite-token'),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      '/api/jobs/7/invitations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ participantId: 3 }),
      }),
    )
  })

  it('navigates participant questions, persists answers, and derives the timer from acceptedAt', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-09-19T12:00:00Z')
    vi.setSystemTime(now)
    const interview = {
      invitation: {
        id: 31,
        jobId: 7,
        participantId: 3,
        participantName: 'Amélie Dubois',
        participantEmail: 'amelie@example.com',
        token: 'invite-token',
        status: 'pending',
        participantUrl: 'https://example.test/interview/invite-token',
        acceptedAt: null,
        completedAt: null,
        createdAt: now.toISOString(),
      },
      job: {
        id: 7,
        title: job.title,
        description: job.description,
        position: job.position,
        seniority: job.seniority,
        durationMinutes: 10,
        questions: [question, { ...question, id: 12, text: 'How do you test it?' }],
      },
      answers: {},
    }
    const acceptedInterview = {
      ...interview,
      invitation: {
        ...interview.invitation,
        status: 'accepted',
        acceptedAt: now.toISOString(),
      },
    }
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input)
      if (path === '/api/interviews/invite-token' && !options?.method) return response(interview)
      if (path.endsWith('/accept')) return response(acceptedInterview)
      if (path.includes('/answers/')) return response({})
      if (path.endsWith('/finish'))
        return response({
          ...acceptedInterview,
          invitation: {
            ...acceptedInterview.invitation,
            status: 'completed',
            completedAt: now.toISOString(),
          },
        })
      throw new Error(`Unexpected request: ${path}`)
    })
    renderApp('/interview/invite-token')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByRole('textbox', { name: 'Your answer' })).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Accept and start' }))
    })
    expect(screen.getByText(question.text)).toBeInTheDocument()
    expect(screen.queryByText(question.referenceAnswer)).not.toBeInTheDocument()
    expect(screen.getByTestId('countdown')).toHaveTextContent('10:00')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.getByTestId('countdown')).toHaveTextContent('09:59')

    fireEvent.change(screen.getByLabelText('Your answer'), {
      target: { value: 'Use retries and timeouts.' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    })
    expect(screen.getByText('How do you test it?')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      '/api/interviews/invite-token/answers/11',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ answer: 'Use retries and timeouts.' }),
      }),
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'First' }))
    })
    expect(screen.getByText(question.text)).toBeInTheDocument()
    vi.useRealTimers()
  })
})
