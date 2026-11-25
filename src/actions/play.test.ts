import { beforeEach, describe, expect, it } from 'vitest'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { STARTERS } from '../seeds/starters'
import { fromChoice } from '../features/play/engine'
import { choicesOf, findChoice, fixture } from '../features/play/fixture'
import { FORMAT, type RunRow, type ScenarioAnswers } from '../features/play/types'
import { fakeTools } from './fake-tools'
import { canPlay } from './shared'
import { type Explained, playActions, resetSeedCache, RUNS_PER_DAY, SEED_VERSION, seedStarterRows, starterAnswersId } from './play'

const OWNER = 'user_owner'
const env = { OWNER_USER_ID: OWNER } as Env
type Store = ReturnType<typeof fakeTools>['store']

beforeEach(() => resetSeedCache())

/** Calls an action as `userId` against a shared in-memory store. */
function caller(store: Store) {
  return async <T = Record<string, unknown>>(name: string, userId: string, params: Record<string, unknown> = {}) => {
    const { tools } = fakeTools(userId, store)
    return (await playActions[name]({ userId, params, tools, env, callerJwt: 'jwt' })) as ActionResult<T>
  }
}
type Call = ReturnType<typeof caller>

const SCENARIO = 'fixture'
const answersId = starterAnswersId(SCENARIO, SEED_VERSION)

/** A store holding the test scenario, seeded the way starters are (shuffled), and its stored answers. */
async function seeded() {
  const { store, tools } = fakeTools(OWNER)
  expect(await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)])).toEqual({ success: true, data: { written: 1 } })
  const answers = store.get('scenario_answers')!.get(answersId)!.data as unknown as ScenarioAnswers
  return { store, call: caller(store), keys: answers.wayKeys }
}

const runOf = (store: Store, id: string) => store.get('runs')!.get(id)!.data as unknown as RunRow

async function start(call: Call, userId = 'user_a') {
  const res = await call<{ runId: string }>('startRun', userId, { scenarioId: SCENARIO })
  expect(res.success).toBe(true)
  return res.data!.runId
}

/** Commits to the approach `choice` belongs to at `decision`, then locks `choice` in; returns the lock-in result. */
async function lockIn<T = Record<string, unknown>>(call: Call, runId: string, decision: number, choice: number, userId = 'user_a') {
  expect((await call('commit', userId, { runId, decision, approach: fromChoice(choice).approach })).success).toBe(true)
  return call<T>('choose', userId, { runId, decision, choice })
}

/** Locks in `choices` from decision `from` on. */
async function play(call: Call, runId: string, choices: number[], from = 0, userId = 'user_a') {
  for (let i = 0; i < choices.length; i++) {
    const res = await lockIn(call, runId, from + i, choices[i], userId)
    expect(res.success).toBe(true)
  }
}

