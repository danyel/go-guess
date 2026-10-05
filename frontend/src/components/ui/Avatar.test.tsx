import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { User } from '../../types'
import { Avatar } from './Avatar'
import { initialsFor } from './initials'

const withPicture = {
  displayName: 'Ada Lovelace',
  email: 'ada@example.test',
  avatarUrl: 'https://auth.example.test/api/v1/avatars/kZ3abc',
}
const withoutPicture = { displayName: 'Ada Lovelace', email: 'ada@example.test' }

function renderAvatar(user: Partial<Pick<User, 'displayName' | 'email' | 'avatarUrl'>> | null) {
  return render(<Avatar user={user} />)
}

describe('initialsFor', () => {
  it('uses the first letter of the first two words', () => {
    expect(initialsFor('Ada Lovelace')).toBe('AL')
    expect(initialsFor('Ada Byron King Lovelace')).toBe('AB')
  })

  it('falls back to the address, and to a single name', () => {
    expect(initialsFor('', 'ada@example.test')).toBe('AD')
    expect(initialsFor('Prince')).toBe('PR')
  })

  it('has something to show for nothing at all', () => {
    expect(initialsFor('', '')).toBe('?')
    expect(initialsFor(null, null)).toBe('?')
  })
})

describe('Avatar', () => {
  it('renders the picture Go Loose serves', () => {
    renderAvatar(withPicture)
    const image = screen.getByTestId('avatar-image').querySelector('img')
    expect(image).toHaveAttribute('src', withPicture.avatarUrl)
    // The surrounding element already names the person, so the image itself is
    // decorative and must not be announced twice.
    expect(image).toHaveAttribute('alt', '')
  })

  it('falls back to initials when there is no picture', () => {
    renderAvatar(withoutPicture)
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('AL')
  })

  it('falls back to initials when the stored link no longer resolves', () => {
    // Go Loose retires a picture key when the picture changes, so a cached URL in
    // this browser can be dead. A broken image icon would be worse than initials.
    renderAvatar(withPicture)
    const image = screen.getByTestId('avatar-image').querySelector('img')!
    // An error event on an image does not bubble, so React only sees it when the
    // event is dispatched through the testing library.
    fireEvent.error(image)
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('AL')
  })

  it('has something to show for no user at all', () => {
    // With no person there is no name either, so the neutral placeholder the rest
    // of the interface uses stands in.
    renderAvatar(null)
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('PR')
  })
})

describe('Avatar sizing', () => {
  it('carries the requested size', () => {
    const { container } = render(<Avatar user={withoutPicture} size="tiny" className="extra" />)
    const avatar = container.querySelector('.avatar')!
    expect(avatar.className).toContain('tiny')
    expect(avatar.className).toContain('extra')
  })
})
