import { useEffect, useRef } from 'react'
import { type DomainEvent, subscribeToDomainEvent } from '../api/domainEvents'

export function useDomainEvent<T>(resource: string, listener: (event: DomainEvent<T>) => void) {
  const listenerRef = useRef(listener)

  useEffect(() => {
    listenerRef.current = listener
  }, [listener])

  useEffect(() => {
    const controller = new AbortController()
    subscribeToDomainEvent<T>(resource, (event) => listenerRef.current(event), controller.signal)
    return () => controller.abort()
  }, [resource])
}
