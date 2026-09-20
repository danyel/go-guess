export interface DomainEvent<T = unknown> {
  type: string
  resource: string
  data: T
}

type DomainEventListener<T> = (event: DomainEvent<T>) => void

const target = new EventTarget()

export function publishDomainEvent<T>(resources: string[], type: string, data: T) {
  for (const resource of resources) {
    target.dispatchEvent(
      new CustomEvent(resource, {
        detail: { type, resource, data } satisfies DomainEvent<T>,
      }),
    )
  }
}

export function subscribeToDomainEvent<T>(
  resource: string,
  listener: DomainEventListener<T>,
  signal?: AbortSignal,
) {
  const handle = (event: Event) => listener((event as CustomEvent<DomainEvent<T>>).detail)
  target.addEventListener(resource, handle, { signal })
  return () => target.removeEventListener(resource, handle)
}
