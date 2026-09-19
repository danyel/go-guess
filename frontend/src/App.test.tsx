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
  codeSnippet: '',
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
            missingTraits: null,
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
          participantUrl: 'https://example.test/participant/invite-token',
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
          type: 'code_review',
          referenceAnswer: 'Prefer bounded retries with jitter.',
          codeSnippet: '+ return retry(request)',
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

  it('renders candidate matches when an older API returns null trait arrays', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/jobs/7')

    await user.click(await screen.findByRole('tab', { name: /candidate match/i }))

    expect(await screen.findByText('90%')).toBeInTheDocument()
    expect(screen.getByText('Missing').nextElementSibling).toHaveTextContent('0')
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
    expect(screen.getByLabelText('Code snippet')).toBeRequired()
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
          codeSnippet: '',
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
    const codeReviewQuestion = {
      ...question,
      id: 21,
      type: 'code_review' as const,
      text: 'Review this retry change',
      codeSnippet: '+ return retry(request)',
    }
    const defaultFetch = vi.mocked(fetch).getMockImplementation()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input)
      const method = options?.method ?? 'GET'
      if (path.startsWith('/api/questions') && method === 'GET')
        return response([codeReviewQuestion])
      if (path === '/api/questions/21' && method === 'PUT')
        return response({
          ...codeReviewQuestion,
          text: 'Updated resilience question',
          referenceAnswer: 'Prefer bounded retries with jitter.',
        })
      if (!defaultFetch) throw new Error(`Unexpected request: ${path}`)
      return defaultFetch(input, options)
    })
    renderApp('/questions')

    await user.click(await screen.findByRole('button', { name: `Edit ${codeReviewQuestion.text}` }))
    const prompt = screen.getByLabelText('Question prompt')
    await user.clear(prompt)
    await user.type(prompt, 'Updated resilience question')
    const reference = screen.getByLabelText('Expected answer')
    expect(reference).toHaveValue(codeReviewQuestion.referenceAnswer)
    expect(screen.getByLabelText('Code snippet')).toHaveValue(codeReviewQuestion.codeSnippet)
    await user.clear(reference)
    await user.type(reference, 'Prefer bounded retries with jitter.')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/questions/21',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          text: 'Updated resilience question',
          type: 'code_review',
          options: [],
          referenceAnswer: 'Prefer bounded retries with jitter.',
          codeSnippet: '+ return retry(request)',
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

  it('generates an invitation for an eligible participant and displays its URL', async () => {
    authenticate()
    const user = userEvent.setup()
    renderApp('/jobs/7')

    await user.click(await screen.findByRole('tab', { name: /invitations/i }))
    await user.click(screen.getByRole('button', { name: 'Generate invitation' }))

    expect(
      await screen.findByText('https://example.test/participant/invite-token'),
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
        participantUrl: 'https://example.test/participant/invite-token',
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
    renderApp('/participant/invite-token')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.queryByText(question.text)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Your answer' })).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    })
    expect(screen.getByText(question.text)).toBeInTheDocument()
    expect(screen.queryByText(question.referenceAnswer)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Interview progress' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    for (const name of ['First', 'Previous', 'Next', 'Last', 'Submit']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
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
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/interviews/invite-token/finish',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.getByRole('heading', { name: /thank you/i })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('renders protected invitation answers for interviewer review', async () => {
    authenticate()
    const user = userEvent.setup()
    const acceptedInvitation = {
      id: 44,
      jobId: 7,
      participantId: 3,
      participantName: 'Amélie Dubois',
      participantEmail: 'amelie@example.com',
      token: 'review-token',
      status: 'accepted',
      participantUrl: 'https://example.test/participant/review-token',
      acceptedAt: '2026-09-19T10:05:00Z',
      completedAt: null,
      createdAt: '2026-09-19T10:00:00Z',
    }
    const choiceQuestion = {
      ...question,
      id: 22,
      text: 'Choose a strategy',
      type: 'radio' as const,
      options: ['Retry', 'Fail fast'],
      referenceAnswer: '',
    }
    const codeQuestion = {
      ...question,
      id: 23,
      text: 'Review the patch',
      type: 'code_review' as const,
      codeSnippet: '+ return retry(request)',
      referenceAnswer: 'Bound the retry count.',
    }
    const defaultFetch = vi.mocked(fetch).getMockImplementation()
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
      const path = String(input)
      if (path === '/api/jobs/7/invitations' && !options?.method)
        return response([acceptedInvitation])
      if (path === '/api/jobs/7/invitations/44')
        return response({
          invitation: acceptedInvitation,
          job: {
            id: 7,
            title: job.title,
            description: job.description,
            position: job.position,
            seniority: job.seniority,
            durationMinutes: job.durationMinutes,
            questions: [question, choiceQuestion, codeQuestion],
          },
          answers: {
            '11': 'Use exponential backoff.',
            '23': 'The retry loop needs a maximum.',
          },
        })
      if (!defaultFetch) throw new Error(`Unexpected request: ${path}`)
      return defaultFetch(input, options)
    })
    renderApp('/jobs/7')

    await user.click(await screen.findByRole('tab', { name: /invitations/i }))
    await user.click(screen.getByRole('button', { name: 'Review answers' }))

    expect(await screen.findByRole('heading', { name: 'Amélie Dubois' })).toBeInTheDocument()
    expect(screen.getByText('Use exponential backoff.')).toBeInTheDocument()
    expect(screen.getByText(question.referenceAnswer)).toBeInTheDocument()
    expect(screen.getByText('Retry · Fail fast')).toBeInTheDocument()
    expect(screen.getByText('Unanswered')).toBeInTheDocument()
    expect(screen.getByText('The retry loop needs a maximum.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Code changes' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/jobs/7/invitations/44', expect.any(Object))
  })

  it('renders code review lines and a review comment without exposing the reference answer', async () => {
    const now = new Date()
    const codeQuestion = {
      ...question,
      id: 20,
      type: 'code_review' as const,
      text: 'Review this change',
      codeSnippet: ['func total() int {', '+  return 42', '}'].join('\n'),
      referenceAnswer: 'The hard-coded value should be replaced.',
    }
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const path = String(input)
      if (path === '/api/interviews/code-token')
        return response({
          invitation: {
            id: 32,
            jobId: 7,
            participantId: 3,
            participantName: 'Amélie Dubois',
            participantEmail: 'amelie@example.com',
            token: 'code-token',
            status: 'accepted',
            participantUrl: 'https://example.test/participant/code-token',
            acceptedAt: now.toISOString(),
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
            questions: [codeQuestion],
          },
          answers: {},
        })
      throw new Error(`Unexpected request: ${path}`)
    })

    const { container } = renderApp('/participant/code-token')

    expect(await screen.findByRole('region', { name: 'Code changes' })).toBeInTheDocument()
    expect(container.querySelectorAll('.code-line')).toHaveLength(3)
    expect(container.querySelector('.code-line.added code')?.textContent).toBe('+  return 42')
    expect(screen.getByRole('textbox', { name: 'Review comment' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.queryByText(codeQuestion.referenceAnswer)).not.toBeInTheDocument()
  })
})
