/**
 * /run/:id: play a run, look back at it, take its one last chance, then read
 * the debrief.
 *
 * The run comes live from the `runs` collection (players can read only their
 * own). Each decision is two steps: commit to an approach (no switching
 * after), then pick one of its ways and lock it in. The commit, the lock-in,
 * the last chance (rewind) and the reveal all go through actions; when one
 * lands, the server updates the run row and this page re-renders from it, so
 * a reload shows the same committed approach. A finished first try shows the
 * look-back screen (total score, no reasons) until its last chance is used
 * or the player keeps it as it is; then the debrief with the tunnel strip.
 * A last-chance run goes straight to its debrief.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Badge, Button, cn, useToast } from '@/components/ui'
import { EarlierFrames, Frame } from '../../../../features/frames'
import type { Explained } from '../../../../actions/play'
import { choiceText, ENDING_BADGE, ENDING_LABEL, GRADE_BADGE, gradeLine, scoreSum } from '../../../../features/play/labels'
import { LookBack } from '../../../../features/play/LookBack'
import { runAction } from '../../../../features/play/runAction'
import { Tunnel } from '../../../../features/play/Tunnel'
import {
  CHILDREN_READ,
  committedApproach,
  DECISIONS,
  FORMAT,
  keepsLaterChoices,
  pickLastChance,
  runHistory,
  scoreVisible,
  WAYS,
  type PublicDecision,
  type RunRow,
} from '../../../../features/play/types'

/** How many of a player's finished runs on one scenario the history line reads. */
const HISTORY_WINDOW = 200

