import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { checkScenario } from '../features/play/engine'
import type { ScenarioAnswers, ScenarioDraft, ScenarioRow } from '../features/play/types'
import { STARTERS } from '../seeds/starters'
import { fakeTools } from './fake-tools'
import {
  CALLS_PER_APP_PER_DAY,
  CALLS_PER_USER_PER_DAY,
  type Generated,
  makeGenerateActions,
  type ScenarioWriter,
  writeWith,
} from './generate'

const env = { OWNER_USER_ID: 'user_owner' } as Env
const SITUATION = 'Asking my manager for a raise after a strong quarter'

/** A well-formed model answer, built from a starter. */
function answer(overrides: Partial<Generated> = {}): Generated {
  const { id: _id, situation: _s, ...rest } = structuredClone(STARTERS[0])
  return { refuse: false, ...rest, ...overrides }
}

/** A writer that returns the given answers in order (an Error is thrown instead). */
function scripted(...answers: (unknown | Error)[]) {
  const prompts: string[] = []
  const writer = vi.fn<ScenarioWriter>(async (_env, req) => {
    prompts.push(req.prompt)
    const next = answers.shift()
    if (next instanceof Error) throw next
    return next
  })
  return { writer, prompts }
}

type Store = ReturnType<typeof fakeTools>['store']

function setup(writer: ScenarioWriter, toolsFor?: (userId: string, store: Store) => ActionTools) {
  const store: Store = new Map()
  const actions = makeGenerateActions(writer)
  const tools = (userId: string) => (toolsFor ? toolsFor(userId, store) : fakeTools(userId, store).tools)
  const call = async (userId: string, situation: unknown = SITUATION) =>
    (await actions.makeScenario({ userId, params: { situation }, tools: tools(userId), env, callerJwt: 'jwt' })) as ActionResult<{
      scenarioId: string
    }>
  const rows = (name: string) => [...(store.get(name)?.values() ?? [])].map((r) => r.data)
  return { store, call, rows }
}

