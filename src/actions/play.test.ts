import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { STARTERS } from '../seeds/starters'
import type { RunRow } from '../features/play/types'
import { fakeTools } from './fake-tools'
import { playActions, resetSeedCache, RUNS_PER_DAY, SEED_VERSION, seedStarterRows, starterAnswersId } from './play'

const OWNER = 'user_owner'
const env = { OWNER_USER_ID: OWNER } as Env

beforeEach(() => resetSeedCache())

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
  const res = await call<{ written: number }>('seedStarters', 'user_a')
  expect(res).toEqual({ success: true, data: { written: 6 } })
  return { store, call }
}

const starter = STARTERS[0]
const pathOf = (kind: string) => starter.scenes.map((s) => s.options.findIndex((o) => o.kind === kind))

describe('seedStarters', () => {
  it('works for any signed-in user, not only the owner', async () => {
    const { store } = fakeTools('user_a')
    const res = await caller(store)('seedStarters', 'user_a')
    expect(res).toEqual({ success: true, data: { written: 6 } })
    const row = store.get('scenarios')!.get(starter.id!)!.data
    expect(row.authorId).toBe('')
  })

  it('writes each starter once, then skips until the seed version changes', async () => {
    const { store, call } = await seeded()
    expect(store.get('scenarios')!.size).toBe(6)
    expect(store.get('scenario_answers')!.size).toBe(6)
    const { tools } = fakeTools('user_b', store)
    expect(await seedStarterRows(tools, SEED_VERSION, STARTERS)).toEqual({ success: true, data: { written: 0 } })
    const row = store.get('scenarios')!.get(starter.id!)!.data
    expect(row.visibility).toBe('public')
    expect(row.answersId).toBe(starterAnswersId(starter.id!, SEED_VERSION))
    expect(JSON.stringify(row)).not.toContain(starter.scenes[0].options[0].why)
  })

  it('writes a starter again when its answers row is missing', async () => {
    const { store, call } = await seeded()
    store.get('scenario_answers')!.delete(starterAnswersId(starter.id!, SEED_VERSION))
    resetSeedCache()
    expect(await call('seedStarters', 'user_a')).toEqual({ success: true, data: { written: 1 } })
    expect(store.get('scenario_answers')!.has(starterAnswersId(starter.id!, SEED_VERSION))).toBe(true)
  })

  it('writes a starter again when it points at other answers at the same version', async () => {
    const { store } = await seeded()
    store.get('scenarios')!.get(starter.id!)!.data.answersId = 'someone_elses_answers'
    const { tools } = fakeTools('user_a', store)
    expect(await seedStarterRows(tools, SEED_VERSION, STARTERS)).toEqual({ success: true, data: { written: 1 } })
    expect(store.get('scenarios')!.get(starter.id!)!.data.answersId).toBe(starterAnswersId(starter.id!, SEED_VERSION))
  })

  it('never writes an older version over a newer one', async () => {
    const { store } = fakeTools('user_a')
    const { tools } = fakeTools('user_a', store)
    await seedStarterRows(tools, SEED_VERSION + 1, STARTERS)
    expect(await seedStarterRows(tools, SEED_VERSION, STARTERS)).toEqual({ success: true, data: { written: 0 } })
    const row = store.get('scenarios')!.get(starter.id!)!.data
    expect(row.seedVersion).toBe(SEED_VERSION + 1)
    expect(row.answersId).toBe(starterAnswersId(starter.id!, SEED_VERSION + 1))
  })

  it('after one success in this worker instance, later calls read nothing', async () => {
    const { store } = await seeded()
    const { tools } = fakeTools('user_b', store)
    let reads = 0
    const counting = { ...tools, get: async (...a: Parameters<ActionTools['get']>) => (reads++, tools.get(...a)) }
    const res = await playActions.seedStarters({ userId: 'user_b', params: {}, tools: counting as ActionTools, env, callerJwt: 'jwt' })
    expect(res).toEqual({ success: true, data: { written: 0 } })
    expect(reads).toBe(0)
  })

  it('on a new version makes every starter public and keeps old runs on their old answers', async () => {
    const { store, call } = await seeded()
    const runId = (await call<{ runId: string }>('startRun', 'user_a', { scenarioId: starter.id })).data!.runId
    store.get('scenarios')!.get(STARTERS[1].id!)!.data.visibility = 'private'

    // The next version changes the first starter's good ending.
    const changed = structuredClone(STARTERS)
    changed[0].endings.good = 'A different good ending.'
    const { tools } = fakeTools('user_b', store)
    expect(await seedStarterRows(tools, SEED_VERSION + 1, changed)).toEqual({ success: true, data: { written: 6 } })

    expect(store.get('scenarios')!.get(STARTERS[1].id!)!.data.visibility).toBe('public')
    expect(store.get('scenarios')!.get(starter.id!)!.data.answersId).toBe(starterAnswersId(starter.id!, SEED_VERSION + 1))
    expect(store.get('scenario_answers')!.size).toBe(12)

    const best = pathOf('best')
    for (let scene = 0; scene < 5; scene++) await call('choose', 'user_a', { runId, scene, option: best[scene] })
    const old = store.get('runs')!.get(runId)!.data as unknown as RunRow
    expect(old.answersId).toBe(starterAnswersId(starter.id!, SEED_VERSION))
    expect(old.endingText).toBe(starter.endings.good)

    const fresh = (await call<{ runId: string }>('startRun', 'user_a', { scenarioId: starter.id })).data!.runId
    for (let scene = 0; scene < 5; scene++) await call('choose', 'user_a', { runId: fresh, scene, option: best[scene] })
    expect((store.get('runs')!.get(fresh)!.data as unknown as RunRow).endingText).toBe('A different good ending.')
  })
})

