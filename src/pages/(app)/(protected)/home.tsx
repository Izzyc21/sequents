/**
 * /home: pick a scenario to play, or continue a recent run.
 *
 * Scenarios come live from the `scenarios` collection; the schema only lets
 * each user read public ones and their own. Starting a run goes through the
 * `startRun` action because runs are server-written only.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Badge, Button, EmptyState, useToast } from '@/components/ui'
import { ENDING_BADGE, ENDING_LABEL } from '../../../features/play/labels'
import { runAction } from '../../../features/play/runAction'
import type { RunRow, ScenarioRow } from '../../../features/play/types'

export default function Home() {
  const { userId } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { records: scenarios, status } = useQuery<ScenarioRow>('scenarios', { limit: 200 })
  const { records: runs } = useQuery<RunRow>('runs', { limit: 12 })
  const [starting, setStarting] = useState<string | null>(null)

  // Writes the built-in starters on the owner's visit after a deploy; for
  // everyone else the action returns at once. Failure only matters to the owner.
  useEffect(() => {
    runAction('seedStarters').catch(() => undefined)
  }, [])

  const groups = useMemo(() => {
    const byTitle = (a: { data: ScenarioRow }, b: { data: ScenarioRow }) => a.data.title.localeCompare(b.data.title)
    return {
      starters: scenarios.filter((s) => s.data.starter).sort(byTitle),
      shared: scenarios.filter((s) => !s.data.starter && s.data.authorId !== userId).sort(byTitle),
      mine: scenarios.filter((s) => !s.data.starter && s.data.authorId === userId).sort(byTitle),
    }
  }, [scenarios, userId])

  async function start(scenarioId: string) {
    setStarting(scenarioId)
    try {
      const { runId } = await runAction<{ runId: string }>('startRun', { scenarioId })
      navigate(`/run/${runId}`)
    } catch (e) {
      toast.error('Could not start', (e as Error).message)
      setStarting(null)
    }
  }

  const card = (s: (typeof scenarios)[number]) => (
    <li key={s.recordId} className="flex flex-col rounded-lg border border-border bg-card p-5" data-testid="scenario-card">
      <h3 className="font-semibold text-foreground">{s.data.title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.data.situation}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.data.meters.map((m) => (
          <Badge key={m.name} variant="outline" size="sm">
            {m.name}
          </Badge>
        ))}
      </div>
      <Button className="mt-4" size="sm" loading={starting === s.recordId} disabled={starting !== null} onClick={() => start(s.recordId)}>
        Start
      </Button>
    </li>
  )

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rehearse a hard moment</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Five decisions, three choices each. Watch the meters move, see how it ends, then rewind any decision and
          compare the two runs.
        </p>
      </header>

      {runs.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your recent runs</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="recent-runs">
            {runs.map((r) => (
              <li key={r.recordId}>
                <Link to={`/run/${r.recordId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{r.data.snapshot.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.data.branchAt >= 0 ? `Rewound to decision ${r.data.branchAt + 1}` : 'First run'}
                    </span>
                  </span>
                  {r.data.status === 'done' && r.data.ending ? (
                    <Badge variant={ENDING_BADGE[r.data.ending]}>{ENDING_LABEL[r.data.ending]}</Badge>
                  ) : (
                    <Badge variant="secondary">Decision {r.data.choices.length + 1} of 5</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {status === 'loading' && scenarios.length === 0 ? (
        <p className="text-muted-foreground">Loading scenarios…</p>
      ) : scenarios.length === 0 ? (
        <EmptyState title="No scenarios yet" description="The starter scenarios appear here once the app owner has opened this page." />
      ) : (
        <>
          <Section title="Starters" items={groups.starters} render={card} />
          <Section title="Shared by other players" items={groups.shared} render={card} />
          <Section title="Yours" items={groups.mine} render={card} />
        </>
      )}
    </div>
  )
}

function Section<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) return null
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(render)}</ul>
    </section>
  )
}
