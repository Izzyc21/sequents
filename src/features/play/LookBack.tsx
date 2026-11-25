/**
 * The look-back screen of a finished run whose score is still hidden: how it
 * went in one line, what happened at each decision, the doors the player did
 * not open, the neutral question "which decision would you change, if any?"
 * with a way to try a change (rewind), one optional hint, and a low-key link
 * to reveal the exact score.
 * It holds no grade, number or explanation; those come after reveal.
 */
import { useState } from 'react'
import { Button, cn } from '@/components/ui'
import { BAND_LINE, choiceText, comparedWith } from './labels'
import { runAction } from './runAction'
import { fromChoice } from './engine'
import { DECISIONS, type RunRow } from './types'

const NOWHERE = DECISIONS

export function LookBack({
  run,
  runId,
  parent,
  pending,
  onRewind,
  onReveal,
  onError,
}: {
  run: RunRow
  runId: string
  /** The run this one was rewound from, when it loaded. */
  parent: RunRow | undefined
  pending: boolean
  onRewind: (decision: number) => void
  onReveal: () => void
  onError: (message: string) => void
}) {
  const ending = run.ending || 'bad'
  const [asking, setAsking] = useState(false)
  const [guess, setGuess] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [given, setGiven] = useState('')
  const stored = run.lookback && run.lookback.hintGuess >= 0 ? run.lookback.hint : ''
  const hint = stored || given

  async function askHint() {
    if (guess === null) return
    setBusy(true)
    try {
      const res = await runAction<{ hint: string }>('hint', { runId, decision: guess })
      setGiven(res.hint)
      setAsking(false)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8" data-testid="lookback" aria-labelledby="lookback-heading">
      <h2 id="lookback-heading" className="text-xl font-semibold text-foreground">
        Look back
      </h2>
      <div className="mt-3 rounded-lg border border-border bg-card p-5">
        <p className="font-medium text-foreground" data-testid="band-line">
          {BAND_LINE[ending]}
        </p>
        <p className="mt-2 text-foreground/90">{run.endingText}</p>
      </div>
      {parent && (
        <p className="mt-4 text-sm text-foreground" data-testid="compared">
          Compared with the run you rewound: {comparedWith(run.score, parent.score)}.
        </p>
      )}

      <h3 className="mt-8 text-lg font-semibold text-foreground">Which decision would you change, if any?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Try one and see how it plays out before you see any score. If you would keep them all, you can stop here.
      </p>
      <ol className="mt-4 space-y-4" data-testid="lookback-rows">
        {run.choices.map((choice, i) => {
          const decision = run.snapshot.decisions[i]
          const taken = fromChoice(choice).approach
          const branch = run.branchAt >= 0 && i === run.branchAt
          const later = parent !== undefined && run.branchAt >= 0 && i > run.branchAt
          const same = later && parent.choices[i] === choice
          const differs = same && parent.outcomes[i] !== run.outcomes[i]
          return (
            <li key={i} className="rounded-lg border border-border p-4" data-testid="lookback-row">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</span>
                {(branch || (later && !same)) && (
                  <span className="rounded-full border border-primary px-2 py-0.5 text-xs font-medium text-foreground">Changed</span>
                )}
                {same && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Same as last time
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{decision.prompt}</p>
              <p className="mt-1 font-medium text-foreground">You: {choiceText(decision, choice)}</p>
              <p className="mt-2 text-sm text-foreground/90">{run.outcomes[i]}</p>
              {differs && <p className="mt-2 text-sm font-medium text-foreground">This played out differently this time.</p>}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Doors you closed</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/90">
                  {decision.approaches.flatMap((a, k) => (k === taken ? [] : [<li key={k}>{a.text}</li>]))}
                </ul>
              </details>
              <Button className="mt-3" size="sm" variant="outline" disabled={pending} onClick={() => onRewind(i)}>
                Change this one<span className="sr-only"> (decision {i + 1})</span>
              </Button>
            </li>
          )
        })}
      </ol>

      <div className="mt-6">
        {hint ? (
          <p className="rounded-md border border-border bg-accent/30 p-3 text-sm text-foreground" data-testid="hint">
            <span className="font-medium">Your hint: </span>
            {hint}
          </p>
        ) : asking ? (
          <fieldset className="rounded-md border border-border p-3" data-testid="hint-picker">
            <legend className="px-1 text-sm font-medium text-foreground">Which decision would you change, if any?</legend>
            <div className="mt-1 space-y-1">
              {[...Array(DECISIONS).keys(), NOWHERE].map((d) => (
                <label key={d} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="radio" name="hint-guess" checked={guess === d} onChange={() => setGuess(d)} />
                  {d === NOWHERE ? 'None, I would keep them all' : `Decision ${d + 1}`}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={guess === null} loading={busy} onClick={askHint}>
                Get my hint
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking(false)}>
                Cancel
              </Button>
            </div>
          </fieldset>
        ) : (
          <button
            type="button"
            className="min-h-9 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => setAsking(true)}
          >
            I&apos;m stuck: give me a hint
          </button>
        )}
      </div>

      <div className="mt-10 border-t border-border pt-4">
        <button
          type="button"
          disabled={pending}
          className={cn(
            'min-h-9 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground',
            pending && 'cursor-not-allowed opacity-50',
          )}
          onClick={onReveal}
        >
          Show my exact score
        </button>
      </div>
    </section>
  )
}
