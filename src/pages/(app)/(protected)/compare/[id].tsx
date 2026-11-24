/**
 * /compare/:id: a rewound run next to the run it was rewound from.
 * Shows where the picks split, how each meter moved in both runs, and how
 * each run ended. Both runs belong to the viewer (players read only their own).
 */
import { Link, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Badge, cn } from '@/components/ui'
import { ENDING_BADGE, ENDING_LABEL } from '../../../../features/play/labels'
import { MeterChart } from '../../../../features/play/MeterChart'
import type { RunRow } from '../../../../features/play/types'

export default function ComparePage() {
  const { id = '' } = useParams()
  const mineQ = useQuery<RunRow>('runs', { where: { recordId: id } })
  const mine = mineQ.records[0]?.data
  const theirsQ = useQuery<RunRow>('runs', { where: { recordId: mine?.parentRunId || 'none' } })
  const theirs = theirsQ.records[0]?.data

  if (!mine || (mine.parentRunId && !theirs)) {
    return <Message text={mineQ.status === 'loading' || theirsQ.status === 'loading' ? 'Loading…' : 'This comparison is not available.'} />
  }
  if (!theirs || mine.branchAt < 0) return <Message text="This run was not rewound from another run, so there is nothing to compare." />
  if (mine.status !== 'done' || theirs.status !== 'done') {
    return <Message text="Finish this run first, then compare." to={`/run/${id}`} label="Back to the run" />
  }

  const split = mine.branchAt
  const scenes = mine.snapshot.scenes
  const series = (run: RunRow, k: number) => run.meterHistory.map((row) => row[k])

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to={`/run/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to this run
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{mine.snapshot.title}</h1>
      <p className="mt-1 text-muted-foreground">
        Same start. At decision {split + 1} you chose differently. Solid line: this run. Dashed: the earlier one.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="charts">
        {mine.snapshot.meters.map((m, k) => (
          <MeterChart key={m.name} name={m.name} mine={series(mine, k)} theirs={series(theirs, k)} splitAt={split} />
        ))}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2" data-testid="endings">
        {[
          { label: 'Earlier run', run: theirs },
          { label: 'This run', run: mine },
        ].map(({ label, run }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
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
        {scenes.map((scene, i) => {
          const same = mine.choices[i] === theirs.choices[i]
          return (
            <li key={i} className={cn('rounded-lg border p-4', i === split ? 'border-primary bg-accent/30' : 'border-border')}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</span>
                <Badge variant={same ? 'secondary' : 'info'} size="sm">
                  {i === split ? 'Where you split' : same ? 'Same pick' : 'Different pick'}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{scene.prompt}</p>
              {same ? (
                <p className="mt-2 text-sm text-foreground">Both: {scene.options[mine.choices[i]]}</p>
              ) : (
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Earlier: </span>
                    {scene.options[theirs.choices[i]]}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">This run: </span>
                    {scene.options[mine.choices[i]]}
                  </p>
                </div>
              )}
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
