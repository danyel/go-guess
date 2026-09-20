import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useDomainEvent } from '../../app/useDomainEvent'
import { errorMessage } from '../../components/actions'
import { ErrorAlert, Loading } from '../../components/ui/AsyncState'
import type { ScheduledInterview } from '../../types'
import { InvitationCard } from './components/InvitationCard'

export function InvitationPage() {
  const [items, setItems] = useState<ScheduledInterview[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.inbox
      .list()
      .then(setItems)
      .catch((value) => setError(errorMessage(value)))
      .finally(() => setLoading(false))
  }, [])

  useDomainEvent<ScheduledInterview>('invitations', (event) => {
    setItems((current) => current.map((item) => (item.id === event.data.id ? event.data : item)))
  })

  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">Interview team</span>
          <h1>Invitations</h1>
          <p>Respond to interview invitations assigned to you.</p>
        </div>
      </header>
      {error && <ErrorAlert error={error} />}
      {loading ? (
        <Loading />
      ) : (
        <section className="meeting-list">
          {items.map((item) => (
            <InvitationCard invitation={item} onError={setError} key={item.id} />
          ))}
          {!items.length && (
            <div className="card empty-state">
              <h3>Invitation zero</h3>
              <p>You have no interview invitations.</p>
            </div>
          )}
        </section>
      )}
    </>
  )
}
