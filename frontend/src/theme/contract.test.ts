import { describe, expect, it } from 'vitest'
// The stylesheet is imported as text rather than read from disk: this keeps Node
// APIs out of a project whose tsconfig deliberately does not include them, so
// application code cannot reach for one by accident.
import stylesheet from '../styles/global.css?raw'

/**
 * The contract is a remote document, so the way this application consumes it can
 * rot quietly: a token renamed on the service leaves every `var(--bn-*, fallback)`
 * resolving to its fallback, and the page looks fine while never actually
 * following the palette. Nothing else would catch that.
 *
 * This reads the stylesheet, takes every contract variable the application asks
 * for, and checks the real contract defines each one. It is skipped when no theme
 * service is configured, so an ordinary checkout does not need one.
 */
const baseUrl = (
  import.meta.env.THEME_BASE_URL ??
  import.meta.env.VITE_THEME_BASE_URL ??
  ''
).replace(/\/+$/, '')

/** Every `--bn-*` name the stylesheet consumes. */
function contractVariablesUsed(): string[] {
  const found = new Set<string>()
  const pattern = /var\(\s*(--bn-[a-z0-9-]+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(stylesheet)) !== null) {
    found.add(match[1]!)
  }
  return [...found].sort()
}

describe('the styling contract', () => {
  const used = contractVariablesUsed()

  it('consumes the contract rather than hardcoding a palette', () => {
    expect(used.length).toBeGreaterThan(0)
  })

  it('gives every contract variable a fallback, so a missing service changes nothing', () => {
    // Each use must carry a second argument. A bare var(--bn-x) with no fallback
    // resolves to nothing at all when the service is absent, which is how a
    // half-configured deployment ends up with invisible text.
    const bare = [...stylesheet.matchAll(/var\(\s*(--bn-[a-z0-9-]+)\s*\)/g)].map((m) => m[1]!)
    expect(bare).toEqual([])
  })

  it.runIf(baseUrl)('defines every variable this application asks for', async () => {
    const response = await fetch(`${baseUrl}/rt/v1/contract.css`)
    expect(response.status, `fetching the contract from ${baseUrl}`).toBe(200)
    const contract = await response.text()

    const defined = new Set<string>()
    for (const match of contract.matchAll(/(--bn-[a-z0-9-]+)\s*:/g)) {
      defined.add(match[1]!)
    }

    const missing = used.filter((name) => !defined.has(name))
    expect(missing, `the contract at ${baseUrl} does not define these`).toEqual([])
  })
})
