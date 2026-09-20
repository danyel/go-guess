import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, authStorage, SESSION_EXPIRED_EVENT } from './client'
import { subscribeToDomainEvent } from './domainEvents'

describe('API client', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('sends the persisted bearer token on protected requests', async () => {
    authStorage.save({
      token: 'signed-jwt',
      user: { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin' },
    })

    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await api.jobs.list()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/jobs',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer signed-jwt' }),
      }),
    )
  })

  it('invalidates the session when a protected request is unauthorized', async () => {
    authStorage.save({
      token: 'expired-jwt',
      user: { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin' },
    })
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired, { once: true })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'session expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(api.jobs.list()).rejects.toMatchObject({ status: 401 })

    expect(authStorage.token()).toBeNull()
    expect(authStorage.user()).toBeNull()
    expect(expired).toHaveBeenCalledOnce()
  })

  it('uses the backend participant multipart field names', async () => {
    authStorage.save({
      token: 'signed-jwt',
      user: { id: 1, email: 'admin@example.com', displayName: 'Admin', role: 'admin' },
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 4,
          firstName: 'A',
          lastName: 'B',
          email: 'a@example.com',
          contactInfo: 'Brussels',
          traits: [],
          createdAt: '2026-09-01T00:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await api.participants.create({
      firstName: 'A',
      lastName: 'B',
      birthday: '1990-01-02',
      email: 'a@example.com',
      contactInfo: 'Brussels',
    })

    const options = fetchMock.mock.calls[0][1] as RequestInit
    const form = options.body as FormData
    expect([...form.keys()]).toEqual(['firstName', 'lastName', 'birthday', 'email', 'contactInfo'])
  })

  it('publishes an entity event after a successful mutation', async () => {
    const job = {
      id: 7,
      title: 'Backend engineer',
      description: 'Build APIs',
      seniority: 'senior',
      position: 'backend',
      labels: [],
      requiredSkills: ['Go'],
      additionalSkills: [],
      status: 'published',
      durationMinutes: 60,
      questions: [],
      createdAt: '2026-09-01T00:00:00Z',
    } as const
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(job), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeToDomainEvent(`jobs/${job.id}`, listener)

    await api.jobs.update(job.id, { status: 'published', durationMinutes: 60 })

    expect(listener).toHaveBeenCalledWith({
      resource: 'jobs/7',
      type: 'job.updated',
      data: job,
    })
    unsubscribe()
  })

  it('does not publish an event when a mutation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid transition' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeToDomainEvent('scheduled-interviews/80', listener)

    await expect(api.scheduledInterviews.setStatus(80, 'started')).rejects.toMatchObject({
      status: 409,
    })

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