describe('seedStarters', () => {
  it('writes every starter for any signed-in user, owned by nobody and public', async () => {
    const { store } = fakeTools('user_a')
    const res = await caller(store)('seedStarters', 'user_a')
    expect(res).toEqual({ success: true, data: { written: STARTERS.length } })
    const row = store.get('scenarios')!.get(STARTERS[0].id!)!.data
    expect(row).toMatchObject({ authorId: '', visibility: 'public', format: FORMAT, starter: true })
  })

  it('stores the readable half without grades, reasons or flags', async () => {
    const { store } = await seeded()
    const text = JSON.stringify(store.get('scenarios')!.get(SCENARIO)!.data)
    expect(text).not.toMatch(/"(grade|why|raises|ifRaised|wayKeys)"\s*:/)
    expect(text).not.toContain('Reason 000.')
  })

  it('shuffles the same way on every worker, so answers and text always match', async () => {
    const a = await seeded()
    const b = await seeded()
    expect(a.store.get('scenarios')!.get(SCENARIO)!.data.decisions).toEqual(b.store.get('scenarios')!.get(SCENARIO)!.data.decisions)
    expect(a.keys).toEqual(b.keys)
  })

  it('skips a starter at this version, and writes it again when its answers are missing or elsewhere', async () => {
    const { store } = await seeded()
    const { tools } = fakeTools('user_b', store)
    expect(await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)])).toEqual({ success: true, data: { written: 0 } })
    store.get('scenario_answers')!.delete(answersId)
    expect(await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)])).toEqual({ success: true, data: { written: 1 } })
    store.get('scenarios')!.get(SCENARIO)!.data.answersId = 'someone_elses_answers'
    expect(await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)])).toEqual({ success: true, data: { written: 1 } })
    expect(store.get('scenarios')!.get(SCENARIO)!.data.answersId).toBe(answersId)
  })

  it('never writes an older version over a newer one', async () => {
    const { tools, store } = fakeTools('user_a')
    await seedStarterRows(tools, SEED_VERSION + 1, [fixture(SCENARIO)])
    expect(await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)])).toEqual({ success: true, data: { written: 0 } })
    expect(store.get('scenarios')!.get(SCENARIO)!.data.seedVersion).toBe(SEED_VERSION + 1)
  })

  it('after one success in this worker instance, later calls read nothing', async () => {
    const { store } = fakeTools('user_a')
    await caller(store)('seedStarters', 'user_a')
    const { tools } = fakeTools('user_b', store)
    let reads = 0
    const counting = { ...tools, get: async (...a: Parameters<ActionTools['get']>) => (reads++, tools.get(...a)) }
    const res = await playActions.seedStarters({ userId: 'user_b', params: {}, tools: counting as ActionTools, env, callerJwt: 'jwt' })
    expect(res).toEqual({ success: true, data: { written: 0 } })
    expect(reads).toBe(0)
  })

  it('on a new version keeps runs already started on their old answers', async () => {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    const changed = fixture(SCENARIO)
    changed.endings.good = 'A different good ending.'
    await seedStarterRows(fakeTools('user_b', store).tools, SEED_VERSION + 1, [changed])
    expect(store.get('scenarios')!.get(SCENARIO)!.data.answersId).toBe(starterAnswersId(SCENARIO, SEED_VERSION + 1))

    await play(call, runId, choicesOf(keys, 'best'))
    expect(runOf(store, runId)).toMatchObject({ answersId, endingText: 'Good.', score: 100 })

    // A rewind of that run also stays on its own text and answers.
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 3 })).data!.runId
    expect(runOf(store, child)).toMatchObject({ answersId, snapshot: runOf(store, runId).snapshot })
    // A rewind needs a different choice: a slip at the last decision still ends good (95).
    await play(call, child, [choicesOf(keys, 'slip')[3]], 3)
    expect(runOf(store, child)).toMatchObject({ endingText: 'Good.', score: 95 })
  })
})

describe('startRun', () => {
  it('starts an empty graded run with a snapshot of the readable half', async () => {
    const { store, call } = await seeded()
    const run = runOf(store, await start(call))
    expect(run).toMatchObject({ format: FORMAT, status: 'playing', choices: [], score: 0, branchAt: -1, approach: -1, answersId })
    expect(run.snapshot.decisions).toHaveLength(4)
    expect(run.snapshot.decisions[0].approaches[0].ways).toHaveLength(3)
    expect(run.snapshot.guessAverage).toBeGreaterThan(0)
  })

  it('refuses a scenario whose answers are missing', async () => {
    const { store, call } = await seeded()
    store.get('scenario_answers')!.delete(answersId)
    expect((await call('startRun', 'user_a', { scenarioId: SCENARIO })).error).toBe('That scenario is not available.')
  })

  it('refuses a scenario row from the first version', async () => {
    const { store, call } = await seeded()
    delete store.get('scenarios')!.get(SCENARIO)!.data.format
    expect((await call('startRun', 'user_a', { scenarioId: SCENARIO })).error).toBe('That scenario is not available.')
  })

  it('refuses a signed-out or anonymous caller', async () => {
    const { call } = await seeded()
    for (const userId of ['', 'anon-123']) expect((await call('startRun', userId, { scenarioId: SCENARIO })).error).toBe('Sign in to play.')
  })
})