export default function RunPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { records, status } = useQuery<RunRow>('runs', { where: { recordId: id } })
  const run = records[0]?.data
  const parent = useQuery<RunRow>('runs', { where: { recordId: run?.parentRunId || 'none' } }).records[0]?.data
  const children = useQuery<RunRow>('runs', { where: { parentRunId: id || 'none' }, orderBy: 'createdAt', orderDir: 'asc', limit: CHILDREN_READ })
  const lastChance = pickLastChance(children.records)
  const [pending, setPending] = useState(false)

  if (!run) {
    return (
      <Centered>
        {status === 'loading' ? 'Loading run…' : 'This run does not exist or belongs to someone else.'}
        <BackLink />
      </Centered>
    )
  }
  if (run.format !== FORMAT) {
    return (
      <Centered>
        This run is from an older version of sequents. Start the scenario again from the list.
        <BackLink />
      </Centered>
    )
  }

  const { snapshot, choices, outcomes, scenarioId } = run
  const decision = choices.length
  const blocked = run.branchAt === decision && parent ? parent.choices[decision] : -1

  async function act<T>(label: string, work: () => Promise<T>) {
    setPending(true)
    try {
      return await work()
    } catch (e) {
      toast.error(label, (e as Error).message)
      return undefined
    } finally {
      setPending(false)
    }
  }

  const commit = (approach: number) => act('Could not choose that approach', () => runAction('commit', { runId: id, decision, approach }))
  const lockIn = (choice: number) => act('That choice did not go through', () => runAction('choose', { runId: id, decision, choice }))
  const reveal = () => act('Could not show where your points went', () => runAction('reveal', { runId: id }))
  const rewind = async (to: number) => {
    const res = await act('Could not start your last chance', () => runAction<{ runId: string }>('rewind', { runId: id, decision: to }))
    if (res) navigate(`/run/${res.runId}`)
  }
  const restart = async () => {
    const res = await act('Could not start again', () => runAction<{ runId: string }>('startRun', { scenarioId }))
    if (res) navigate(`/run/${res.runId}`)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
        ← Scenarios
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{snapshot.title}</h1>
      <p className="mt-4 text-foreground/90">{snapshot.setting}</p>
      <Frame answersId={run.answersId} slot="setting" />

      {run.status === 'playing' ? (
        <>
          <EarlierFrames answersId={run.answersId} upTo={decision} />
          {outcomes.length > 0 && (
            <ol className="mt-6 space-y-4" data-testid="story-so-far">
              {outcomes.map((outcome, i) => (
                <li key={i} className={cn('rounded-lg border border-border p-4', i === outcomes.length - 1 && 'bg-accent/40')}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</p>
                  <p className="mt-1 text-sm text-muted-foreground">You: {choiceText(snapshot.decisions[i], choices[i])}</p>
                  <p className="mt-2 text-foreground">{outcome}</p>
                </li>
              ))}
            </ol>
          )}
          <DecisionCard
            key={`${id}-${decision}`}
            index={decision}
            decision={snapshot.decisions[decision]}
            answersId={run.answersId}
            arrival={run.branchAt === decision && keepsLaterChoices(run, parent)}
            blocked={blocked}
            committed={committedApproach(run)}
            pending={pending}
            onCommit={commit}
            onLockIn={lockIn}
          />
        </>
      ) : scoreVisible(run) ? (
        <Debrief
          run={run}
          runId={id}
          parent={parent}
          kept={keepsLaterChoices(run, parent)}
          lastChanceId={lastChance?.id}
          pending={pending}
          onRestart={restart}
        />
      ) : (
        <>
          {/* Until the last chance is loaded the page cannot tell which controls apply, so they stay disabled. */}
          <LookBack run={run} lastChance={lastChance} pending={pending || children.status !== 'ready'} onRewind={rewind} onReveal={reveal} />
          {children.status === 'error' && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              Could not load your last chance. Reload the page to try again.
            </p>
          )}
          <div className="mt-6">
            <BackLink />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * One decision: pick an approach (a commitment the server stores on the run:
 * the other approaches' ways are never shown), then a way inside it, then
 * Lock in. `committed` is the approach stored on the run, -1 before one is
 * chosen. `blocked` is the choice this rewound run may not repeat; -1 when
 * none. `arrival` is true at a rewound run's branch decision when the
 * later decisions will be kept from the earlier run (keepsLaterChoices).
 */
function DecisionCard({
  index,
  answersId,
  arrival,
  decision,
  blocked,
  committed,
  pending,
  onCommit,
  onLockIn,
}: {
  index: number
  answersId: string
  arrival: boolean
  decision: PublicDecision
  blocked: number
  committed: number
  pending: boolean
  onCommit: (approach: number) => void
  onLockIn: (choice: number) => void
}) {
  const approach = committed >= 0 && committed < decision.approaches.length ? committed : null
  const [way, setWay] = useState<number | null>(null)
  const option =
    'rounded-lg border bg-card px-4 py-3 text-left text-foreground transition-colors hover:border-primary hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <section className="mt-8" data-testid="decision">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        Decision {index + 1} of {DECISIONS}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">{decision.prompt}</h2>
      <Frame answersId={answersId} slot={index} />
      {arrival && (
        <p className="mt-3 rounded-md border border-primary/40 bg-accent/30 p-3 text-sm text-foreground" data-testid="arrival">
          Your last chance: change your choice here. Everything after it stays as you played it last time and plays out again from your
          new choice.
        </p>
      )}

      {approach === null ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">First, what do you do? You cannot switch once you choose.</p>
          <div className="mt-2 grid gap-3" data-testid="approaches">
            {decision.approaches.map((a, i) => (
              <button key={i} type="button" disabled={pending} onClick={() => onCommit(i)} className={cn(option, 'border-border')}>
                {a.text}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            You chose: <span className="font-medium text-foreground">{decision.approaches[approach].text}</span>. Now, exactly how?
          </p>
          <div className="mt-2 grid gap-3" role="radiogroup" data-testid="ways">
            {decision.approaches[approach].ways.map((text, w) => {
              const isBlocked = approach * WAYS + w === blocked
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={way === w}
                  disabled={pending || isBlocked}
                  onClick={() => setWay(w)}
                  className={cn(option, way === w ? 'border-primary ring-2 ring-primary/40' : 'border-border')}
                >
                  {text}
                  {isBlocked && <span className="mt-1 block text-xs text-muted-foreground">Your earlier choice</span>}
                </button>
              )
            })}
          </div>
          <Button className="mt-4" disabled={way === null} loading={pending} onClick={() => way !== null && onLockIn(approach * WAYS + way)}>
            Lock in
          </Button>
        </>
      )}
    </section>
  )
}

/**
 * The debrief: score, every lost point and, where unlocked, its reason. For a
 * last-chance run it also gives the first try's score and marks each later
 * decision as changed, the same, or the same choice playing out differently
 * (only when the later choices were kept: `kept`). A first try links to its
 * last chance when it had one.
 */
function Debrief({
  run,
  runId,
  parent,
  kept,
  lastChanceId,
  pending,
  onRestart,
}: {
  run: RunRow
  runId: string
  /** The first try this run is the last chance of, when it loaded. */
  parent: RunRow | undefined
  kept: boolean
  lastChanceId: string | undefined
  pending: boolean
  onRestart: () => void
}) {
  const ending = run.ending || 'bad'
  const [explained, setExplained] = useState<Explained[] | null>(null)
  const [explainError, setExplainError] = useState('')

  // Reasons come from the server, which unlocks a lost decision's reason only
  // after the player has tried two different choices there.
  useEffect(() => {
    let live = true
    runAction<{ decisions: Explained[] }>('explain', { runId })
      .then((res) => live && setExplained(res.decisions))
      .catch((e: Error) => live && setExplainError(e.message))
    return () => {
      live = false
    }
  }, [runId])

  // This player's finished runs of the same scenario and seed version (read 'own': only their own rows reach the page): first try and best so far.
  // Newest first, so the latest runs always count. One row past the window is fetched only to learn whether older runs exist: when they
  // do, the first try may be among them, so it is not claimed, and the best is labelled as covering the window only.
  const { records: fetched } = useQuery<RunRow>('runs', {
    where: { scenarioId: run.scenarioId, status: 'done' },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: HISTORY_WINDOW + 1,
  })
  const windowFull = fetched.length > HISTORY_WINDOW
  const mine = useMemo(() => fetched.slice(0, HISTORY_WINDOW), [fetched])
  const history = useMemo(() => runHistory(mine, run.answersId), [mine, run.answersId])

  const lost = run.steps.reduce((sum, s) => sum + s.points, 0)
  return (
    <section className="mt-8" data-testid="debrief">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-4xl font-bold tracking-tight text-foreground" data-testid="score">
          {run.score}
          <span className="text-lg font-medium text-muted-foreground"> / 100</span>
        </p>
        <p className="mt-1 font-mono text-sm text-muted-foreground" data-testid="score-sum">
          {scoreSum(
            run.steps.map((s) => s.points),
            run.score,
          )}
        </p>
        <Badge className="mt-3" variant={ENDING_BADGE[ending]} size="lg">
          {ENDING_LABEL[ending]}
        </Badge>
        <p className="mt-3 text-foreground">{run.endingText}</p>
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          {history && (
            <li data-testid="history">
              {windowFull
                ? `Your first run of this scenario: not shown (you have more than ${HISTORY_WINDOW} finished runs here). Best in your last ${HISTORY_WINDOW}: ${history.best}.`
                : `Your first run of this scenario: ${history.first}. Best so far: ${history.best}.`}
            </li>
          )}
          <li>This beats {run.beats}% of all possible paths.</li>
          <li>Random picking averages about {run.snapshot.guessAverage} here.</li>
        </ul>
        {run.fix.decision >= 0 && (
          <div className="mt-4 rounded-md border border-primary/40 bg-accent/30 p-3 text-sm">
            <p className="text-foreground">
              Your biggest single fix is decision {run.fix.decision + 1}: changing it alone could win back up to {run.fix.gain} of the {lost}{' '}
              points you lost.
            </p>
          </div>
        )}
        {run.branchAt >= 0 && parent && (
          <p className="mt-4 text-sm text-foreground" data-testid="first-try">
            This was your last chance on that run. Your first try scored {parent.score}.
          </p>
        )}
        {run.branchAt >= 0 && (
          <Link to={`/compare/${runId}`} className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
            Compare with your first try →
          </Link>
        )}
        {lastChanceId && (
          <Link
            to={`/run/${lastChanceId}`}
            className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open your last chance on this run →
          </Link>
        )}
      </div>

      <Tunnel run={run} />

      <h2 className="mt-8 text-lg font-semibold text-foreground">Every point you lost</h2>
      <p className="text-sm text-muted-foreground">
        The reason behind a lost point unlocks once you have tried two different choices at that decision, in your last chance or in a
        new run from the start.
      </p>
      {explainError && <p className="mt-2 text-sm text-destructive">Reasons could not load: {explainError}</p>}
      <ol className="mt-4 space-y-4" data-testid="demerits">
        {run.steps.map((step, i) => {
          const why = explained?.[i]
          const branch = run.branchAt >= 0 && i === run.branchAt
          const later = kept && parent !== undefined && i > run.branchAt
          const same = later && parent.choices[i] === run.choices[i]
          const differs = same && parent.outcomes[i] !== run.outcomes[i]
          return (
            <li key={i} className={cn('rounded-lg border p-4', i === run.fix.decision ? 'border-primary' : 'border-border')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision {i + 1}</span>
                <Badge variant={GRADE_BADGE[step.grade]} size="sm">
                  {gradeLine(step.grade)}
                </Badge>
                {(branch || (later && !same)) && (
                  <span className="rounded-full border border-primary px-2 py-0.5 text-xs font-medium text-foreground">Changed</span>
                )}
                {same && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Same as last time
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{run.snapshot.decisions[i].prompt}</p>
              <p className="mt-1 font-medium text-foreground">You: {choiceText(run.snapshot.decisions[i], run.choices[i])}</p>
              <p className="mt-2 text-sm text-foreground/90">{run.outcomes[i]}</p>
              {differs && <p className="mt-2 text-sm font-medium text-foreground">This played out differently this time.</p>}
              {step.causedBy >= 0 && (
                <p className="mt-2 text-sm text-warning-foreground" data-testid="caused-by">
                  This would have been a {gradeLine(step.base).toLowerCase()}, but your choice at decision {step.causedBy + 1} made it
                  worse{why?.flag ? `: ${why.flag}` : ''}.
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground" data-testid="why">
                {!why ? (
                  'Loading the reason…'
                ) : why.unlocked ? (
                  <>
                    <span className="font-medium text-foreground">Why: </span>
                    {why.why}
                  </>
                ) : (
                  `Reason locked: try a different choice here to unlock it (${why.tried} of 2 tried).`
                )}
              </p>
            </li>
          )
        })}
      </ol>
      <div className="mt-8 flex gap-3">
        <Button variant="outline" disabled={pending} onClick={onRestart}>
          Play again from the start
        </Button>
        <BackLink />
      </div>
    </section>
  )
}

function BackLink() {
  return (
    <Link to="/home" className="mt-4 inline-flex items-center px-3 text-sm text-muted-foreground hover:text-foreground">
      Back to scenarios
    </Link>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center text-muted-foreground">{children}</div>
}
