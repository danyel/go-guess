import { afterEach, expect, it, vi } from 'vitest'
import { copyText } from './copyText'

const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand')

afterEach(() => {
  vi.restoreAllMocks()
  if (originalExecCommand) {
    Object.defineProperty(document, 'execCommand', originalExecCommand)
  } else {
    Reflect.deleteProperty(document, 'execCommand')
  }
})

it('falls back to a selected textarea when the Clipboard API is unavailable', async () => {
  const copy = vi.fn().mockReturnValue(true)
  Object.defineProperty(document, 'execCommand', { configurable: true, value: copy })

  await copyText('http://ypto.guess.local:5173/participant/token')

  expect(copy).toHaveBeenCalledWith('copy')
  expect(document.querySelector('textarea')).toBeNull()
})
