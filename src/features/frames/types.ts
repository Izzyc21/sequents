/**
 * Shapes for the illustrated frames shown beside a scenario's text.
 * A frame is a small React picture built from HTML and inline SVG.
 * Every word in a frame is real HTML text, so screen readers and the
 * plain-text transcript see the same details a sighted player sees.
 */
import type { ReactNode } from 'react'

/** One picture: a neutral accessible title and the content to draw. */
export interface FrameSpec {
  /** Neutral name read by screen readers, e.g. "Picture: the email in your inbox". */
  title: string
  render: () => ReactNode
}

/** Every picture for one version of a scenario. */
export interface FrameSet {
  /** Shown above decision 1. */
  setting: FrameSpec | null
  /** One entry per decision (index 0-3); null where a decision has no picture. */
  decisions: (FrameSpec | null)[]
}

/**
 * Frames apply from one seed version of a scenario onward.
 * `frames: null` turns pictures off from that version.
 */
export interface FrameEntry {
  fromVersion: number
  frames: FrameSet | null
}

/** Where a frame is shown: the setting, or one decision (0-3). */
export type FrameSlot = 'setting' | number
