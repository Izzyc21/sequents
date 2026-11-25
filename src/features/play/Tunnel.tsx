/**
 * The tunnel strip of a revealed run: one node per decision, coloured by
 * grade and also named in words, with how many of the paths that share the
 * player's choices so far still end well (score 90+; several paths can reach
 * the same ending, and the count falls at every decision because fewer
 * decisions are left), and where an earlier choice changed how a later
 * decision played out.
 */
import { Badge } from '@/components/ui'
import { GRADE_BADGE, GRADE_LABEL } from './labels'
import { CHOICES, DECISIONS, type RunRow } from './types'

const number = (n: number) => n.toLocaleString('en-US')

/** Column centre of node `i` in the 400-wide arrow strip. */
const centre = (i: number) => (i + 0.5) * (400 / DECISIONS)

export function Tunnel({ run }: { run: RunRow }) {
  const tunnel = run.tunnel
  if (!tunnel || tunnel.length !== DECISIONS + 1) return null
  const links = run.steps.flatMap((s, to) => (s.causedBy >= 0 ? [{ from: s.causedBy, to }] : []))
  return (
    <section className="mt-8" data-testid="tunnel" aria-labelledby="tunnel-heading">
      <h2 id="tunnel-heading" className="text-lg font-semibold text-foreground">
        How your choices narrowed what came next
      </h2>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="tunnel-start">
        At the start: {number(tunnel[0])} of {number(CHOICES ** DECISIONS)} paths ended well.
      </p>
      <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="tunnel-nodes">
        {run.steps.map((step, k) => (
          <li key={k} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {k + 1}</p>
            <Badge className="mt-1" variant={GRADE_BADGE[step.grade]} size="sm">
              {GRADE_LABEL[step.grade]}
            </Badge>
            <p className="mt-2 text-sm text-foreground">
              Paths from here that still end well: {number(tunnel[k + 1])} of {number(CHOICES ** (DECISIONS - 1 - k))}
            </p>
          </li>
        ))}
      </ol>
      {links.length > 0 && (
        <>
          <svg viewBox="0 0 400 44" className="mt-1 hidden h-11 w-full sm:block" aria-hidden="true" focusable="false">
            <defs>
              <marker id="tunnel-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 L8 4 L0 8 z" className="fill-primary" />
              </marker>
            </defs>
            {links.map(({ from, to }) => (
              <path
                key={`${from}-${to}`}
                d={`M ${centre(from)} 2 Q ${(centre(from) + centre(to)) / 2} ${14 + 10 * (to - from)} ${centre(to)} 2`}
                className="fill-none stroke-primary"
                strokeWidth="2"
                markerEnd="url(#tunnel-arrow)"
              />
            ))}
          </svg>
          <ul className="mt-2 space-y-1 text-sm text-foreground" data-testid="tunnel-links">
            {links.map(({ from, to }) => (
              <li key={`${from}-${to}`}>
                Your choice at decision {from + 1} changed how decision {to + 1} played out.
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
