/**
 * Which scenarios have pictures, keyed by scenario id.
 * Each scenario lists entries by the seed version they start from.
 */
import { deadlineFrames } from './deadlineFrames'
import { noticeFrames } from './noticeFrames'
import type { FrameEntry } from './types'

/**
 * Seed version 5 gives both starters their pictures. The password-notice
 * scenario has two versions, the second drawn with its own details: the entry's `frames` are version 0 and
 * `variants[0]` is version 1.
 */
export const FRAMES: Record<string, FrameEntry[]> = {
  'starter-phishing': [{ fromVersion: 5, frames: noticeFrames(0), variants: [noticeFrames(1)] }],
  'starter-wifi-deadline': [{ fromVersion: 5, frames: deadlineFrames() }],
}
