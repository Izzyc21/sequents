import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { STARTERS } from '../seeds/starters'
import { analyse, bestSingleFix, fromChoice, scoreRun, tunnelCounts } from '../features/play/engine'
import { choicesOf, findChoice, fixture } from '../features/play/fixture'
import { FORMAT, LAST_CHANCE_CLOSED, LAST_CHANCE_USED, NOT_REVEALED, baseAnswersId, keepsLaterChoices, lastChanceRunId, pickLastChance, runHistory, scoreVisible, type RunRow, type ScenarioAnswers } from '../features/play/types'
import { fakeTools } from './fake-tools'
import { canPlay } from './shared'
import { type Explained, playActions, resetSeedCache, RUNS_PER_DAY, SEED_VERSION, seedStarterRows, starterAnswersId } from './play'

const OWNER = 'user_owner'
const env = { OWNER_USER_ID: OWNER } as Env
type Store = ReturnType<typeof fakeTools>['store']

beforeEach(() => resetSeedCache())
afterEach(() => vi.restoreAllMocks())

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

/** Reveals a finished run's score. */
async function reveal(call: Call, runId: string, userId = 'user_a') {
  const res = await call('reveal', userId, { runId })
  expect(res.success).toBe(true)
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
    await reveal(call, runId)
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
    await reveal(call, runId)
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

describe('look back', () => {
  /** Runs an action as `userId` and counts the record writes it makes. */
  async function counted(store: Store, name: string, userId: string, params: Record<string, unknown>) {
    const { tools } = fakeTools(userId, store)
    let writes = 0
    const wrap =
      <A extends unknown[], R>(fn: (...a: A) => R) =>
      (...a: A) => (writes++, fn(...a))
    const watching = { ...tools, create: wrap(tools.create), update: wrap(tools.update), remove: wrap(tools.remove) }
    const result = (await playActions[name]({ userId, params, tools: watching as ActionTools, env, callerJwt: 'jwt' })) as ActionResult
    return { result, writes }
  }

  /** A run finished with a flag-raising slip, a clean middle, a flagged slip and a best last choice (score 75, not yet revealed). */
  async function finished() {
    const { store, call, keys } = await seeded()
    const best = choicesOf(keys, 'best')
    const choices = [findChoice(keys, 0, (w) => !!w.raises?.length), best[1], findChoice(keys, 2, (w) => !!w.ifRaised), best[3]]
    const runId = await start(call)
    await play(call, runId, choices)
    return { store, call, keys, runId, choices }
  }

  it('opens the look-back on the last choice with the total only, and writes the grades when the debrief opens', async () => {
    const { store, call, keys, runId, choices } = await finished()
    const run = runOf(store, runId)
    expect(run).toMatchObject({ status: 'done', score: 75, ending: 'ok', hidden: 1 })
    expect(run.lookback).toBeUndefined()
    // Nothing on the row says where the points went yet: the player can read their own run's data.
    expect(run).toMatchObject({ steps: [], fix: { decision: -1, gain: 0 }, beats: 0 })
    expect(run.tunnel).toBeUndefined()
    expect(scoreVisible(run)).toBe(false)
    await reveal(call, runId)
    const shown = runOf(store, runId)
    expect(shown.steps).toEqual(scoreRun(keys, choices).steps)
    expect(shown.fix).toEqual(bestSingleFix(keys, choices))
    expect(shown.tunnel).toEqual(tunnelCounts(keys, choices))
    expect(shown.tunnel).toHaveLength(5)
    expect(shown.beats).toBeGreaterThan(0)
    const playing = await start(call)
    await lockIn(call, playing, 0, 0)
    expect(runOf(store, playing).lookback).toBeUndefined()
    expect(runOf(store, playing).hidden).toBeUndefined()
    expect(runOf(store, playing).tunnel).toBeUndefined()
  })

  it('records the tunnel of a perfect run: it starts at every good path and ends at 1', async () => {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    await play(call, runId, choicesOf(keys, 'best'))
    await reveal(call, runId)
    const tunnel = runOf(store, runId).tunnel!
    expect(tunnel[0]).toBe(analyse(keys).endings.good)
    expect(tunnel[4]).toBe(1)
    for (let k = 1; k < 5; k++) expect(tunnel[k]).toBeLessThanOrEqual(tunnel[k - 1])
  })

  it('counts a missing hidden flag as revealed, and a finished run only once it is revealed', () => {
    expect(scoreVisible({ status: 'done', hidden: undefined })).toBe(true)
    expect(scoreVisible({ status: 'done', hidden: 0 })).toBe(true)
    expect(scoreVisible({ status: 'done', hidden: 1 })).toBe(false)
    expect(scoreVisible({ status: 'playing', hidden: undefined })).toBe(false)
  })

  it('reveals once, and a second reveal or one on an old row writes nothing', async () => {
    const { store, call, runId } = await finished()
    const first = await counted(store, 'reveal', 'user_a', { runId })
    expect(first.result.success).toBe(true)
    expect(first.writes).toBe(1)
    expect(runOf(store, runId).hidden).toBe(0)
    expect(scoreVisible(runOf(store, runId))).toBe(true)

    const second = await counted(store, 'reveal', 'user_a', { runId })
    expect(second.result.success).toBe(true)
    expect(second.writes).toBe(0)

    const old = await start(call)
    Object.assign(runOf(store, old), { status: 'done' })
    const third = await counted(store, 'reveal', 'user_a', { runId: old })
    expect(third.result.success).toBe(true)
    expect(third.writes).toBe(0)
    expect(runOf(store, old).hidden).toBeUndefined()
  })

  it('refuses a reveal while the last chance is being played, and allows it once that run is finished', async () => {
    const { store, call, keys, runId, choices } = await finished()
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 3 })).data!.runId
    const refused = await counted(store, 'reveal', 'user_a', { runId })
    expect(refused.result.error).toBe('Finish your last chance first. When it ends you see where your points went on both tries.')
    expect(refused.writes).toBe(0)
    expect(runOf(store, runId).hidden).toBe(1)
    await play(call, child, [choicesOf(keys, 'slip')[3]], 3)
    expect(runOf(store, child).choices.slice(0, 3)).toEqual(choices.slice(0, 3))
    // Finishing the last chance shows both debriefs; if that write had failed, the reveal would still work.
    expect(runOf(store, runId).hidden).toBe(0)
    runOf(store, runId).hidden = 1
    await reveal(call, runId)
    expect(runOf(store, runId).hidden).toBe(0)
  })

  it('refuses a reveal or a last chance when the runs cannot be read', async () => {
    const { store, runId } = await finished()
    const { tools } = fakeTools('user_a', store)
    // Only the lookup of the first try's last chance fails; the daily run count has its own test.
    const query: ActionTools['query'] = async (collection, options) =>
      (options?.where as Record<string, unknown> | undefined)?.parentRunId !== undefined
        ? { success: false as const, error: 'down' }
        : tools.query(collection, options)
    const broken = { ...tools, query } as unknown as ActionTools
    for (const [name, params] of [['reveal', { runId }], ['rewind', { runId, decision: 1 }]] as const) {
      const res = (await playActions[name]({ userId: 'user_a', params, tools: broken, env, callerJwt: 'jwt' })) as ActionResult
      expect(res.error).toBe('Could not load your runs. Try again.')
    }
    expect(runOf(store, runId).hidden).toBe(1)
    expect([...store.get('runs')!.values()]).toHaveLength(1)
  })

  it('refuses a reveal on another player’s run and on a run still playing', async () => {
    const { store, call, runId } = await finished()
    expect((await call('reveal', 'user_b', { runId })).error).toBe('Run not found.')
    expect(runOf(store, runId).hidden).toBe(1)
    const playing = await start(call)
    expect((await call('reveal', 'user_a', { runId: playing })).error).toBe('Finish the run first.')
  })

  it('refuses explain before the reveal and allows it after', async () => {
    const { call, runId } = await finished()
    expect((await call('explain', 'user_a', { runId })).error).toBe(NOT_REVEALED)
    await reveal(call, runId)
    expect((await call<{ decisions: Explained[] }>('explain', 'user_a', { runId })).data!.decisions).toHaveLength(4)
  })

  it('explains an old finished run that has no look-back state', async () => {
    const { store, call, runId } = await finished()
    delete runOf(store, runId).lookback
    delete runOf(store, runId).hidden
    expect(scoreVisible(runOf(store, runId))).toBe(true)
    expect((await call('explain', 'user_a', { runId })).success).toBe(true)
  })

  it('lets the last chance start from a first try whose debrief is hidden, and keeps it hidden while it is played', async () => {
    const { store, call, runId } = await finished()
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 0 })).data!.runId
    expect(child).toBe(lastChanceRunId(runId))
    expect(runOf(store, child)).toMatchObject({ parentRunId: runId, status: 'playing' })
    expect(runOf(store, runId).hidden).toBe(1)
  })
})