describe('startRun', () => {
  it('refuses a scenario whose answers row is missing', async () => {
    const { store, call } = await seeded()
    store.get('scenario_answers')!.delete(starterAnswersId(starter.id!, SEED_VERSION))
    expect((await call('startRun', 'user_a', { scenarioId: starter.id })).error).toBe('That scenario is not available.')
  })
})

describe('runs per player per day', () => {
  /** Starts `n` runs for `userId` and returns the last run's id. */
  async function startMany(call: ReturnType<typeof caller>, userId: string, n: number) {
    let last = ''
    for (let i = 0; i < n; i++) {
      const res = await call<{ runId: string }>('startRun', userId, { scenarioId: starter.id })
      expect(res.success).toBe(true)
      last = res.data!.runId
    }
    return last
  }

  it(`refuses a new run or a rewind after ${RUNS_PER_DAY} runs in 24 hours, for that player only`, async () => {
    const { call } = await seeded()
    const runId = await startMany(call, 'user_a', 1)
    for (let scene = 0; scene < 5; scene++) await call('choose', 'user_a', { runId, scene, option: 0 })
    await startMany(call, 'user_a', RUNS_PER_DAY - 1)

    const again = await call('startRun', 'user_a', { scenarioId: starter.id })
    expect(again.success).toBe(false)
    expect(again.error).toContain(`${RUNS_PER_DAY} runs`)
    expect((await call('rewind', 'user_a', { runId, decision: 1 })).success).toBe(false)
    expect((await call('startRun', 'user_b', { scenarioId: starter.id })).success).toBe(true)
  })

  it('lets the player start again once their oldest counted run is over 24 hours old', async () => {
    const { store, call } = await seeded()
    await startMany(call, 'user_a', RUNS_PER_DAY)
    expect((await call('startRun', 'user_a', { scenarioId: starter.id })).success).toBe(false)
    const oldest = [...store.get('runs')!.values()][0]
    oldest.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    expect((await call('startRun', 'user_a', { scenarioId: starter.id })).success).toBe(true)
  })

  it('refuses when the run count cannot be read', async () => {
    const { store } = await seeded()
    const { tools } = fakeTools('user_a', store)
    const broken = { ...tools, query: async () => ({ success: false as const, error: 'down' }) }
    const res = await playActions.startRun({
      userId: 'user_a',
      params: { scenarioId: starter.id },
      tools: broken as unknown as ActionTools,
      env,
      callerJwt: 'jwt',
    })
    expect(res.success).toBe(false)
  })
})

describe('save failures', () => {
  it('give the browser a plain message, never the storage error', async () => {
    const { store } = await seeded()
    const { tools } = fakeTools('user_a', store)
    const broken = { ...tools, create: async () => ({ success: false as const, error: 'SQLITE_FULL: database or disk is full' }) }
    const res = await playActions.startRun({
      userId: 'user_a',
      params: { scenarioId: starter.id },
      tools: broken as unknown as ActionTools,
      env,
      callerJwt: 'jwt',
    })
    expect(res.success).toBe(false)
    expect(res.error).not.toContain('SQLITE')
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

  it('lets only the author play a taken-down scenario, even if it was left public', async () => {
    const { store, call } = await seeded()
    const row = store.get('scenarios')!.get(starter.id!)!
    Object.assign(row.data, { visibility: 'public', authorId: 'user_a', takenDown: true })
    expect((await call('startRun', 'user_b', { scenarioId: starter.id })).success).toBe(false)
    expect((await call('startRun', 'user_a', { scenarioId: starter.id })).success).toBe(true)
  })

  it('never lets anyone play a private starter (authorId is empty)', async () => {
    const { store, call } = await seeded()
    store.get('scenarios')!.get(starter.id!)!.data.visibility = 'private'
    expect((await call('startRun', OWNER, { scenarioId: starter.id })).success).toBe(false)
  })
})
