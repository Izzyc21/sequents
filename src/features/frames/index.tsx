/**
 * Looks up and draws the frames for a run.
 * A run's answers id is "<scenarioId>@v<version>", or
 * "<scenarioId>@v<version>.<n>" for extra hidden version n. The frames used
 * are those of the entry with the highest fromVersion not above that
 * version, so an old run keeps the pictures (or the lack of them) it was
 * played with; version n uses the entry's `variants[n - 1]` when present.
 */
import { useState } from 'react'
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
 * One picture at a time for the decision at index `upTo`: it opens on that
 * decision's picture, and Earlier / Later step through the opening picture
 * and the pictures of the decisions before it, so the screen never shows
 * two pictures at once. Renders nothing when the run has no pictures.
 */
export function PictureViewer({ answersId, upTo }: { answersId: string; upTo: number }) {
  const set = framesFor(answersId)
  const items: { label: string; spec: FrameSpec }[] = []
  if (set) {
    if (set.setting) items.push({ label: 'The start', spec: set.setting })
    set.decisions.slice(0, Math.max(0, upTo) + 1).forEach((spec, i) => {
      if (spec) items.push({ label: i === upTo ? `Decision ${i + 1} (now)` : `Decision ${i + 1}`, spec })
    })
  }
  const [shown, setShown] = useState<number | null>(null)
  if (items.length === 0) return null
  const at = shown === null || shown >= items.length ? items.length - 1 : shown
  const button = 'rounded-md border border-border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="my-3" data-testid="picture-viewer">
      <FrameFigure spec={items[at].spec} />
      {items.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <button type="button" className={button} disabled={at === 0} onClick={() => setShown(at - 1)}>
            ← Earlier
          </button>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Picture {at + 1} of {items.length}: {items[at].label}
          </p>
          <button type="button" className={button} disabled={at === items.length - 1} onClick={() => setShown(at + 1)}>
            Later →
          </button>
        </div>
      )}
    </div>
  )
}
