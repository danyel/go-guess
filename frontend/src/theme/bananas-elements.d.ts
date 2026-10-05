import type { DetailedHTMLProps, HTMLAttributes } from 'react'

/**
 * The custom elements go-bananas ships.
 *
 * React needs to be told about an unknown element before it will render one, and
 * declaring them here is the whole integration: the tags, the attributes they
 * accept, and nothing else. The behaviour lives in the service, so there is
 * nothing to keep in step.
 *
 * `label` is read by both controls for their accessible name.
 */
type BananasControl = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  /** Accessible name for the control. */
  label?: string
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'bananas-theme-selector': BananasControl
      'bananas-appearance-toggle': BananasControl
    }
  }
}

export {}