const today = () => new Date().toISOString().slice(0, 10)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('makeScenario', () => {
  it('refuses a situation under 10 or over 400 characters without calling the writer', async () => {
    const { writer } = scripted()
    const { call, rows } = setup(writer)
    for (const text of ['too short', 'x'.repeat(401), 42, '   padded   ']) {
      const res = await call('user_a', text)
      expect(res.success).toBe(false)
    }
    expect(writer).not.toHaveBeenCalled()
    expect(rows('generations')).toEqual([])
  })

  it('saves a private scenario for the author, answers under the same id, and marks the call ok', async () => {
    const { writer } = scripted(answer())
    const { call, store, rows } = setup(writer)
    const res = await call('user_a', `  ${SITUATION}  `)
    expect(res.success).toBe(true)
    const id = res.success ? res.data.scenarioId : ''
    expect(id).toMatch(/^gen_/)

    const scenario = store.get('scenarios')!.get(id)!.data as unknown as ScenarioRow
    expect(scenario).toMatchObject({ visibility: 'private', starter: false, authorId: 'user_a', answersId: id })
    expect(scenario.situation).toBe(SITUATION)
    // The readable row holds option texts only, no kinds, deltas or reasons.
    expect(JSON.stringify(scenario)).not.toMatch(/"(kind|delta|why|outcome)"/)

    const answers = store.get('scenario_answers')!.get(id)!.data as unknown as ScenarioAnswers
    expect(answers.scenarioId).toBe(id)
    const rebuilt: ScenarioDraft = {
      title: scenario.title,
      situation: scenario.situation,
      setting: scenario.setting,
      meters: scenario.meters,
      scenes: scenario.scenes.map((s, i) => ({
        prompt: s.prompt,
        options: s.options.map((text, j) => ({ text, ...answers.effects[i][j] })),
      })),
      endings: answers.endings,
    }
    expect(checkScenario(rebuilt)).toEqual([])

    expect(rows('generations')).toEqual([{ userDay: `user_a_${today()}`, appDay: today(), ok: true }])
  })

  it('tunes numbers the writer got wrong instead of failing', async () => {
    const flat = answer()
    for (const scene of flat.scenes) for (const o of scene.options) o.delta = [0, 0, 0]
    const { writer } = scripted(flat)
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
  })

  it('retries once with the broken rules named, and counts both calls', async () => {
    const short = answer()
    short.scenes = short.scenes.slice(0, 4)
    const { writer, prompts } = scripted(short, answer())
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(prompts).toHaveLength(2)
    expect(prompts[0]).not.toMatch(/previous answer/)
    expect(prompts[1]).toMatch(/previous answer broke these rules/)
    expect(prompts[1]).toMatch(/scene/)
    expect(rows('generations').map((r) => r.ok)).toEqual([false, true])
  })

  it('refuses a signed-out or anonymous caller without calling the writer', async () => {
    const { writer } = scripted(answer())
    const { call, rows } = setup(writer)
    for (const userId of ['', 'anon-123']) expect((await call(userId)).success).toBe(false)
    expect(writer).not.toHaveBeenCalled()
    expect(rows('generations')).toEqual([])
  })

  it('retries when the model gave no usable structured answer (writer returned null)', async () => {
    const { writer } = scripted(null, answer())
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(writer).toHaveBeenCalledTimes(2)
    expect(rows('generations').map((r) => r.ok)).toEqual([false, true])
  })

  it('retries after an answer that does not match the format', async () => {
    const { writer } = scripted({ nonsense: true }, answer())
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
  })

  it('gives up after two unusable answers and saves nothing', async () => {
    const short = answer()
    short.scenes = short.scenes.slice(0, 2)
    const { writer } = scripted(short, short)
    const { call, rows } = setup(writer)
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringMatching(/could not make a playable scenario/) })
    expect(rows('scenarios')).toEqual([])
    expect(rows('scenario_answers')).toEqual([])
    expect(rows('generations')).toHaveLength(2)
  })

  it('refuses when the writer refuses, and saves nothing', async () => {
    const { writer } = scripted({ ...answer(), refuse: true })
    const { call, rows } = setup(writer)
    const res = await call('user_a')
    expect(res.success).toBe(false)
    expect(rows('scenarios')).toEqual([])
    expect(writer).toHaveBeenCalledTimes(1)
  })

  it('keeps the writer error out of the response and still counts the call', async () => {
    const { writer } = scripted(new Error('upstream 529 overloaded: secret-ish detail'))
    const { call, rows } = setup(writer)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call('user_a')
    expect(res.success).toBe(false)
    expect(JSON.stringify(res)).not.toMatch(/529|overloaded|secret/)
    // The log gets the error class only, never its message.
    const logged = spy.mock.calls.flat().join(' ')
    expect(logged).toMatch(/writer failed: Error/)
    expect(logged).not.toMatch(/529|overloaded|secret/)
    expect(rows('generations')).toEqual([{ userDay: `user_a_${today()}`, appDay: today(), ok: false }])
  })

  it(`allows ${CALLS_PER_USER_PER_DAY} calls per user per day, then refuses before calling the writer`, async () => {
    const { writer } = scripted(...Array.from({ length: CALLS_PER_USER_PER_DAY + 1 }, () => answer()))
    const { call, rows } = setup(writer)
    for (let i = 0; i < CALLS_PER_USER_PER_DAY; i++) expect((await call('user_a')).success).toBe(true)
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringContaining(`today's ${CALLS_PER_USER_PER_DAY} scenario writes`) })
    expect(writer).toHaveBeenCalledTimes(CALLS_PER_USER_PER_DAY)
    // The refused call left no row behind.
    expect(rows('generations')).toHaveLength(CALLS_PER_USER_PER_DAY)
    // Another user is not affected.
    expect((await call('user_b')).success).toBe(true)
  })

  it('lets at most the cap through when many calls from one user arrive at once', async () => {
    const n = CALLS_PER_USER_PER_DAY + 3
    const { writer } = scripted(...Array.from({ length: n }, () => answer()))
    const { call, rows } = setup(writer)
    const results = await Promise.all(Array.from({ length: n }, () => call('user_a')))
    const passed = results.filter((r) => r.success).length
    expect(passed).toBeLessThanOrEqual(CALLS_PER_USER_PER_DAY)
    expect(writer.mock.calls.length).toBeLessThanOrEqual(CALLS_PER_USER_PER_DAY)
    // Only calls that passed keep a row, so refusals did not use up the day.
    expect(rows('generations')).toHaveLength(passed)
    expect((await call('user_a')).success).toBe(passed < CALLS_PER_USER_PER_DAY)
  })

  it(`refuses everyone once the app has made ${CALLS_PER_APP_PER_DAY} calls today`, async () => {
    const { writer } = scripted(answer())
    const { call, store, rows } = setup(writer)
    const { tools } = fakeTools('user_x', store)
    for (let i = 0; i < CALLS_PER_APP_PER_DAY; i++) {
      await tools.create('generations', { userDay: `user_${i}_${today()}`, appDay: today(), ok: true })
    }
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringMatching(/as many scenarios as it can today/) })
    expect(writer).not.toHaveBeenCalled()
    expect(rows('generations')).toHaveLength(CALLS_PER_APP_PER_DAY)
  })

  it('refuses when the call count cannot be read', async () => {
    const { writer } = scripted(answer())
    const broken = (userId: string, store: Store) => {
      const { tools } = fakeTools(userId, store)
      return { ...tools, query: async () => ({ success: false, error: 'down' }) } as unknown as ActionTools
    }
    const { call, rows } = setup(writer, broken)
    expect((await call('user_a')).success).toBe(false)
    expect(writer).not.toHaveBeenCalled()
    expect(rows('generations')).toEqual([])
  })

  it('skips the retry when too little time is left for it', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const short = answer()
    short.scenes = short.scenes.slice(0, 4)
    const writer: ScenarioWriter = vi.fn(async () => {
      now += 55_000 // 75 s deadline - 5 s save reserve - 55 s leaves 15 s, under the 20 s minimum
      return short
    })
    const { call, rows } = setup(writer)
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringMatching(/could not make a playable scenario/) })
    expect(writer).toHaveBeenCalledTimes(1)
    expect(rows('generations')).toHaveLength(1)
  })

  it('gives the reservation back when reserving used up the time', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const { writer } = scripted(answer())
    const slow = (userId: string, store: Store) => {
      const { tools } = fakeTools(userId, store)
      const create = tools.create.bind(tools)
      return {
        ...tools,
        create: async (...args: Parameters<ActionTools['create']>) => {
          now += 60_000
          return create(...args)
        },
      } as unknown as ActionTools
    }
    const { call, rows } = setup(writer, slow)
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringMatching(/did not answer in time/) })
    expect(writer).not.toHaveBeenCalled()
    expect(rows('generations')).toEqual([])
  })
})

describe('writeWith', () => {
  const reply = (text: string) => ({
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    warnings: [],
  })
  const request = () => ({ system: 'system', prompt: 'prompt', abortSignal: AbortSignal.timeout(5_000) })

  it('returns the parsed answer when the model replies with matching JSON', async () => {
    const model = new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(answer())) })
    expect(await writeWith(model, request())).toMatchObject({ refuse: false, title: STARTERS[0].title })
  })

  it('returns null when the reply is not JSON, so the caller retries', async () => {
    const model = new MockLanguageModelV4({ doGenerate: reply('Sure! Here is your scenario: ...') })
    expect(await writeWith(model, request())).toBeNull()
  })

  it('returns null when the JSON does not match the schema', async () => {
    const model = new MockLanguageModelV4({ doGenerate: reply(JSON.stringify({ title: 'only a title' })) })
    expect(await writeWith(model, request())).toBeNull()
  })

  it('throws when the call itself fails', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('network down')
      },
    })
    await expect(writeWith(model, request())).rejects.toThrow('network down')
  })
})
