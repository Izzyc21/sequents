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
    </figure>
  )
}

/** One picture for a slot; renders nothing when the run has no picture there. */
export function Frame({ answersId, slot }: { answersId: string; slot: FrameSlot }) {
  const spec = specFor(framesFor(answersId), slot)
  return spec ? <FrameFigure spec={spec} /> : null
}

/**
 * The setting picture and the pictures of decisions before `upTo`,
 * folded away so a player can look back at them.
 */
export function EarlierFrames({ answersId, upTo }: { answersId: string; upTo: number }) {
  const set = framesFor(answersId)
  if (!set) return null
  const specs = [set.setting, ...set.decisions.slice(0, Math.max(0, upTo))].filter((s): s is FrameSpec => s !== null)
  if (specs.length === 0) return null
  return (
    <details className="my-3">
      <summary className="cursor-pointer text-sm">Earlier pictures</summary>
      {specs.map((spec) => (
        <FrameFigure key={spec.title} spec={spec} />
      ))}
    </details>
  )
}
