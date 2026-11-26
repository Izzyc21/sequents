/**
 * Looks up and draws the frames for a run.
 * A run's answers id is "<scenarioId>@v<version>", or
 * "<scenarioId>@v<version>.<n>" for extra hidden version n. The frames used
 * are those of the entry with the highest fromVersion not above that
 * version, so an old run keeps the pictures (or the lack of them) it was
 * played with; version n uses the entry's `variants[n - 1]` when present.
 */
import { FRAMES } from './registry'
import type { FrameEntry, FrameSet, FrameSlot, FrameSpec } from './types'

const ANSWERS_ID = /^(.*)@v(\d+)(?:\.(\d+))?$/

/** The frame set for a run's answers id, or null when it has none. */
export function framesFor(answersId: string, registry: Record<string, FrameEntry[]> = FRAMES): FrameSet | null {
  const match = ANSWERS_ID.exec(answersId)
  if (!match) return null
  const [, scenarioId, versionText, variantText] = match
  const version = Number(versionText)
  const variant = variantText ? Number(variantText) : 0
  let best: FrameEntry | null = null
  for (const entry of registry[scenarioId] ?? []) {
    if (entry.fromVersion <= version && (!best || entry.fromVersion > best.fromVersion)) best = entry
  }
  if (!best) return null
  if (variant > 0 && best.variants && best.variants[variant - 1] !== undefined) return best.variants[variant - 1]
  return best.frames
}

function specFor(set: FrameSet | null, slot: FrameSlot): FrameSpec | null {
  if (!set) return null
  if (slot === 'setting') return set.setting
  return set.decisions[slot] ?? null
}

function FrameFigure({ spec }: { spec: FrameSpec }) {
  return (
    <figure aria-label={spec.title} className="my-3">
      {spec.render()}
      {/* The pictures use the made-up ending .exa so no address can belong to a real site. */}
      <figcaption className="mt-1 text-xs text-muted-foreground">In these pictures, .exa is a normal, trusted address ending, like .com.</figcaption>
    </figure>
  )
}

/** One picture for a slot; renders nothing when the run has no picture there. */
export function Frame({ answersId, slot }: { answersId: string; slot: FrameSlot }) {
  const spec = specFor(framesFor(answersId), slot)
  return spec ? <FrameFigure spec={spec} /> : null
}
