import { useState } from 'react'
import type { User } from '../../types'
import { initialsFor } from './initials'

/**
 * A person's picture, falling back to their initials.
 *
 * The URL comes from Go Loose and stops resolving the moment the picture is
 * replaced or removed there, because retiring the key is what stops a stale link
 * from being a privacy problem. A cached copy in this browser can therefore be
 * dead, so a failed load falls back rather than leaving a broken image. An empty
 * or absent URL is the common case for anyone who has not uploaded one.
 */
export function Avatar({
  user,
  size = 'default',
  className = '',
}: {
  user: Partial<Pick<User, 'displayName' | 'email' | 'avatarUrl'>> | null
  size?: 'tiny' | 'default' | 'large'
  className?: string
}) {
  const url = user?.avatarUrl ?? ''
  // Remembering which URL failed, rather than a bare flag, means a new picture
  // for the same person is retried without an effect to reset anything.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const failed = failedUrl === url && url !== ''

  const classes = ['avatar', size === 'default' ? '' : size, className].filter(Boolean).join(' ')
  const label = (user?.displayName || user?.email || 'Profile').trim()

  if (!url || failed) {
    return (
      <span className={classes} aria-hidden="true" data-testid="avatar-fallback">
        {initialsFor(label)}
      </span>
    )
  }
  return (
    <span className={classes} data-testid="avatar-image">
      <img src={url} alt="" onError={() => setFailedUrl(url)} />
      <span className="sr-only">{label}</span>
    </span>
  )
}
