import { describe, expect, it } from 'vitest'
import { computeFunnelStats, nextStepId } from './stats'
import type { StepReport } from '../../schemas/reports-schema'

const steps = [
  { id: 'install', title: 'Install' },
  { id: 'scaffold', title: 'Scaffold' },
  { id: 'deploy', title: 'Deploy' },
]

const r = (testerId: string, stepId: string, outcome: 'done' | 'stuck', note = ''): StepReport => ({
  funnelId: 'f1',
  testerId,
  stepId,
  outcome,
  note,
})

describe('computeFunnelStats', () => {
  it('returns zeros for a funnel nobody has tried', () => {
    const s = computeFunnelStats(steps, [])
    expect(s.testers).toBe(0)
    expect(s.finished).toBe(0)
    expect(s.worstStepId).toBeNull()
    expect(s.steps.every((x) => x.reached === 0 && x.passRate === 0)).toBe(true)
  })

  it('counts drop-off, finishers and the worst step', () => {
    const reports = [
      r('a', 'install', 'done'),
      r('a', 'scaffold', 'done'),
      r('a', 'deploy', 'done'),
      r('b', 'install', 'done'),
      r('b', 'scaffold', 'stuck', 'npm crashed'),
      r('c', 'install', 'stuck', 'wrong node version'),
      r('d', 'install', 'done'),
      r('d', 'scaffold', 'stuck', ''),
    ]
    const s = computeFunnelStats(steps, reports)
    expect(s.testers).toBe(4)
    expect(s.finished).toBe(1)
    expect(s.steps.map((x) => x.reached)).toEqual([4, 3, 1])
    expect(s.steps[1].stuck).toBe(2)
    expect(s.worstStepId).toBe('scaffold')
    // Empty notes are left out of the notes list.
    expect(s.steps[1].notes).toEqual([{ testerId: 'b', note: 'npm crashed', outcome: 'stuck' }])
  })

  it('ignores reports for steps that were removed', () => {
    const s = computeFunnelStats(steps, [r('a', 'old-step', 'stuck')])
    expect(s.testers).toBe(0)
  })
})

describe('nextStepId', () => {
  it('is the first step not marked done', () => {
    expect(nextStepId(steps, [r('a', 'install', 'done'), r('a', 'scaffold', 'stuck')])).toBe('scaffold')
    expect(nextStepId(steps, steps.map((x) => r('a', x.id, 'done')))).toBeNull()
  })
})