describe('commit', () => {
  it('stores the approach on the run, so a reload shows it, and allows the same one again', async () => {
    const { store, call } = await seeded()
    const runId = await start(call)
    expect(await call('commit', 'user_a', { runId, decision: 0, approach: 2 })).toEqual({ success: true, data: { approach: 2 } })
    expect(runOf(store, runId).approach).toBe(2)
    expect((await call('commit', 'user_a', { runId, decision: 0, approach: 2 })).success).toBe(true)
  })

  it('refuses a different approach once one is chosen, and a way from another approach', async () => {
    const { store, call } = await seeded()
    const runId = await start(call)
    expect((await call('choose', 'user_a', { runId, decision: 0, choice: 0 })).error).toBe('Choose an approach first.')
    await call('commit', 'user_a', { runId, decision: 0, approach: 1 })
    expect((await call('commit', 'user_a', { runId, decision: 0, approach: 0 })).error).toBe('You already chose an approach for this decision.')
    for (const choice of [0, 2, 6, 8]) {
      expect((await call('choose', 'user_a', { runId, decision: 0, choice })).error).toContain('different approach')
    }
    expect(runOf(store, runId).choices).toEqual([])
    expect((await call('choose', 'user_a', { runId, decision: 0, choice: 4 })).success).toBe(true)
  })

  it('clears the approach on lock-in, so the next decision needs its own', async () => {
    const { store, call } = await seeded()
    const runId = await start(call)
    await lockIn(call, runId, 0, 5)
    expect(runOf(store, runId).approach).toBe(-1)
    expect((await call('choose', 'user_a', { runId, decision: 1, choice: 0 })).error).toBe('Choose an approach first.')
    expect((await call('commit', 'user_a', { runId, decision: 1, approach: 0 })).success).toBe(true)
  })

  it('ignores a commit stored for an earlier decision, so a late commit cannot bind the next one', async () => {
    const { store, call } = await seeded()
    const runId = await start(call)
    await lockIn(call, runId, 0, 5)
    // A commit for decision 0 whose write lands after the lock-in: the row says approach 2, made at decision 0.
    Object.assign(store.get('runs')!.get(runId)!.data, { approach: 2, approachAt: 0 })
    expect((await call('choose', 'user_a', { runId, decision: 1, choice: 6 })).error).toBe('Choose an approach first.')
    expect((await call('commit', 'user_a', { runId, decision: 1, approach: 0 })).success).toBe(true)
    expect(runOf(store, runId)).toMatchObject({ approach: 0, approachAt: 1 })
    expect((await call('choose', 'user_a', { runId, decision: 1, choice: 1 })).success).toBe(true)
  })

  it('refuses another player, a stale decision, a bad approach, a finished run and a run from the first version', async () => {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    expect((await call('commit', 'user_b', { runId, decision: 0, approach: 0 })).error).toBe('Run not found.')
    expect((await call('commit', 'user_a', { runId, decision: 1, approach: 0 })).success).toBe(false)
    for (const approach of [3, -1, 1.5, '1', null]) {
      expect((await call('commit', 'user_a', { runId, decision: 0, approach })).error).toBe('Pick an approach.')
    }
    expect(runOf(store, runId).approach).toBe(-1)
    await play(call, runId, choicesOf(keys, 'best'))
    expect((await call('commit', 'user_a', { runId, decision: 4, approach: 0 })).error).toBe('This run is already finished.')
    const old = await start(call)
    delete store.get('runs')!.get(old)!.data.format
    expect((await call('commit', 'user_a', { runId: old, decision: 0, approach: 0 })).error).toContain('older version')
  })
})

