import { describe, expect, it, vi } from 'vitest'
import { publishDomainEvent, subscribeToDomainEvent } from './domainEvents'

describe('domain events', () => {
  it('delivers an event only to its resource subscribers', () => {
    const jobListener = vi.fn()
    const otherListener = vi.fn()
    const unsubscribeJob = subscribeToDomainEvent('jobs/7', jobListener)
    const unsubscribeOther = subscribeToDomainEvent('jobs/8', otherListener)

    publishDomainEvent(['jobs', 'jobs/7'], 'job.updated', { id: 7 })

    expect(jobListener).toHaveBeenCalledWith({
      resource: 'jobs/7',
      type: 'job.updated',
      data: { id: 7 },
    })
    expect(otherListener).not.toHaveBeenCalled()
    unsubscribeJob()
    unsubscribeOther()
  })

  it('stops delivering events after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToDomainEvent('questions/2', listener)
    unsubscribe()

    publishDomainEvent(['questions/2'], 'question.updated', { id: 2 })

    expect(listener).not.toHaveBeenCalled()
  })
})
