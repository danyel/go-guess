import { afterEach, describe, expect, it, vi } from 'vitest'
import { installThemeRuntime, themeBaseUrl } from './installThemeRuntime'

const CONTRACT_LINK_MARKER = 'data-theme-contract'

function config(themeBaseUrl: string) {
  window.__GO_GUESS_CONFIG__ = { themeBaseUrl }
}

afterEach(() => {
  delete window.__GO_GUESS_CONFIG__
  document.head.innerHTML = ''
  vi.restoreAllMocks()
})

describe('themeBaseUrl', () => {
  it('is empty when nothing is configured', () => {
    expect(themeBaseUrl()).toBe('')
  })

  it('reads the runtime config the entrypoint writes', () => {
    config('https://themes.example.com')
    expect(themeBaseUrl()).toBe('https://themes.example.com')
  })

  it('tolerates a trailing slash, which would otherwise double up in the path', () => {
    config('https://themes.example.com/')
    expect(themeBaseUrl()).toBe('https://themes.example.com')
  })
})

describe('installThemeRuntime', () => {
  it('does nothing when no theme service is configured', async () => {
    config('')
    await installThemeRuntime()
    expect(document.head.querySelector(`link[${CONTRACT_LINK_MARKER}]`)).toBeNull()
  })

  it('adds the contract stylesheet, marked so the controls can find the origin', async () => {
    config('https://themes.example.com')
    await installThemeRuntime()
    const link = document.head.querySelector<HTMLLinkElement>(`link[${CONTRACT_LINK_MARKER}]`)
    expect(link).not.toBeNull()
    expect(link!.rel).toBe('stylesheet')
    expect(link!.href).toBe('https://themes.example.com/rt/v1/contract.css')
  })

  it('adds the stylesheet only once, however often it is called', async () => {
    config('https://themes.example.com')
    await installThemeRuntime()
    await installThemeRuntime()
    await installThemeRuntime()
    expect(document.head.querySelectorAll(`link[${CONTRACT_LINK_MARKER}]`)).toHaveLength(1)
  })

  it('resolves rather than throwing when the module cannot be fetched', async () => {
    // A theme service that is down must not stop the application. The controls are
    // custom elements, so failing to load leaves inert elements and the page keeps
    // the values baked into its own stylesheet.
    config('https://themes.example.com')
    await expect(installThemeRuntime()).resolves.toBeUndefined()
    // The stylesheet is still requested, so the palette follows whatever
    // selection is already stored even with no picker to change it.
    expect(document.head.querySelector(`link[${CONTRACT_LINK_MARKER}]`)).not.toBeNull()
  })
})