describe('choose', () => {
  it('scores a perfect run 100 with a good ending and no fix to make', async () => {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    const best = choicesOf(keys, 'best')
    for (let d = 0; d < 4; d++) {
      const res = await lockIn<{ done: boolean }>(call, runId, d, best[d])
      expect(res.data).toEqual({ done: d === 3 })
      expect(runOf(store, runId).outcomes[d]).toBe(`Outcome ${d}00.`)
    }
    const run = runOf(store, runId)
    expect(run).toMatchObject({ status: 'done', score: 100, ending: 'good', endingText: 'Good.', fix: { decision: -1, gain: 0 } })
    expect(run.steps.map((s) => s.points)).toEqual([0, 0, 0, 0])
    expect(run.beats).toBeGreaterThanOrEqual(99)
  })

  it('lists every lost point, applies a raised flag and names the decision that raised it', async () => {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    const best = choicesOf(keys, 'best')
    const raise = findChoice(keys, 0, (w) => !!w.raises?.length)
    const hit = findChoice(keys, 2, (w) => !!w.ifRaised)
    await play(call, runId, [raise, best[1], hit, best[3]])
    const run = runOf(store, runId)
    expect(run.steps[0]).toEqual({ grade: 'slip', points: 5, base: 'slip', causedBy: -1 })
    expect(run.steps[2]).toEqual({ grade: 'blunder', points: 20, base: 'slip', causedBy: 0 })
    expect(run.score).toBe(75)
    expect(run.ending).toBe('ok')
    expect(run.outcomes[2]).toBe('The promise comes due.')
    // Fixing decision 1 gains 5 and stops the flag (15 more); fixing decision 3 gains 20. Ties go to the earlier decision.
    expect(run.fix).toEqual({ decision: 0, gain: 20 })
    expect(JSON.stringify(run)).not.toContain('Reason')
  })

  it('refuses another player, a stale decision, a bad choice and a finished run', async () => {
    const { call, keys } = await seeded()
    const runId = await start(call)
    expect((await call('choose', 'user_b', { runId, decision: 0, choice: 0 })).error).toBe('Run not found.')
    expect((await call('choose', 'user_a', { runId, decision: 1, choice: 0 })).success).toBe(false)
    for (const choice of [9, -1, 1.5, '1', null]) {
      expect((await call('choose', 'user_a', { runId, decision: 0, choice })).success).toBe(false)
    }
    await play(call, runId, choicesOf(keys, 'blunder'))
    expect((await call('choose', 'user_a', { runId, decision: 4, choice: 0 })).error).toBe('This run is already finished.')
  })

  it('refuses to continue a run from the first version', async () => {
    const { store, call } = await seeded()
    const runId = await start(call)
    delete store.get('runs')!.get(runId)!.data.format
    expect((await call('choose', 'user_a', { runId, decision: 0, choice: 0 })).error).toContain('older version')
  })
})

describe('rewind', () => {
  it('keeps the choices before the decision and refuses the same choice there again', async () => {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    const blunders = choicesOf(keys, 'blunder')
    await play(call, runId, blunders)

    expect((await call('rewind', 'user_b', { runId, decision: 2 })).success).toBe(false)
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 2 })).data!.runId
    const row = runOf(store, child)
    expect(row).toMatchObject({ choices: blunders.slice(0, 2), parentRunId: runId, branchAt: 2, status: 'playing', score: 0, approach: -1 })
    expect(row.outcomes).toHaveLength(2)

    expect((await lockIn(call, child, 2, blunders[2])).error).toBe('You chose that last time. Rewinding is for trying a different choice.')
    const second = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 2 })).data!.runId
    await play(call, second, choicesOf(keys, 'best').slice(2), 2)
    expect(runOf(store, second).score).toBe(100 - 40)
  })

  it('refuses an unfinished run, a decision out of range and an anonymous caller', async () => {
    const { call, keys } = await seeded()
    const runId = await start(call)
    expect((await call('rewind', 'user_a', { runId, decision: 0 })).success).toBe(false)
    await play(call, runId, choicesOf(keys, 'best'))
    for (const decision of [-1, 4, '1']) expect((await call('rewind', 'user_a', { runId, decision })).success).toBe(false)
    expect((await call('rewind', 'anon-123', { runId, decision: 0 })).error).toBe('Sign in to play.')
  })
})

