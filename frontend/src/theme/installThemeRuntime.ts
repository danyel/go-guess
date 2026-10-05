/**
 * Where the theme service lives, and whether it answered.
 *
 * The URL is read from the runtime config rather than baked into the bundle so
 * one image serves every environment: the entrypoint rewrites runtime-config.js
 * from the environment on start. A build-time variable is only the convenience
 * for `npm run dev`, where there is no entrypoint to do it.
 */
export interface RuntimeConfig {
  /** Origin of the go-bananas runtime, or empty when theming is not configured. */
  themeBaseUrl?: string
}

declare global {
  interface Window {
    __GO_GUESS_CONFIG__?: RuntimeConfig
  }
}

/** The marker the shipped controls read the base URL from. */
const CONTRACT_LINK_MARKER = 'data-theme-contract'

export function themeBaseUrl(): string {
  const configured = window.__GO_GUESS_CONFIG__?.themeBaseUrl
  if (configured) return configured.replace(/\/+$/, '')
  const built = import.meta.env.VITE_THEME_BASE_URL
  return built ? built.replace(/\/+$/, '') : ''
}

/** Whether the contract stylesheet is already on the page. */
function contractLinked(): boolean {
  return document.querySelector(`link[${CONTRACT_LINK_MARKER}]`) !== null
}

/**
 * Loads the shared styling contract and the two controls, once.
 *
 * The stylesheet goes in first and synchronously-ish, before the controls, so the
 * palette is applied before anything paints rather than flashing the application's
 * own colours and then swapping them.
 *
 * Everything here is best effort. A theme service that is unreachable, slow, or
 * not configured must not stop the application from working, so every failure
 * resolves quietly and the page keeps the values baked into the stylesheet.
 */
export async function installThemeRuntime(): Promise<void> {
  const base = themeBaseUrl()
  if (!base || contractLinked()) return

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${base}/rt/v1/contract.css`
  link.setAttribute(CONTRACT_LINK_MARKER, '')
  document.head.append(link)

  try {
    await import(/* @vite-ignore */ `${base}/rt/v1/components.js`)
  } catch {
    // The controls are custom elements, so a failure here leaves inert elements
    // in the page rather than an error. The contract stylesheet still applies, so
    // the palette follows the stored selection even without the picker.
  }
}