describe('last chance and reveal sent at the same time', () => {
  const act = (name: string, params: Record<string, unknown>, tools: ActionTools) =>
    playActions[name]({ userId: 'user_a', params, tools, env, callerJwt: 'jwt' }) as Promise<ActionResult<{ runId: string }>>
  const plain = (store: Store) => fakeTools('user_a', store).tools as ActionTools
  /** Lets every pending in-memory call run. */
  const settle = () => new Promise((r) => setTimeout(r, 0))

  /** Tools whose first `method` call waits until the returned release() is called: the other request runs in between. */
  function held(store: Store, method: 'create' | 'update') {
    const { tools } = fakeTools('user_a', store)
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    let waited = false
    const original = tools[method] as (...a: unknown[]) => Promise<unknown>
    const wrapped = async (...a: unknown[]) => {
      if (!waited) {
        waited = true
        await gate
      }
      return original(...a)
    }
    return { tools: { ...tools, [method]: wrapped } as unknown as ActionTools, release, reached: () => waited }
  }

  async function finishedRun() {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    await play(call, runId, choicesOf(keys, 'blunder'))
    return { store, runId }
  }

  const lastChances = (store: Store, runId: string) =>
    [...store.get('runs')!.values()].filter((r) => (r.data as unknown as RunRow).parentRunId === runId)

  it('a reveal that lands after the last chance passed its checks wins: the new run is withdrawn', async () => {
    const { store, runId } = await finishedRun()
    const rewind = held(store, 'create')
    const rewinding = act('rewind', { runId, decision: 1 }, rewind.tools)
    await settle()
    expect(rewind.reached()).toBe(true)
    expect((await act('reveal', { runId }, plain(store))).success).toBe(true)
    rewind.release()
    expect((await rewinding).error).toBe(LAST_CHANCE_CLOSED)
    expect(runOf(store, runId).hidden).toBe(0)
    expect(lastChances(store, runId)).toHaveLength(0)
  })

  it('a last chance created after the reveal passed its checks is withdrawn by the reveal', async () => {
    const { store, runId } = await finishedRun()
    const revealHeld = held(store, 'update')
    const revealing = act('reveal', { runId }, revealHeld.tools)
    await settle()
    expect(revealHeld.reached()).toBe(true)
    expect((await act('rewind', { runId, decision: 1 }, plain(store))).success).toBe(true)
    revealHeld.release()
    expect((await revealing).success).toBe(true)
    expect(runOf(store, runId).hidden).toBe(0)
    expect(lastChances(store, runId)).toHaveLength(0)
  })

  it('two last chances sent at once write one run', async () => {
    const { store, runId } = await finishedRun()
    const a = held(store, 'create')
    const b = held(store, 'create')
    const first = act('rewind', { runId, decision: 1 }, a.tools)
    const second = act('rewind', { runId, decision: 2 }, b.tools)
    await settle()
    expect(a.reached() && b.reached()).toBe(true)
    a.release()
    b.release()
    const results = await Promise.all([first, second])
    for (const res of results) expect(res.data).toEqual({ runId: lastChanceRunId(runId) })
    expect(lastChances(store, runId)).toHaveLength(1)
    expect(runOf(store, runId).hidden).toBe(1)
  })

  it('with several last chances from an earlier version, picks the unfinished one and refuses the reveal until it ends', async () => {
    const { store, runId } = await finishedRun()
    const { tools } = fakeTools('user_a', store)
    const base = { ...runOf(store, runId), parentRunId: runId, branchAt: 1 }
    await tools.create('runs', { ...base, status: 'done', hidden: 0 } as unknown as Record<string, unknown>, 'old-done')
    await tools.create('runs', { ...base, status: 'playing', choices: base.choices.slice(0, 1) } as unknown as Record<string, unknown>, 'old-open')
    expect(pickLastChance(lastChances(store, runId).map((r) => ({ recordId: r.recordId as string, data: r.data as unknown as RunRow })))).toEqual({ id: 'old-open', done: false })
    expect((await act('reveal', { runId }, plain(store))).error).toBe('Finish your last chance first. When it ends you see where your points went on both tries.')
    expect((await act('rewind', { runId, decision: 0 }, plain(store))).error).toBe(LAST_CHANCE_USED)
    expect(runOf(store, runId).hidden).toBe(1)
  })

  it('picks the first unfinished last chance, else the oldest', () => {
    const row = (recordId: string, status: RunRow['status']) => ({ recordId, data: { status } })
    expect(pickLastChance([])).toBeUndefined()
    expect(pickLastChance([row('a', 'done'), row('b', 'playing'), row('c', 'playing')])).toEqual({ id: 'b', done: false })
    expect(pickLastChance([row('a', 'done'), row('b', 'done')])).toEqual({ id: 'a', done: true })
  })
})

