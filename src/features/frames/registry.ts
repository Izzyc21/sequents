/**
 * Which scenarios have pictures, keyed by scenario id.
 * Each scenario lists entries by the seed version they start from.
 * Empty until frames are added.
 */
import type { FrameEntry } from './types'

export const FRAMES: Record<string, FrameEntry[]> = {}
