/**
 * /compare/:id: a rewound run next to the run it was rewound from.
 * Shows both scores, where the picks split, and what each decision cost in
 * each run. Both runs belong to the viewer (players read only their own).
 */
import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Badge, cn } from '@/components/ui'
import { choiceText, ENDING_BADGE, ENDING_LABEL, GRADE_BADGE, gradeLine, scoreSum } from '../../../../features/play/labels'
import { FORMAT, type RunRow } from '../../../../features/play/types'

export default function ComparePage() {
  const { id = '' } = useParams()
  const mineQ = useQuery<RunRow>('runs', { where: { recordId: id } })
  const mine = mineQ.records[0]?.data
  const theirsQ = useQuery<RunRow>('runs', { where: { recordId: mine?.parentRunId || 'none' } })
  const theirs = theirsQ.records[0]?.data

  if (!mine || (mine.parentRunId && !theirs)) {
    return <Message text={mineQ.status === 'loading' || theirsQ.status === 'loading' ? 'Loading…' : 'This comparison is not available.'} />
  }
  if (mine.format !== FORMAT || theirs?.format !== FORMAT) return <Message text="This run is from an older version of sequents." />
  if (mine.branchAt < 0) return <Message text="This run was not rewound from another run, so there is nothing to compare." />
  if (mine.status !== 'done' || theirs.status !== 'done') {
    return <Message text="Finish this run first, then compare." to={`/run/${id}`} label="Back to the run" />
  }

  const split = mine.branchAt
  const decisions = mine.snapshot.decisions
  const diff = mine.score - theirs.score

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to={`/run/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to this run
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{mine.snapshot.title}</h1>
      <p className="mt-1 text-muted-foreground">
        Same start. At decision {split + 1} you chose differently.{' '}
        {diff === 0 ? 'Both runs scored the same.' : `This run scored ${Math.abs(diff)} ${diff > 0 ? 'more' : 'less'}.`}
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="endings">
        {[
          { label: 'Earlier run', run: theirs },
          { label: 'This run', run: mine },
        ].map(({ label, run }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {run.score}
              <span className="text-base font-medium text-muted-foreground"> / 100</span>
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {scoreSum(
                run.steps.map((s) => s.points),
                run.score,
              )}
            </p>
            {run.ending && (
              <Badge className="mt-2" variant={ENDING_BADGE[run.ending]}>
                {ENDING_LABEL[run.ending]}
              </Badge>
            )}
            <p className="mt-2 text-sm text-foreground/90">{run.endingText}</p>
          </div>
        ))}
      </section>

      <h2 className="mt-10 text-lg font-semibold text-foreground">Decision by decision</h2>
      <ol className="mt-4 space-y-3" data-testid="decisions">
        {decisions.map((decision, i) => {
          const same = mine.choices[i] === theirs.choices[i]
          return (
            <li key={i} className={cn('rounded-lg border p-4', i === split ? 'border-primary bg-accent/30' : 'border-border')}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</span>
                <Badge variant={same ? 'secondary' : 'info'} size="sm">
                  {i === split ? 'Where you split' : same ? 'Same pick' : 'Different pick'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{decision.prompt}</p>
              <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  { label: 'Earlier', run: theirs },
                  { label: 'This run', run: mine },
                ].map(({ label, run }) => (
                  <div key={label}>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{label}: </span>
                      {choiceText(decision, run.choices[i])}
                    </p>
                    <Badge className="mt-1" variant={GRADE_BADGE[run.steps[i].grade]} size="sm">
                      {gradeLine(run.steps[i].grade)}
                    </Badge>
                    {run.steps[i].causedBy >= 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">Made worse by the pick at decision {run.steps[i].causedBy + 1}.</p>
                    )}
                  </div>
                ))}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Message({ text, to = '/home', label = 'Back to scenarios' }: { text: string; to?: string; label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center text-muted-foreground">
      {text}
      <Link to={to} className="mt-4 text-sm underline">
        {label}
      </Link>
    </div>
  )
}