describe('explain', () => {
  it('shows the reason for a best way at once and locks the rest until two choices were tried there', async () => {
    const { call, keys } = await seeded()
    const best = choicesOf(keys, 'best')
    const raise = findChoice(keys, 0, (w) => !!w.raises?.length)
    const hit = findChoice(keys, 2, (w) => !!w.ifRaised)
    const first = await start(call)
    await play(call, first, [raise, best[1], hit, best[3]])

    const one = (await call<{ decisions: Explained[] }>('explain', 'user_a', { runId: first })).data!.decisions
    expect(one.map((d) => d.unlocked)).toEqual([false, true, false, true])
    expect(one[0]).toEqual({ unlocked: false, why: '', flag: '', tried: 1 })
    expect(one[1].why).toBe('Reason 100.')

    // A rewound run with a different choice at decision 3 unlocks that decision only.
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId: first, decision: 2 })).data!.runId
    await play(call, child, [best[2], best[3]], 2)
    const two = (await call<{ decisions: Explained[] }>('explain', 'user_a', { runId: first })).data!.decisions
    expect(two.map((d) => d.unlocked)).toEqual([false, true, true, true])
    expect(two[2]).toEqual({ unlocked: true, why: 'You promised earlier.', flag: 'You promised Friday', tried: 2 })
  })

  it('counts only the caller’s own finished runs on the same answers', async () => {
    const { call, keys } = await seeded()
    const mine = await start(call)
    await play(call, mine, choicesOf(keys, 'blunder'))
    const theirs = await start(call, 'user_b')
    await play(call, theirs, choicesOf(keys, 'mistake'), 0, 'user_b')
    const unfinished = await start(call)
    expect((await lockIn(call, unfinished, 0, choicesOf(keys, 'mistake')[0])).success).toBe(true)
    const res = (await call<{ decisions: Explained[] }>('explain', 'user_a', { runId: mine })).data!.decisions
    expect(res.every((d) => !d.unlocked && d.tried === 1)).toBe(true)
  })

  it('counts the oldest finished runs first, so 200 later runs do not push out an earlier choice', async () => {
    const { store, call, keys } = await seeded()
    const blunders = choicesOf(keys, 'blunder')
    const other = await start(call)
    await play(call, other, [choicesOf(keys, 'best')[0], ...blunders.slice(1)])
    const runId = await start(call)
    await play(call, runId, blunders)
    // 200 more finished runs, all with the same choice at the first decision: the counted window is full without the oldest.
    const runs = store.get('runs')!
    for (let i = 0; i < 200; i++) {
      const id = `rec_copy_${i}`
      runs.set(id, { recordId: id, createdBy: 'user_a', createdAt: new Date().toISOString(), data: { ...runs.get(runId)!.data } })
    }
    const res = (await call<{ decisions: Explained[] }>('explain', 'user_a', { runId })).data!.decisions
    expect(res[0]).toMatchObject({ unlocked: true, tried: 2 })
  })

  it('refuses another player and an unfinished run', async () => {
    const { call } = await seeded()
    const runId = await start(call)
    expect((await call('explain', 'user_a', { runId })).success).toBe(false)
    expect((await call('explain', 'user_b', { runId })).error).toBe('Run not found.')
  })
})

