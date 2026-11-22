/**
 * Funnel maths. Pure functions with no React and no DeepSpace calls, so they
 * are easy to read, unit-test and change.
 *
 * Input: a funnel's steps and every report the caller is allowed to see.
 * For the admin that is every tester's reports; DeepSpace's permissions decide
 * that, not this file.
 */
import type { FunnelStep } from '../../schemas/funnels-schema'
import type { StepReport } from '../../schemas/reports-schema'

export interface StepStats {
  step: FunnelStep
  /** Testers who reported anything on this step (they reached it). */
  reached: number
  done: number
  /** Testers whose latest answer on this step is "stuck". */
  stuck: number
  /** done / testers who started the funnel, 0..1: the share who got past this step. */
  passRate: number
  notes: { testerId: string; note: string; outcome: StepReport['outcome'] }[]
}

export interface FunnelStats {
  testers: number
  finished: number
  steps: StepStats[]
  /** The step with the most testers currently stuck, or null if nobody is. */
  worstStepId: string | null
}

export function computeFunnelStats(steps: FunnelStep[], reports: StepReport[]): FunnelStats {
  const stepIds = new Set(steps.map((s) => s.id))
  // Ignore reports for steps that were later deleted from the funnel.
  const relevant = reports.filter((r) => stepIds.has(r.stepId))
  const testers = new Set(relevant.map((r) => r.testerId))

  const stepStats: StepStats[] = steps.map((step) => {
    const forStep = relevant.filter((r) => r.stepId === step.id)
    const done = forStep.filter((r) => r.outcome === 'done').length
    const stuck = forStep.filter((r) => r.outcome === 'stuck').length
    return {
      step,
      reached: forStep.length,
      done,
      stuck,
      passRate: testers.size === 0 ? 0 : done / testers.size,
      notes: forStep
        .filter((r) => r.note.trim() !== '')
        .map((r) => ({ testerId: r.testerId, note: r.note, outcome: r.outcome })),
    }
  })

  // A tester "finished" when every step has a "done" report from them.
  let finished = 0
  for (const t of testers) {
    const doneSteps = new Set(
      relevant.filter((r) => r.testerId === t && r.outcome === 'done').map((r) => r.stepId),
    )
    if (steps.length > 0 && steps.every((s) => doneSteps.has(s.id))) finished++
  }

  let worstStepId: string | null = null
  let worstStuck = 0
  for (const s of stepStats) {
    if (s.stuck > worstStuck) {
      worstStuck = s.stuck
      worstStepId = s.step.id
    }
  }

  return { testers: testers.size, finished, steps: stepStats, worstStepId }
}

/** The step a tester should work on next: the first one not marked done. */
export function nextStepId(steps: FunnelStep[], myReports: StepReport[]): string | null {
  const done = new Set(myReports.filter((r) => r.outcome === 'done').map((r) => r.stepId))
  return steps.find((s) => !done.has(s.id))?.id ?? null
}

/** Make a short random id for a new step. */
export function newStepId(): string {
  return Math.random().toString(36).slice(2, 10)
}
