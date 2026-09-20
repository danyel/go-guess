import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, authStorage } from '../../../api/client'
import { errorMessage } from '../../../components/actions'
import type { ScheduledInterview } from '../../../types'
import { InterviewCard } from './InterviewCard'

export function InvitationCard({
  invitation,
  onError,
}: {
  invitation: ScheduledInterview
  onError: (message: string) => void
}) {
  async function respond(status: 'accepted' | 'declined') {
    onError('')
    try {
      await api.inbox.respond(invitation.id, status)
    } catch (error) {
      onError(errorMessage(error))
    }
  }

  return (
    <InterviewCard
      interview={invitation}
      onConnectionError={(error) => onError(errorMessage(error))}
    >
      {(current) =>
        (current.attendees.find((attendee) => attendee.userId === authStorage.user()?.id)?.status ??
          current.status) === 'pending' ? (
          <div className="meeting-actions">
            <button
              className="button primary"
              type="button"
              onClick={() => void respond('accepted')}
            >
              <Check size={17} /> Accept
            </button>
            <button
              className="button secondary danger"
              type="button"
              onClick={() => void respond('declined')}
            >
              <X size={17} /> Decline
            </button>
          </div>
        ) : (
          <Link className="button secondary" to={`/scheduled-interviews/${current.id}`}>
            Open session
          </Link>
        )
      }
    </InterviewCard>
  )
}