describe('fake record tools', () => {
  it('drop keys that are not declared columns of the collection, like the SDK', async () => {
    const { tools, store } = fakeTools('user_a')
    await tools.create('runs', { scenarioId: 's', playerId: 'user_a', status: 'playing', notAColumn: 1 }, 'r1')
    await tools.update('runs', 'r1', { hidden: 1, lookback: { hintGuess: -1, hint: '' }, alsoNot: 2 })
    await tools.update('runs', 'r1', { hidden: 0 })
    expect(store.get('runs')!.get('r1')!.data).toEqual({
      scenarioId: 's',
      playerId: 'user_a',
      status: 'playing',
      hidden: 0,
      lookback: { hintGuess: -1, hint: '' },
    })
  })
})

describe('hidden versions', () => {
  const versionId = starterAnswersId(SCENARIO, SEED_VERSION, 1)

  /** A second version of the fixture: same readable text, with other grades at the last decision. */
  function variantDraft() {
    const draft = fixture(SCENARIO)
    const ways = draft.decisions[3].approaches[0].ways
    ;[ways[0].grade, ways[1].grade] = [ways[1].grade, ways[0].grade]
    ways[2].grade = 'best'
    ways[0].outcome = 'A different outcome.'
    draft.endings.good = 'A different good ending.'
    return draft
  }

  /** A store seeded with the fixture and `variants` as its hidden versions. */
  async function withVariants(variants = [variantDraft()]) {
    const { store, tools } = fakeTools(OWNER)
    expect(await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)], { [SCENARIO]: variants })).toEqual({ success: true, data: { written: 1 } })
    return { store, tools, call: caller(store) }
  }

  /** Makes the next startRun calls draw these random words, one per draw. */
  function draws(...words: number[]) {
    const queue = [...words]
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
      array[0] = queue.shift() ?? 0
      return array
    }) as typeof crypto.getRandomValues)
  }

  const answersOf = (store: Store, id: string) => store.get('scenario_answers')!.get(id)!.data as unknown as ScenarioAnswers

  it('names the answers of hidden version n with a .n suffix', () => {
    expect(starterAnswersId('x', 4)).toBe('x@v4')
    expect(starterAnswersId('x', 4, 0)).toBe('x@v4')
    expect(starterAnswersId('x', 4, 2)).toBe('x@v4.2')
    expect(baseAnswersId('x@v4.2')).toBe('x@v4')
    expect(baseAnswersId('x@v4')).toBe('x@v4')
  })

  it('writes one answers row per version and the same readable row as a starter with no versions', async () => {
    const plain = await seeded()
    const { store } = await withVariants()
    const { variants, guessAverage: _mean, ...readable } = store.get('scenarios')!.get(SCENARIO)!.data
    expect(variants).toBe(1)
    const { variants: none, guessAverage: _plain, ...plainReadable } = plain.store.get('scenarios')!.get(SCENARIO)!.data
    expect(none).toBe(0)
    expect(readable).toEqual(plainReadable)
    expect(readable.answersId).toBe(answersId)
    expect(answersOf(store, answersId).wayKeys).toEqual(plain.keys)
    expect(answersOf(store, versionId).wayKeys).not.toEqual(plain.keys)
    expect(answersOf(store, versionId).endings.good).toBe('A different good ending.')
    // Same order in both, only the hidden half differs: the same way texts sit at the same places.
    const texts = (ans: ScenarioAnswers) => ans.wayKeys.map((d) => d.map((a) => a.map((w) => w.outcome === 'A different outcome.')))
    expect(texts(answersOf(store, versionId)).flat(2).filter(Boolean)).toHaveLength(1)
  })

  it('sets the readable average to the mean over every version, and keeps the main version’s value when there is only one', async () => {
    const plain = await seeded()
    const { store } = await withVariants()
    const mainAverage = analyse(answersOf(store, answersId).wayKeys).guessAverage
    const variantAverage = analyse(answersOf(store, versionId).wayKeys).guessAverage
    expect(variantAverage).not.toBe(mainAverage)
    expect(store.get('scenarios')!.get(SCENARIO)!.data.guessAverage).toBe(Math.round(((mainAverage + variantAverage) / 2) * 10) / 10)
    expect(plain.store.get('scenarios')!.get(SCENARIO)!.data.guessAverage).toBe(analyse(plain.keys).guessAverage)
    // A run's snapshot copies the readable row's figure.
    draws(1)
    const runId = await start(caller(store))
    expect(runOf(store, runId).snapshot.guessAverage).toBe(store.get('scenarios')!.get(SCENARIO)!.data.guessAverage)
  })

  it('refuses to seed a starter whose hidden version has different readable text, writing none of it', async () => {
    const changed = variantDraft()
    changed.decisions[1].approaches[2].ways[0].text = 'Another way of putting it'
    const { store, tools } = fakeTools(OWNER)
    const res = await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)], { [SCENARIO]: [changed] })
    expect(res.success).toBe(false)
    expect(store.get('scenarios')?.get(SCENARIO)).toBeUndefined()
    expect(store.get('scenario_answers')?.size ?? 0).toBe(0)
    const retitled = variantDraft()
    retitled.title = 'Another title'
    expect((await seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)], { [SCENARIO]: [retitled] })).success).toBe(false)
  })

  it('skips a seeded starter, and writes it again when a version’s answers are missing or the number of versions changes', async () => {
    const { store, tools } = await withVariants()
    const seedAgain = (variants: unknown[]) =>
      seedStarterRows(tools, SEED_VERSION, [fixture(SCENARIO)], { [SCENARIO]: variants as ReturnType<typeof variantDraft>[] })
    expect(await seedAgain([variantDraft()])).toEqual({ success: true, data: { written: 0 } })
    store.get('scenario_answers')!.delete(versionId)
    expect(await seedAgain([variantDraft()])).toEqual({ success: true, data: { written: 1 } })
    expect(answersOf(store, versionId)).toBeDefined()
    expect(await seedAgain([])).toEqual({ success: true, data: { written: 1 } })
    expect(store.get('scenarios')!.get(SCENARIO)!.data.variants).toBe(0)
  })

  it('gives a run the version the random draw picks, and each version can be assigned', async () => {
    const { store, call } = await withVariants()
    draws(0, 1)
    const base = runOf(store, await start(call))
    const variant = runOf(store, await start(call))
    expect(base.answersId).toBe(answersId)
    expect(variant.answersId).toBe(versionId)
    expect(base.snapshot).toEqual(variant.snapshot)
  })

  it('draws uniformly without bias: a word in the uneven tail is thrown away', async () => {
    const { store, call } = await withVariants([variantDraft(), variantDraft()])
    // Three versions: the words 0, 1 and 2 pick versions 0, 1 and 2; the top word is refused and the next one used.
    draws(0, 1, 2, 0xffffffff, 2)
    const ids = []
    for (let i = 0; i < 4; i++) ids.push(runOf(store, await start(call)).answersId)
    expect(ids).toEqual([answersId, versionId, starterAnswersId(SCENARIO, SEED_VERSION, 2), starterAnswersId(SCENARIO, SEED_VERSION, 2)])
  })

  it('uses the main version when the chosen version’s answers are missing', async () => {
    const { store, call } = await withVariants()
    store.get('scenario_answers')!.delete(versionId)
    draws(1)
    expect(runOf(store, await start(call)).answersId).toBe(answersId)
  })

  it('assigns every version at random when nothing is stubbed', async () => {
    const { store, call } = await withVariants()
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) seen.add(runOf(store, await start(call)).answersId)
    expect([...seen].sort()).toEqual([answersId, versionId])
  })

  it('keeps the version through a rewind, and scores on that version’s answers', async () => {
    const { store, call } = await withVariants()
    draws(1)
    const runId = await start(call)
    const keys = answersOf(store, versionId).wayKeys
    const best = choicesOf(keys, 'best')
    await play(call, runId, best)
    expect(runOf(store, runId)).toMatchObject({ answersId: versionId, score: 100, endingText: 'A different good ending.' })
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 3 })).data!.runId
    expect(runOf(store, child).answersId).toBe(versionId)
    await play(call, child, [choicesOf(keys, 'slip')[3]], 3)
    expect(runOf(store, child)).toMatchObject({ answersId: versionId, status: 'done', score: 95 })
  })

  it('counts a player’s runs on every version of a seed version in the history, and no other seed version', () => {
    const row = (createdAt: string, id: string, score: number) => ({ createdAt, data: { answersId: id, score, status: 'done' as const } })
    const rows = [
      row('2026-11-02', 'a@v4.1', 80),
      row('2026-11-01', 'a@v4', 60),
      row('2026-11-03', 'a@v4', 95),
      row('2026-11-04', 'a@v3', 100),
      row('2026-11-05', 'b@v4', 100),
    ]
    expect(runHistory(rows, 'a@v4.1')).toEqual({ first: 60, best: 95 })
    expect(runHistory(rows, 'a@v4')).toEqual({ first: 60, best: 95 })
    expect(runHistory(rows, 'c@v4')).toBeNull()
  })

  it('counts every finished score in the history, the look-back’s too, and no unfinished run', () => {
    const row = (createdAt: string, score: number, hidden?: number) => ({ createdAt, data: { answersId: 'a@v4', score, status: 'done' as const, hidden } })
    expect(runHistory([row('2026-11-01', 60, 1), row('2026-11-02', 80, 0), row('2026-11-03', 100, 1)], 'a@v4')).toEqual({ first: 60, best: 100 })
    expect(runHistory([{ createdAt: '2026-11-01', data: { answersId: 'a@v4', score: 0, status: 'playing' as const } }], 'a@v4')).toBeNull()
  })

  it('keeps the earlier run’s later choices only for the same player, the same answers, and a finished four-choice parent', () => {
    const parent = { playerId: 'user_a', answersId: 'a@v4', status: 'done' as const, choices: [0, 1, 2, 3] }
    const run = { playerId: 'user_a', answersId: 'a@v4', branchAt: 1 }
    expect(keepsLaterChoices(run, parent)).toBe(true)
    expect(keepsLaterChoices(run, null)).toBe(false)
    expect(keepsLaterChoices(run, undefined)).toBe(false)
    expect(keepsLaterChoices({ ...run, branchAt: -1 }, parent)).toBe(false)
    expect(keepsLaterChoices({ ...run, playerId: 'user_b' }, parent)).toBe(false)
    expect(keepsLaterChoices({ ...run, answersId: 'a@v4.1' }, parent)).toBe(false)
    expect(keepsLaterChoices(run, { ...parent, status: 'playing' as const })).toBe(false)
    expect(keepsLaterChoices(run, { ...parent, choices: [0, 1, 2] })).toBe(false)
  })

  it('keeps reasons unlocked per exact answers id: a choice tried on another version does not count', async () => {
    const { store, call } = await withVariants()
    draws(0, 1)
    const first = await start(call)
    const second = await start(call)
    const keys = answersOf(store, answersId).wayKeys
    const blunders = choicesOf(keys, 'blunder')
    await play(call, first, blunders)
    await reveal(call, first)
    await play(call, second, [choicesOf(keys, 'best')[0], ...blunders.slice(1)])
    await reveal(call, second)
    const res = (await call<{ decisions: Explained[] }>('explain', 'user_a', { runId: first })).data!.decisions
    expect(res.every((d) => d.tried === 1)).toBe(true)
  })

  it('declares the variants column, so the fake store keeps it', async () => {
    const { store } = await withVariants()
    expect(store.get('scenarios')!.get(SCENARIO)!.data.variants).toBe(1)
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
    // The approach stays committed; another way in it finishes the run, and decision 4 keeps the original blunder.
    const { approach, way } = fromChoice(blunders[2])
    const other = approach * 3 + ((way + 1) % 3)
    expect((await call('choose', 'user_a', { runId: child, decision: 2, choice: other })).success).toBe(true)
    const choices = [...blunders.slice(0, 2), other, blunders[3]]
    expect(runOf(store, child)).toMatchObject({ status: 'done', score: scoreRun(keys, choices).score, choices })
  })

  it('gives each first try one last chance: no second one, none on a last-chance run, none after the reveal', async () => {
    const { store, call, keys } = await seeded()
    const runId = await start(call)
    await play(call, runId, choicesOf(keys, 'blunder'))
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 1 })).data!.runId
    // Refused while the last chance is still being played, and after it ends.
    expect((await call('rewind', 'user_a', { runId, decision: 2 })).error).toBe(LAST_CHANCE_USED)
    await play(call, child, [choicesOf(keys, 'best')[1]], 1)
    expect(runOf(store, child).status).toBe('done')
    expect((await call('rewind', 'user_a', { runId, decision: 2 })).error).toBe(LAST_CHANCE_USED)
    expect((await call('rewind', 'user_a', { runId: child, decision: 3 })).error).toBe(LAST_CHANCE_USED)

    const kept = await start(call)
    await play(call, kept, choicesOf(keys, 'blunder'))
    await reveal(call, kept)
    expect((await call('rewind', 'user_a', { runId: kept, decision: 0 })).error).toBe(LAST_CHANCE_CLOSED)
    expect([...store.get('runs')!.values()]).toHaveLength(3)
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

