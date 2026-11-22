/**
 * /dashboard/:id: the team's live view of one funnel.
 *
 * - Drop-off: per step, how many testers reached it, got past it, or are stuck.
 * - Live: useQuery streams new reports over a WebSocket, so the chart moves
 *   the moment a tester taps Done or Stuck. No refresh, no polling.
 * - Who is here (team only): the presence room shows testers on the checklist right now
 *   and which step they are on (in memory only, never stored).
 * - Stuck notes grouped by step, with the tester's name.
 *
 * Anyone signed in may open this page, on purpose: the server decides what
 * they receive. An admin gets every tester's reports; a member gets only their
 * own (the `step_reports` read rule is 'own'), so a member's dashboard shows a
 * single tester: themselves. The two-user test relies on exactly this.
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutations, usePresenceRoom, useQuery, useUserLookup } from 'deepspace'
import { Badge, Button, EmptyState } from '@/components/ui'
import type { Funnel } from '../../../../schemas/funnels-schema'
import type { StepReport } from '../../../../schemas/reports-schema'
import { computeFunnelStats } from '../../../../features/funnels/stats'
import { useIsAdmin } from '../../../../features/funnels/useIsAdmin'

export default function DashboardPage() {
  const { id = '' } = useParams()
  const { isAdmin, isLoading } = useIsAdmin()
  const funnels = useQuery<Funnel>('funnels')
  const reports = useQuery<StepReport>('step_reports', { where: { funnelId: id } })
  const { peers } = usePresenceRoom(`funnel:${id}`)
  const { getName } = useUserLookup()
  const funnelWrites = useMutations<Funnel>('funnels')
  const reportWrites = useMutations<StepReport>('step_reports')
  const navigate = useNavigate()
  // Two-click delete: the first click arms it, the second deletes.
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading || funnels.status === 'loading') {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Loading…</p>
  }
  const funnel = funnels.records.find((f) => f.recordId === id)
  if (!funnel) {
    return (
      <p className="px-6 py-10 text-sm text-muted-foreground">
        Funnel not found.{' '}
        <Link className="underline" to="/funnels">
          Back to funnels
        </Link>
      </p>
    )
  }

  const steps = funnel.data.steps ?? []
  const stats = computeFunnelStats(steps, reports.records.map((r) => r.data))
  const stepTitle = (stepId: unknown) =>
    stepId === 'finished' ? 'finished' : (steps.find((s) => s.id === stepId)?.title ?? 'starting')
  const nameOf = (userId: string) => getName(userId) ?? 'A tester'
  const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/try/${id}`

  // Team only. The server refuses anyone else: only admin may delete funnels.
  // Removes the funnel and every report on it (an admin can read, so delete, all of them).
  function deleteFunnel() {
    for (const r of reports.records) reportWrites.remove(r.recordId)
    funnelWrites.remove(id)
    navigate('/funnels')
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{funnel.data.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span data-testid="tester-count">{stats.testers}</span> {stats.testers === 1 ? 'tester' : 'testers'} started ·{' '}
            <span data-testid="finished-count">{stats.finished}</span> finished
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
              Copy tester link
            </Button>
            <Button
              data-testid="delete-funnel"
              variant={confirmDelete ? 'destructive' : 'ghost'}
              onClick={() => (confirmDelete ? deleteFunnel() : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Click again to delete' : 'Delete'}
            </Button>
          </div>
        )}
      </div>

      {!isAdmin && (
        <p data-testid="own-only" className="mt-4 rounded-md border border-border p-3 text-sm text-muted-foreground">
          You are seeing only your own reports. The server sends everyone's reports to the team (admins) only.
        </p>
      )}

      {/* Who is on the checklist right now (team only: testers don't need to see each other) */}
      {isAdmin && (
        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">
            Trying it right now: <span data-testid="live-count">{peers.length}</span>
          </p>
          {peers.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {peers.map((p) => (
                <li key={p.userId}>
                  {p.userName || 'A tester'} is on <span className="text-foreground">{stepTitle(p.state.stepId)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {stats.testers === 0 ? (
        <EmptyState
          className="mt-8"
          title="No reports yet"
          description="Share the tester link. Reports appear here live as people work through the steps."
        />
      ) : (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Where people drop off</h2>
          <ol className="space-y-4">
            {stats.steps.map((s, i) => {
              const worst = s.step.id === stats.worstStepId
              return (
                <li
                  key={s.step.id}
                  data-testid={`stat-${i}`}
                  className={`rounded-lg border p-4 ${worst ? 'border-destructive' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-foreground">
                      {i + 1}. {s.step.title}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      {worst && <Badge variant="destructive">Fix this first</Badge>}
                      <span className="text-muted-foreground">
                        reached {s.reached} · done {s.done} · <span data-testid={`stuck-${i}`}>stuck {s.stuck}</span>
                      </span>
                    </div>
                  </div>
                  {/* Bar: share of all testers who got past this step. It shrinks
                      step by step; the big drop is where people give up. */}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden>
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.round(s.passRate * 100)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs text-muted-foreground">
                      {Math.round(s.passRate * 100)}% got past
                    </span>
                  </div>
                  {s.notes.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {s.notes.map((n) => (
                        <li key={n.testerId} className="text-muted-foreground">
                          <span className="text-foreground">{nameOf(n.testerId)}</span>
                          {n.outcome === 'done' ? ' (now done)' : ''}: {n.note}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
