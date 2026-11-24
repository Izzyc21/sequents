import { describe, expect, it } from 'vitest'
import type { ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'
import { STARTERS } from '../seeds/starters'
import type { RunRow } from '../features/play/types'
import { fakeTools } from './fake-tools'
import { playActions } from './play'

const OWNER = 'user_owner'
const env = { OWNER_USER_ID: OWNER } as Env

/** Calls an action as `userId` against a shared in-memory store. */
function caller(store: ReturnType<typeof fakeTools>['store']) {
  return async <T = Record<string, unknown>>(name: string, userId: string, params: Record<string, unknown> = {}) => {
    const { tools } = fakeTools(userId, store)
    const res = (await playActions[name]({ userId, params, tools, env, callerJwt: 'jwt' })) as ActionResult<T>
    return res
  }
}

async function seeded() {
  const { store } = fakeTools(OWNER)
  const call = caller(store)
  const res = await call<{ written: number }>('seedStarters', OWNER)
  expect(res).toEqual({ success: true, data: { written: 6 } })
  return { store, call }
}

const starter = STARTERS[0]
const pathOf = (kind: string) => starter.scenes.map((s) => s.options.findIndex((o) => o.kind === kind))

describe('seedStarters', () => {
  it('only does anything for the owner', async () => {
    const { store } = fakeTools('user_a')
    const res = await caller(store)('seedStarters', 'user_a')
    expect(res).toEqual({ success: true, data: { skipped: true } })
    expect(store.size).toBe(0)
  })

  it('writes each starter once, then skips until the seed version changes', async () => {
    const { store, call } = await seeded()
    expect(store.get('scenarios')!.size).toBe(6)
    expect(store.get('scenario_answers')!.size).toBe(6)
    expect(await call('seedStarters', OWNER)).toEqual({ success: true, data: { written: 0 } })
    const row = store.get('scenarios')!.get(starter.id!)!.data
    expect(row.visibility).toBe('public')
    expect(JSON.stringify(row)).not.toContain(starter.scenes[0].options[0].why)
  })
})

describe('a full run, a rewind and its rules', () => {
  it('plays every best pick to a good ending and fills the debrief', async () => {
    const { store, call } = await seeded()
    const start = await call<{ runId: string }>('startRun', 'user_a', { scenarioId: starter.id })
    expect(start.success).toBe(true)
    const runId = start.data!.runId
    const best = pathOf('best')
    for (let scene = 0; scene < 5; scene++) {
      const res = await call<{ done: boolean }>('choose', 'user_a', { runId, scene, option: best[scene] })
      expect(res.success).toBe(true)
      expect(res.data!.done).toBe(scene === 4)
    }
    const run = store.get('runs')!.get(runId)!.data as unknown as RunRow
    expect(run.status).toBe('done')
    expect(run.ending).toBe('good')
    expect(run.endingText).toBe(starter.endings.good)
    expect(run.debrief.map((d) => d.kind)).toEqual(['best', 'best', 'best', 'best', 'best'])
    expect(run.meterHistory).toHaveLength(6)
  })

  it('refuses another player, a stale scene, a bad option and a finished run', async () => {
    const { call } = await seeded()
    const runId = (await call<{ runId: string }>('startRun', 'user_a', { scenarioId: starter.id })).data!.runId
    expect((await call('choose', 'user_b', { runId, scene: 0, option: 0 })).error).toBe('Run not found.')
    expect((await call('choose', 'user_a', { runId, scene: 1, option: 0 })).success).toBe(false)
    expect((await call('choose', 'user_a', { runId, scene: 0, option: 3 })).success).toBe(false)
    expect((await call('choose', 'user_a', { runId, scene: 0, option: '1' })).success).toBe(false)
    for (let scene = 0; scene < 5; scene++) await call('choose', 'user_a', { runId, scene, option: 0 })
    expect((await call('choose', 'user_a', { runId, scene: 5, option: 0 })).error).toBe('This run is already finished.')
  })

  it('rewinds to a decision, keeps the picks before it and refuses the same pick again', async () => {
    const { store, call } = await seeded()
    const runId = (await call<{ runId: string }>('startRun', 'user_a', { scenarioId: starter.id })).data!.runId
    const trap = pathOf('trap')
    for (let scene = 0; scene < 5; scene++) await call('choose', 'user_a', { runId, scene, option: trap[scene] })

    expect((await call('rewind', 'user_b', { runId, decision: 2 })).success).toBe(false)
    const child = await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 2 })
    expect(child.success).toBe(true)
    const childId = child.data!.runId
    const childRow = store.get('runs')!.get(childId)!.data as unknown as RunRow
    expect(childRow.choices).toEqual(trap.slice(0, 2))
    expect(childRow.meterHistory).toHaveLength(3)
    expect(childRow.parentRunId).toBe(runId)

    const same = await call('choose', 'user_a', { runId: childId, scene: 2, option: trap[2] })
    expect(same.success).toBe(false)
    const best = pathOf('best')
    expect((await call('choose', 'user_a', { runId: childId, scene: 2, option: best[2] })).success).toBe(true)
  })

  it('refuses rewinding an unfinished run', async () => {
    const { call } = await seeded()
    const runId = (await call<{ runId: string }>('startRun', 'user_a', { scenarioId: starter.id })).data!.runId
    expect((await call('rewind', 'user_a', { runId, decision: 0 })).success).toBe(false)
  })
})

describe('canPlay', () => {
  it('lets only the author start or rewind a private scenario', async () => {
    const { store, call } = await seeded()
    const row = store.get('scenarios')!.get(starter.id!)!
    row.data.visibility = 'private'
    row.data.authorId = 'user_a'
    expect((await call('startRun', 'user_b', { scenarioId: starter.id })).success).toBe(false)
    expect((await call('startRun', 'user_a', { scenarioId: starter.id })).success).toBe(true)
  })

  it('never lets anyone play a private starter (authorId is empty)', async () => {
    const { store, call } = await seeded()
    store.get('scenarios')!.get(starter.id!)!.data.visibility = 'private'
    expect((await call('startRun', OWNER, { scenarioId: starter.id })).success).toBe(false)
  })
})
