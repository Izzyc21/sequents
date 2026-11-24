import { describe, expect, it, vi } from 'vitest'
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
  const writer: ScenarioWriter = vi.fn(async (_env, req) => {
    prompts.push(req.prompt)
    const next = answers.shift()
    if (next instanceof Error) throw next
    return next
  })
  return { writer, prompts }
}

function setup(writer: ScenarioWriter, toolsFor?: (userId: string) => ActionTools) {
  const store: ReturnType<typeof fakeTools>['store'] = new Map()
  const actions = makeGenerateActions(writer)
  const tools = (userId: string) => (toolsFor ? toolsFor(userId) : fakeTools(userId, store).tools)
  const call = async (userId: string, situation: unknown = SITUATION) =>
    (await actions.makeScenario({ userId, params: { situation }, tools: tools(userId), env, callerJwt: 'jwt' })) as ActionResult<{
      scenarioId: string
    }>
  const rows = (name: string) => [...(store.get(name)?.values() ?? [])].map((r) => r.data)
  return { store, call, rows }
}

const today = () => new Date().toISOString().slice(0, 10)

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
    spy.mockRestore()
    expect(res.success).toBe(false)
    expect(JSON.stringify(res)).not.toMatch(/529|overloaded|secret/)
    expect(rows('generations')).toEqual([{ userDay: `user_a_${today()}`, appDay: today(), ok: false }])
  })

  it(`allows ${CALLS_PER_USER_PER_DAY} calls per user per day, then refuses before calling the writer`, async () => {
    const { writer } = scripted(...Array.from({ length: CALLS_PER_USER_PER_DAY + 1 }, () => answer()))
    const { call } = setup(writer)
    for (let i = 0; i < CALLS_PER_USER_PER_DAY; i++) expect((await call('user_a')).success).toBe(true)
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringMatching(/today's 5 scenario writes/) })
    expect(writer).toHaveBeenCalledTimes(CALLS_PER_USER_PER_DAY)
    // Another user is not affected.
    expect((await call('user_b')).success).toBe(true)
  })

  it(`refuses everyone once the app has made ${CALLS_PER_APP_PER_DAY} calls today`, async () => {
    const { writer } = scripted(answer())
    const { call, store } = setup(writer)
    const { tools } = fakeTools('user_x', store)
    for (let i = 0; i < CALLS_PER_APP_PER_DAY; i++) {
      await tools.create('generations', { userDay: `user_${i}_${today()}`, appDay: today(), ok: true })
    }
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringMatching(/as many scenarios as it can today/) })
    expect(writer).not.toHaveBeenCalled()
  })

  it('refuses when the call count cannot be read', async () => {
    const { writer } = scripted(answer())
    const broken = (userId: string) => {
      const { tools } = fakeTools(userId)
      return { ...tools, query: async () => ({ success: false, error: 'down' }) } as unknown as ActionTools
    }
    const { call } = setup(writer, broken)
    expect((await call('user_a')).success).toBe(false)
    expect(writer).not.toHaveBeenCalled()
  })
})
