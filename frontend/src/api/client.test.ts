import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, authStorage } from './client'

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
})
