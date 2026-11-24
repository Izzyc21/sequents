/**
 * /run/:id: play a run, then read the debrief and rewind.
 *
 * The run comes live from the `runs` collection (players can read only their
 * own). Picks and rewinds go through actions; when a pick lands, the server
 * updates the run row and this page re-renders from it.
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Badge, Button, cn, useToast } from '@/components/ui'
import { turningPoint } from '../../../../features/play/engine'
import { ENDING_BADGE, ENDING_LABEL, KIND_BADGE, KIND_LABEL } from '../../../../features/play/labels'
import { MeterBars } from '../../../../features/play/MeterBars'
import { runAction } from '../../../../features/play/runAction'
import { SCENES, type RunRow } from '../../../../features/play/types'

export default function RunPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { records, status } = useQuery<RunRow>('runs', { where: { recordId: id } })
  const run = records[0]?.data
  const parent = useQuery<RunRow>('runs', { where: { recordId: run?.parentRunId || 'none' } }).records[0]?.data
  const [pending, setPending] = useState(false)

  if (!run) {
    return (
      <Centered>
        {status === 'loading' ? 'Loading run…' : 'This run does not exist or belongs to someone else.'}
        <Link to="/home" className="mt-4 block text-sm underline">
          Back to scenarios
        </Link>
      </Centered>
    )
  }

  const { snapshot, choices, meterHistory, outcomes, scenarioId } = run
  const scene = choices.length
  const current = meterHistory[meterHistory.length - 1]
  const before = meterHistory.length > 1 ? meterHistory[meterHistory.length - 2] : undefined
  const blocked = run.branchAt === scene && parent ? parent.choices[scene] : -1

  async function choose(option: number) {
    setPending(true)
    try {
      await runAction('choose', { runId: id, scene, option })
    } catch (e) {
      toast.error('That pick did not go through', (e as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function rewind(decision: number) {
    setPending(true)
    try {
      const res = await runAction<{ runId: string }>('rewind', { runId: id, decision })
      navigate(`/run/${res.runId}`)
    } catch (e) {
      toast.error('Could not rewind', (e as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function restart() {
    setPending(true)
    try {
      const res = await runAction<{ runId: string }>('startRun', { scenarioId })
      navigate(`/run/${res.runId}`)
    } catch (e) {
      toast.error('Could not start again', (e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
        ← Scenarios
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{snapshot.title}</h1>
      {run.branchAt >= 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          Rewound to decision {run.branchAt + 1}. Your earlier picks are kept up to there.
        </p>
      )}
      <p className="mt-4 text-foreground/90">{snapshot.setting}</p>

      <div className="sticky top-0 z-10 -mx-6 mt-6 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <MeterBars meters={snapshot.meters} values={current} previous={run.status === 'playing' ? before : undefined} />
      </div>

      {run.status === 'playing' ? (
        <>
          {outcomes.length > 0 && (
            <ol className="mt-6 space-y-4" data-testid="story-so-far">
              {outcomes.map((outcome, i) => (
                <li key={i} className={cn('rounded-lg border border-border p-4', i === outcomes.length - 1 && 'bg-accent/40')}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</p>
                  <p className="mt-1 text-sm text-muted-foreground">You: {snapshot.scenes[i].options[choices[i]]}</p>
                  <p className="mt-2 text-foreground">{outcome}</p>
                </li>
              ))}
            </ol>
          )}
          <section className="mt-8" data-testid="decision">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Decision {scene + 1} of {SCENES}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">{snapshot.scenes[scene].prompt}</h2>
            <div className="mt-4 grid gap-3">
              {snapshot.scenes[scene].options.map((text, option) => (
                <button
                  key={option}
                  type="button"
                  disabled={pending || option === blocked}
                  onClick={() => choose(option)}
                  className="rounded-lg border border-border bg-card px-4 py-3 text-left text-foreground transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {text}
                  {option === blocked && <span className="mt-1 block text-xs text-muted-foreground">Your earlier pick</span>}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <Debrief run={run} pending={pending} onRewind={rewind} onRestart={restart} runId={id} />
      )}
    </div>
  )
}

function Debrief({
  run,
  runId,
  pending,
  onRewind,
  onRestart,
}: {
  run: RunRow
  runId: string
  pending: boolean
  onRewind: (decision: number) => void
  onRestart: () => void
}) {
  const ending = run.ending || 'ok'
  const turn = turningPoint(run.meterHistory)
  return (
    <section className="mt-8" data-testid="debrief">
      <div className="rounded-lg border border-border bg-card p-5">
        <Badge variant={ENDING_BADGE[ending]} size="lg">
          {ENDING_LABEL[ending]}
        </Badge>
        <p className="mt-3 text-foreground">{run.endingText}</p>
        {run.branchAt >= 0 && (
          <Link to={`/compare/${runId}`} className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Compare with the run you rewound →
          </Link>
        )}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-foreground">How each pick played out</h2>
      <p className="text-sm text-muted-foreground">Rewind any decision to try another option from there.</p>
      <ol className="mt-4 space-y-4">
        {run.debrief.map((item, i) => (
          <li key={i} className={cn('rounded-lg border p-4', i === turn ? 'border-primary' : 'border-border')}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</span>
              <Badge variant={KIND_BADGE[item.kind]} size="sm">
                {KIND_LABEL[item.kind]}
              </Badge>
              {i === turn && (
                <Badge variant="info" size="sm">
                  Turning point: rewind here
                </Badge>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{run.snapshot.scenes[i].prompt}</p>
            <p className="mt-1 font-medium text-foreground">You: {run.snapshot.scenes[i].options[run.choices[i]]}</p>
            <p className="mt-2 text-sm text-foreground/90">{run.outcomes[i]}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Why: </span>
              {item.why}
            </p>
            <Button className="mt-3" size="sm" variant={i === turn ? 'default' : 'outline'} disabled={pending} onClick={() => onRewind(i)}>
              Rewind to decision {i + 1}
            </Button>
          </li>
        ))}
      </ol>
      <div className="mt-8 flex gap-3">
        <Button variant="outline" disabled={pending} onClick={onRestart}>
          Play again from the start
        </Button>
        <Link to="/home" className="inline-flex items-center px-3 text-sm text-muted-foreground hover:text-foreground">
          Back to scenarios
        </Link>
      </div>
    </section>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center text-muted-foreground">{children}</div>
}
