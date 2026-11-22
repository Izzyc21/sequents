/**
 * /try/:id: the tester's checklist for one funnel.
 *
 * For each step the tester taps Done or Stuck. A stuck step asks what went
 * wrong. Each answer is one `step_reports` row per tester per step, so
 * changing your mind updates the same row (the schema's uniqueOn guarantees it).
 *
 * The page also joins a live presence room for this funnel and says which step
 * the tester is on, so the team's dashboard can show "who is trying right now".
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useMutations, usePresenceRoom, useQuery } from 'deepspace'
import { Badge, Button, Textarea, useToast } from '@/components/ui'
import type { Funnel, FunnelStep } from '../../../../schemas/funnels-schema'
import type { Outcome, StepReport } from '../../../../schemas/reports-schema'
import { nextStepId } from '../../../../features/funnels/stats'

/** What the client may send. testerId is stamped by the server. */
type ReportWrite = Omit<StepReport, 'testerId'>

export default function TryFunnelPage() {
  const { id = '' } = useParams()
  const { userId } = useAuth()
  const funnels = useQuery<Funnel>('funnels')
  // Filter to my own rows. For testers the server already does this; an admin
  // can read everyone's rows, so the testerId filter keeps their checklist personal.
  const mine = useQuery<StepReport>('step_reports', { where: { funnelId: id, testerId: userId ?? '' } })
  const { create, put, ready } = useMutations<ReportWrite>('step_reports')
  const { error } = useToast()

  const funnel = funnels.records.find((f) => f.recordId === id)
  const steps = funnel?.data.steps ?? []
  const myReports = mine.records.map((r) => r.data)
  const current = nextStepId(steps, myReports)

  // Tell the presence room which step I'm on (ephemeral, nothing is stored).
  const { updateState } = usePresenceRoom(`funnel:${id}`)
  useEffect(() => {
    updateState({ stepId: current ?? 'finished' })
  }, [current, updateState])

  function save(stepId: string, outcome: Outcome, note: string) {
    const existing = mine.records.find((r) => r.data.stepId === stepId)
    // Fire-and-forget writes; a refusal shows as a toast via the layout's onWriteError.
    if (existing) put(existing.recordId, { outcome, note })
    else create({ funnelId: id, stepId, outcome, note })
  }

  if (funnels.status === 'loading') return <p className="px-6 py-10 text-sm text-muted-foreground">Loading…</p>
  if (!funnel) {
    return (
      <div className="px-6 py-10 text-sm text-muted-foreground">
        This funnel does not exist or was removed. <Link className="underline" to="/funnels">Back to funnels</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">{funnel.data.name}</h1>
      {funnel.data.description && <p className="mt-1 text-sm text-muted-foreground">{funnel.data.description}</p>}
      <p className="mt-4 text-sm text-muted-foreground">
        Work through the steps in order. If something blocks you, mark it stuck and say what happened; the team sees it right away.
      </p>

      {current === null && steps.length > 0 && (
        <p data-testid="finished" className="mt-6 rounded-md border border-border bg-card p-4 text-sm text-foreground">
          You finished every step. Thank you.
        </p>
      )}

      <ol className="mt-6 space-y-3">
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            index={i}
            step={step}
            report={myReports.find((r) => r.stepId === step.id)}
            isCurrent={step.id === current}
            disabled={!ready}
            onSave={(outcome, note) => save(step.id, outcome, note)}
            onError={error}
          />
        ))}
      </ol>
    </div>
  )
}

function StepRow(props: {
  index: number
  step: FunnelStep
  report?: StepReport
  isCurrent: boolean
  disabled: boolean
  onSave: (outcome: Outcome, note: string) => void
  onError: (title: string) => void
}) {
  const { index, step, report, isCurrent, disabled, onSave, onError } = props
  const [writingNote, setWritingNote] = useState(false)
  const [note, setNote] = useState(report?.note ?? '')

  return (
    <li
      data-testid={`step-${index}`}
      className={`rounded-lg border p-4 ${isCurrent ? 'border-primary bg-card' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">
            {index + 1}. {step.title}
          </p>
          {step.hint && <p className="mt-1 font-mono text-xs text-muted-foreground">{step.hint}</p>}
        </div>
        {report && (
          <Badge variant={report.outcome === 'done' ? 'success' : 'destructive'}>
            {report.outcome === 'done' ? 'Done' : 'Stuck'}
          </Badge>
        )}
      </div>

      {report?.outcome === 'stuck' && report.note && !writingNote && (
        <p className="mt-2 text-sm text-muted-foreground">Your note: {report.note}</p>
      )}

      {writingNote ? (
        <div className="mt-3 space-y-2">
          <Textarea
            aria-label="What went wrong?"
            placeholder="What went wrong? Paste the error if there was one."
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={disabled}
              onClick={() => {
                if (!note.trim()) return onError('Say briefly what went wrong')
                onSave('stuck', note.trim())
                setWritingNote(false)
              }}
            >
              Save as stuck
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWritingNote(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={disabled || report?.outcome === 'done'} onClick={() => onSave('done', report?.note ?? '')}>
            Done
          </Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => setWritingNote(true)}>
            {report?.outcome === 'stuck' ? 'Edit note' : 'Stuck'}
          </Button>
        </div>
      )}
    </li>
  )
}
