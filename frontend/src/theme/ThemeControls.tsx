import { themeBaseUrl } from './installThemeRuntime'

/**
 * The palette picker and the appearance toggle.
 *
 * Both are the custom elements go-bananas ships rather than components written
 * here. That is the whole point of the service: the applications it feeds are a
 * mix of React, vanilla JavaScript and server-rendered HTML, and a custom element
 * is the one shape all three can use without a build step, an import map, or a
 * second copy of React. React treats an unknown element as an inert host node, so
 * rendering them unconditionally is safe: with no theme service configured they
 * simply stay empty.
 *
 * Neither takes a `base` prop. They read the service origin from the contract
 * stylesheet already on the page, which is the one place it is configured, so
 * there is no second place to get wrong.
 *
 * Whether to render at all is a plain read rather than state: the runtime config
 * is written before the first render and does not change afterwards, so there is
 * nothing to track and no effect to wait on.
 */
export function ThemeControls() {
  if (!themeBaseUrl()) return null

  return (
    <div className="theme-controls">
      <bananas-appearance-toggle label="Appearance" />
      <bananas-theme-selector label="Palette" />
    </div>
  )
}