describe('runs per player per day', () => {
  it(`refuses a new run or a rewind after ${RUNS_PER_DAY} runs in 24 hours, for that player only`, async () => {
    const { call, keys } = await seeded()
    const runId = await start(call)
    await play(call, runId, choicesOf(keys, 'blunder'))
    for (let i = 1; i < RUNS_PER_DAY; i++) await start(call)
    expect((await call('startRun', 'user_a', { scenarioId: SCENARIO })).error).toContain(`${RUNS_PER_DAY} runs`)
    expect((await call('rewind', 'user_a', { runId, decision: 1 })).success).toBe(false)
    await start(call, 'user_b')
  })

  it('lets the player start again once their oldest counted run is over 24 hours old', async () => {
    const { store, call } = await seeded()
    for (let i = 0; i < RUNS_PER_DAY; i++) await start(call)
    expect((await call('startRun', 'user_a', { scenarioId: SCENARIO })).success).toBe(false)
    const oldest = [...store.get('runs')!.values()][0]
    oldest.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    await start(call)
  })

  it('refuses when the run count cannot be read', async () => {
    const { store } = await seeded()
    const { tools } = fakeTools('user_a', store)
    const broken = { ...tools, query: async () => ({ success: false as const, error: 'down' }) }
    const res = await playActions.startRun({
      userId: 'user_a',
      params: { scenarioId: SCENARIO },
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
      params: { scenarioId: SCENARIO },
      tools: broken as unknown as ActionTools,
      env,
      callerJwt: 'jwt',
    })
    expect(res.success).toBe(false)
    expect(res.error).not.toContain('SQLITE')
  })
})

describe('canPlay', () => {
  it('lets only the author start a private scenario', async () => {
    const { store, call } = await seeded()
    Object.assign(store.get('scenarios')!.get(SCENARIO)!.data, { visibility: 'private', authorId: 'user_a' })
    expect((await call('startRun', 'user_b', { scenarioId: SCENARIO })).success).toBe(false)
    await start(call)
  })

  it('lets only the author play a taken-down scenario, even if it was left public', async () => {
    const { store, call } = await seeded()
    Object.assign(store.get('scenarios')!.get(SCENARIO)!.data, { visibility: 'public', authorId: 'user_a', takenDown: true })
    expect((await call('startRun', 'user_b', { scenarioId: SCENARIO })).success).toBe(false)
    await start(call)
  })

  it("while writing is off, refuses another player's scenario even when public, and keeps starters and the author's own", async () => {
    const shared = { visibility: 'public' as const, authorId: 'user_a', takenDown: false, starter: false }
    const starter = { visibility: 'public' as const, authorId: '', takenDown: false, starter: true }
    expect(canPlay(shared, 'user_b', true)).toBe(true)
    expect(canPlay(shared, 'user_b', false)).toBe(false)
    expect(canPlay(shared, 'user_a', false)).toBe(true)
    expect(canPlay(starter, 'user_b', false)).toBe(true)

    // The actions the app runs use the switch as it is (off).
    const { store, call } = await seeded()
    Object.assign(store.get('scenarios')!.get(SCENARIO)!.data, { starter: false, authorId: 'user_a', visibility: 'public' })
    expect((await call('startRun', 'user_b', { scenarioId: SCENARIO })).error).toBe('That scenario is not available.')
    await start(call)
  })

  it("while writing is off, refuses a rewind of a finished run on another player's scenario, and keeps the author's", async () => {
    const { store, call, keys } = await seeded()
    const theirs = await start(call, 'user_b')
    await play(call, theirs, choicesOf(keys, 'best'), 0, 'user_b')
    const own = await start(call)
    await play(call, own, choicesOf(keys, 'best'))
    // The scenario turns out to be user_a's public one (as if written while writing was on).
    Object.assign(store.get('scenarios')!.get(SCENARIO)!.data, { starter: false, authorId: 'user_a', visibility: 'public' })
    expect((await call('rewind', 'user_b', { runId: theirs, decision: 3 })).error).toBe('This scenario is no longer available.')
    expect((await call('rewind', 'user_a', { runId: own, decision: 3 })).success).toBe(true)
  })

  it('never lets anyone play a private starter (authorId is empty)', async () => {
    const { store, call } = await seeded()
    store.get('scenarios')!.get(SCENARIO)!.data.visibility = 'private'
    expect((await call('startRun', OWNER, { scenarioId: SCENARIO })).success).toBe(false)
  })
})
