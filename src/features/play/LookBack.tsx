/**
 * The look-back screen of a finished first try, before its debrief: how it
 * ended and its total score (one quiet line, so the screen reads as part of
 * the run rather than its result), what happened at each decision, the other options
 * at each decision, and its one last chance: change any one decision, once
 * (rewind). It shows no grade, no per-decision points and no reason, so
 * nothing says where the points went; the debrief shows that after the last
 * chance is used, or at once if the player chooses to keep the run as it is.
 * A rewound run saved by an earlier version of the app can also land here
 * (it ended hidden); it gets no last chance of its own, only the reveal.
 */
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { choiceText } from './labels'
import { fromChoice } from './engine'
import type { RunRow } from './types'

export function LookBack({
  run,
  lastChance,
  pending,
  onRewind,
  onReveal,
}: {
  run: RunRow
  /** This first try's last-chance run, once one is started. */
  lastChance: { id: string; done: boolean } | undefined
  pending: boolean
  onRewind: (decision: number) => void
  onReveal: () => void
}) {
  const closed = lastChance !== undefined || !!run.parentRunId
  return (
    <section className="mt-8" data-testid="lookback" aria-labelledby="lookback-heading">
      <h2 id="lookback-heading" className="text-xl font-semibold text-foreground">
        Look back
      </h2>
      <div className="mt-3 rounded-lg border border-border bg-card p-5">
        <p className="text-foreground/90">{run.endingText}</p>
        <p className="mt-3 text-sm text-muted-foreground" data-testid="lookback-score">
          {run.parentRunId ? 'Score' : 'First try score'}: <span className="font-semibold text-foreground">{run.score}</span> / 100
        </p>
      </div>

      {lastChance ? (
        <div className="mt-8 rounded-lg border border-primary/40 bg-accent/30 p-4" data-testid="last-chance-started">
          <p className="text-foreground">
            {lastChance.done
              ? 'Your last chance is finished.'
              : 'Your last chance is in progress. Finish it to see where your points went on both tries.'}
          </p>
          <Link
            to={`/run/${lastChance.id}`}
            className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {lastChance.done ? 'Open your last chance →' : 'Continue your last chance →'}
          </Link>
        </div>
      ) : run.parentRunId ? null : (
        <>
          <h3 className="mt-8 text-lg font-semibold text-foreground">One last chance</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You can change one decision, once. Everything after it stays as you played it and plays out again from your new choice.
            Then you see where every point went, on both tries. Pressing Change starts it at that decision; you can leave and come
            back to finish it.
          </p>
        </>
      )}

      <ol className="mt-4 space-y-4" data-testid="lookback-rows">
        {run.choices.map((choice, i) => {
          const decision = run.snapshot.decisions[i]
          const { approach: taken, way: wayTaken } = fromChoice(choice)
          return (
            <li key={i} className="rounded-lg border border-border p-4" data-testid="lookback-row">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</span>
              <p className="mt-2 text-sm text-muted-foreground">{decision.prompt}</p>
              <p className="mt-1 font-medium text-foreground">You: {choiceText(decision, choice)}</p>
              <p className="mt-2 text-sm text-foreground/90">{run.outcomes[i]}</p>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Other options at this decision</summary>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Other ways in your approach</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/90">
                  {decision.approaches[taken].ways.flatMap((w, k) => (k === wayTaken ? [] : [<li key={k}>{w}</li>]))}
                </ul>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Other approaches</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/90">
                  {decision.approaches.flatMap((a, k) => (k === taken ? [] : [<li key={k}>{a.text}</li>]))}
                </ul>
              </details>
              {!closed && (
                <Button className="mt-3" size="sm" variant="outline" disabled={pending} onClick={() => onRewind(i)}>
                  Change this one<span className="sr-only"> (decision {i + 1})</span>
                </Button>
              )}
            </li>
          )
        })}
      </ol>

      {(!lastChance || lastChance.done) && (
        <div className="mt-10 border-t border-border pt-4">
          <Button variant="outline" size="sm" disabled={pending} onClick={onReveal}>
            {closed ? 'See where my points went' : 'Keep it and see where my points went'}
          </Button>
          {!closed && <p className="mt-2 text-xs text-muted-foreground">This uses up your last chance on this run.</p>}
        </div>
      )}
    </section>
  )
}