describe('rewind keeps the later choices', () => {
  /** The fixture run [raise, best, hit, best]: score 75, and decision 3 plays as a blunder because of the decision 1 raise. */
  async function flagged() {
    const { store, call, keys } = await seeded()
    const best = choicesOf(keys, 'best')
    const raise = findChoice(keys, 0, (w) => !!w.raises?.length)
    const hit = findChoice(keys, 2, (w) => !!w.ifRaised)
    const runId = await start(call)
    await play(call, runId, [raise, best[1], hit, best[3]])
    return { store, call, keys, best, raise, hit, runId }
  }

  it('finishes the rewound run with one choice at decision 1, decisions 2 to 4 equal to the parent’s', async () => {
    const { store, call, best, raise, hit, runId } = await flagged()
    const parent = runOf(store, runId)
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 0 })).data!.runId
    expect(runOf(store, child)).toMatchObject({ status: 'playing', choices: [] })
    const res = await lockIn<{ done: boolean }>(call, child, 0, best[0])
    expect(res.data).toEqual({ done: true })
    const row = runOf(store, child)
    expect(row.choices).toEqual([best[0], best[1], hit, best[3]])
    expect(row.choices.slice(1)).toEqual(parent.choices.slice(1))
    // A last chance ends with its debrief showing, and shows the first try's debrief too.
    expect(row).toMatchObject({ status: 'done', approach: -1, hidden: 0 })
    expect(row.lookback).toBeUndefined()
    expect(runOf(store, runId).hidden).toBe(0)
    expect(row.outcomes).toHaveLength(4)
    expect(row.steps).toHaveLength(4)
    // The first try's grades are written now that its debrief may show.
    expect(runOf(store, runId).steps).toHaveLength(4)
    expect(runOf(store, runId).tunnel).toHaveLength(5)
    expect(row.choices[0]).not.toBe(raise)
  })

  it('replays the whole path, so an outcome that depended on the changed choice is recomputed', async () => {
    const { store, call, keys, best, hit, runId } = await flagged()
    expect(runOf(store, runId).outcomes[2]).toBe('The promise comes due.')
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 0 })).data!.runId
    await lockIn(call, child, 0, best[0])
    expect(runOf(store, runId).steps[2]).toMatchObject({ grade: 'blunder', causedBy: 0 })
    const row = runOf(store, child)
    expect(row.outcomes[2]).toBe('Outcome 201.')
    expect(row.steps[2]).toEqual({ grade: 'slip', points: 5, base: 'slip', causedBy: -1 })
    expect(row.score).toBe(95)
    expect(row.ending).toBe('good')
    expect(row.fix).toEqual({ decision: 2, gain: 5 })
    expect(row.tunnel).toEqual(tunnelCounts(keys, [best[0], best[1], hit, best[3]]))
    expect(row.beats).toBeGreaterThan(0)
  })

  it('plays on one decision at a time when the parent is missing', async () => {
    const { store, call, keys, best, runId } = await flagged()
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 1 })).data!.runId
    store.get('runs')!.delete(runId)
    const first = await lockIn<{ done: boolean }>(call, child, 1, choicesOf(keys, 'slip')[1])
    expect(first.data).toEqual({ done: false })
    expect(runOf(store, child).status).toBe('playing')
    expect(runOf(store, child).choices).toHaveLength(2)
    await play(call, child, [best[2], best[3]], 2)
    expect(runOf(store, child)).toMatchObject({ status: 'done' })
    expect(runOf(store, child).choices).toHaveLength(4)
  })

  it('still refuses the same choice at the branch, and writes nothing', async () => {
    const { store, call, raise, runId } = await flagged()
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId, decision: 0 })).data!.runId
    expect((await lockIn(call, child, 0, raise)).error).toBe('You chose that last time. Rewinding is for trying a different choice.')
    expect(runOf(store, child)).toMatchObject({ status: 'playing', choices: [] })
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

    // The last chance with a different choice at decision 3 unlocks that decision only; best ways show at once.
    const child = (await call<{ runId: string }>('rewind', 'user_a', { runId: first, decision: 2 })).data!.runId
    await play(call, child, [best[2]], 2)
    const two = (await call<{ decisions: Explained[] }>('explain', 'user_a', { runId: first })).data!.decisions
    expect(two.map((d) => d.unlocked)).toEqual([false, true, true, true])
    expect(two[0]).toEqual({ unlocked: false, why: '', flag: '', tried: 1 })
    expect(two[1].why).toBe('Reason 100.')
    expect(two[2]).toEqual({ unlocked: true, why: 'You promised earlier.', flag: 'You promised Friday', tried: 2 })
  })

  it('counts only the caller’s own finished runs on the same answers', async () => {
    const { call, keys } = await seeded()
    const mine = await start(call)
    await play(call, mine, choicesOf(keys, 'blunder'))
    await reveal(call, mine)
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
    await reveal(call, runId)
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
