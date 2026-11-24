import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { checkScenario, LIMITS } from '../features/play/engine'
import { fixture, MIX } from '../features/play/fixture'
import type { ScenarioAnswers, ScenarioDraft, ScenarioRow } from '../features/play/types'
import { fakeTools } from './fake-tools'
import {
  applyFixes,
  ASK,
  CALLS_PER_APP_PER_DAY,
  CALLS_PER_USER_PER_DAY,
  FIX_SYSTEM_PROMPT,
  fixRequest,
  FLAG_ID,
  type Generated,
  makeGenerateActions,
  type ScenarioWriter,
  slotsToDraft,
  SYSTEM_PROMPT,
  wordCountNotes,
  writeWith,
} from './generate'

const env = { OWNER_USER_ID: 'user_owner' } as Env
const SITUATION = 'Asking my manager for a raise after a strong quarter'

/**
 * A well-formed model answer: the test fixture (features/play/fixture.ts) in
 * slot form, so it maps to the same grades, texts and flag positions.
 */
function answer(overrides: Partial<Generated> = {}): Generated {
  const way = (d: number, a: number, w: number) => ({
    text: `Option ${d}${a}${w} for this step`,
    outcome: `Outcome ${d}${a}${w}.`,
    why: `Reason ${d}${a}${w}.`,
  })
  const decisions = [0, 1, 2, 3].map((d) => ({
    prompt: `Decision ${d + 1}: what now?`,
    right: { text: `Approach ${d}0 plan`, best: way(d, 0, 0), slip: way(d, 0, 1), mistake: way(d, 0, 2) },
    second: { text: `Approach ${d}1 plan`, slip: way(d, 1, 0), mistake: way(d, 1, 1), blunder: way(d, 1, 2) },
    wrong: { text: `Approach ${d}2 plan`, mistake: way(d, 2, 0), blunder: way(d, 2, 1), worst: way(d, 2, 2) },
  }))
  return {
    refuse: false,
    title: 'Fixture',
    setting: 'A test setting.',
    decisions,
    flag: { label: 'You promised Friday', raisedAt: 1, hitsAt: 3, outcome: 'The promise comes due.', why: 'You promised earlier.' },
    endings: { good: 'Good.', ok: 'Ok.', bad: 'Bad.' },
    ...overrides,
  }
}

/** A writer that returns the given answers in order (an Error is thrown instead). */
function scripted(...answers: (unknown | Error)[]) {
  const prompts: string[] = []
  const kinds: string[] = []
  const writer = vi.fn<ScenarioWriter>(async (_env, req) => {
    prompts.push(req.prompt)
    kinds.push(req.kind)
    const next = answers.shift()
    if (next instanceof Error) throw next
    return next
  })
  return { writer, prompts, kinds }
}

/** The texts a length fix was asked to rewrite, parsed back out of its prompt. */
const fixItems = (prompt: string) =>
  JSON.parse(prompt.slice(prompt.indexOf('<texts>\n') + 8, prompt.indexOf('\n</texts>'))) as { id: string; now: number; target: number; text: string }[]

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
    expect(scenario).toMatchObject({ format: 2, visibility: 'private', starter: false, authorId: 'user_a', answersId: id })
    expect(scenario.situation).toBe(SITUATION)
    // The readable row holds texts only: no grades, reasons, outcomes or flags.
    expect(JSON.stringify(scenario)).not.toMatch(/"(grade|why|outcome|raises|ifRaised|wayKeys)"\s*:/)

    const answers = store.get('scenario_answers')!.get(id)!.data as unknown as ScenarioAnswers
    expect(answers).toMatchObject({ scenarioId: id, format: 2 })
    const rebuilt: ScenarioDraft = {
      title: scenario.title,
      situation: scenario.situation,
      setting: scenario.setting,
      decisions: scenario.decisions.map((d, i) => ({
        prompt: d.prompt,
        approaches: d.approaches.map((a, j) => ({ text: a.text, ways: a.ways.map((text, k) => ({ text, ...answers.wayKeys[i][j][k] })) })),
      })),
      flags: answers.flags,
      endings: answers.endings,
    }
    expect(checkScenario(rebuilt)).toEqual([])

    expect(rows('generations')).toEqual([{ userDay: `user_a_${today()}`, appDay: today(), ok: true }])
  })

  it('retries once with the broken rules named, and counts both calls', async () => {
    const short = answer()
    short.decisions = short.decisions.slice(0, 3)
    const { writer, prompts } = scripted(short, answer())
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(prompts).toHaveLength(2)
    expect(prompts[0]).not.toMatch(/previous answer/)
    // The retry sees its own previous answer, so it can fix it instead of starting over.
    expect(prompts[1]).toContain(`<previous>\n${JSON.stringify(short)}\n</previous>`)
    expect(prompts[1]).toMatch(/It broke these rules: needs exactly 4 decisions, not 3/)
    expect(rows('generations').map((r) => r.ok)).toEqual([false, true])
  })

  it('keeps the first four decisions of an answer with too many, without a retry', async () => {
    const long = answer()
    long.decisions = [...long.decisions, structuredClone(long.decisions[0])]
    const { writer } = scripted(long)
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(writer).toHaveBeenCalledTimes(1)
    expect((rows('scenarios')[0] as unknown as ScenarioRow).decisions).toHaveLength(4)
  })

  it('fixes over-long or uneven option texts with a short rewrite call, not a full retry', async () => {
    const long = answer()
    long.decisions[1].right.best.text = 'word '.repeat(30).trim()
    const fixed = 'Option 100 for this exact step'
    const { writer, prompts, kinds } = scripted(long, { texts: [{ id: 't1', text: fixed }] })
    const { call, store, rows } = setup(writer)
    const res = await call('user_a')
    expect(res.success).toBe(true)
    expect(kinds).toEqual(['scenario', 'lengths'])
    expect(writer.mock.calls[1][1].system).toBe(FIX_SYSTEM_PROMPT)
    // Only the uneven group goes out, with neutral ids: no slot names, so no grades.
    const items = fixItems(prompts[1])
    expect(items.map((i) => i.id)).toEqual(['t1', 't2', 't3'])
    expect(items.map((i) => i.text)).toEqual([long.decisions[1].right.best.text, 'Option 101 for this step', 'Option 102 for this step'])
    expect(items.map((i) => [i.now, i.target])).toEqual([[30, 11], [5, 11], [5, 11]])
    expect(prompts[1]).not.toMatch(/best|slip|mistake|blunder/)
    const id = res.success ? res.data.scenarioId : ''
    expect(JSON.stringify(store.get('scenarios')!.get(id)!.data)).toContain(fixed)
    expect(rows('generations').map((r) => r.ok)).toEqual([false, true])
  })

  it('falls back to a full retry with the word counts named when two length fixes do not work', async () => {
    const long = answer()
    long.decisions[1].right.best.text = 'word '.repeat(30).trim()
    const { writer, prompts, kinds } = scripted(long, null, { texts: [] }, answer())
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'lengths', 'lengths', 'scenario'])
    expect(prompts[3]).toMatch(/over the 120 limit/)
    expect(prompts[3]).toContain('decision 2 right ways: best 30, slip 5, mistake 5 words')
    expect(rows('generations')).toHaveLength(4)
  })

  it('does not use a length fix when another rule is also broken', async () => {
    const both = answer({ flag: { ...answer().flag, raisedAt: 3, hitsAt: 2 } })
    both.decisions[1].right.best.text = 'word '.repeat(30).trim()
    const { writer, kinds } = scripted(both, answer())
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'scenario'])
  })

  it('puts fixed texts back by id and ignores unknown ids and empty texts', () => {
    const g = answer()
    g.decisions[2].second.text = 'An approach text that is far too long for its two short siblings here'
    const { slots, prompt } = fixRequest(g)
    expect(fixItems(prompt).map((i) => i.text)).toEqual(['Approach 20 plan', g.decisions[2].second.text, 'Approach 22 plan'])
    const out = applyFixes(g, slots, { texts: [{ id: 't2', text: '  Shorter approach text  ' }, { id: 't9', text: 'nowhere' }, { id: 't1', text: ' ' }] })!
    expect(out.decisions[2].second.text).toBe('Shorter approach text')
    expect(out.decisions[2].right.text).toBe('Approach 20 plan')
    expect(g.decisions[2].second.text).toMatch(/far too long/) // the input is not changed
    expect(applyFixes(g, slots, { nonsense: true })).toBeNull()
    expect(fixRequest(answer()).slots).toEqual([])
  })

  it('sends only the texts that stand out, and keeps a rewrite only if it moves toward the target', () => {
    const g = answer()
    const ways = g.decisions[0].right
    ways.best.text = 'word '.repeat(27).trim()
    ways.slip.text = 'one two three four five six seven eight nine ten eleven twelve thirteen'
    ways.mistake.text = 'one two three four five six seven eight nine ten eleven twelve'
    const { slots, prompt } = fixRequest(g)
    // Target 13 (the middle count); the slip (13) and mistake (12) are within one word, so only the best goes out.
    expect(fixItems(prompt)).toEqual([{ id: 't1', now: 27, target: 13, text: ways.best.text }])
    const worse = applyFixes(g, slots, { texts: [{ id: 't1', text: 'word '.repeat(28).trim() }] })!
    expect(worse.decisions[0].right.best.text).toBe(ways.best.text)
    const nearer = applyFixes(g, slots, { texts: [{ id: 't1', text: 'word '.repeat(20).trim() }] })!
    expect(nearer.decisions[0].right.best.text).toBe('word '.repeat(20).trim())
  })

  it('lists only the approach and way groups outside the word ranges', () => {
    const g = answer()
    for (const d of g.decisions) {
      for (const key of ['right', 'second', 'wrong'] as const) {
        d[key].text = 'seven words in this approach text here'
        for (const w of Object.values(d[key]).filter((v) => typeof v === 'object')) (w as { text: string }).text = 'ten words in this way text that is fine here'
      }
    }
    expect(wordCountNotes(g)).toEqual([])
    g.decisions[0].wrong.text = 'too short'
    g.decisions[3].second.blunder.text = 'one two three four five six seven eight nine ten eleven twelve thirteen'
    expect(wordCountNotes(g)).toEqual([
      'decision 1 approach texts: right 7, second 7, wrong 2 words',
      'decision 4 second ways: slip 10, mistake 10, blunder 13 words',
    ])
  })

  it('retries when the flag points at decisions that cannot hold it', async () => {
    const backwards = answer({ flag: { ...answer().flag, raisedAt: 3, hitsAt: 2 } })
    const { writer, prompts } = scripted(backwards, answer())
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(prompts[1]).toMatch(/flag.hitsAt must be a later decision/)
  })

  it('retries when the text gives the answer away', async () => {
    const tell = answer()
    tell.decisions[1].right.best.text = 'Calmly do 100 for this step'
    const { writer, prompts } = scripted(tell, answer())
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(prompts[1]).toMatch(/only the best way uses a sounds-right word/)
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

  it('gives up after three unusable answers and saves nothing', async () => {
    const short = answer()
    short.decisions = short.decisions.slice(0, 2)
    const { writer } = scripted(short, short, short)
    const { call, rows } = setup(writer)
    const res = await call('user_a')
    expect(res).toEqual({ success: false, error: expect.stringMatching(/could not make a playable scenario/) })
    expect(rows('scenarios')).toEqual([])
    expect(rows('scenario_answers')).toEqual([])
    expect(rows('generations')).toHaveLength(3)
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
    expect(res).toEqual({ success: false, error: expect.stringContaining(`today's ${CALLS_PER_USER_PER_DAY} AI calls`) })
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
    short.decisions = short.decisions.slice(0, 3)
    const writer: ScenarioWriter = vi.fn(async () => {
      now += 70_000 // 95 s deadline - 5 s save reserve - 70 s leaves 20 s, under the 25 s minimum
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
          now += 70_000 // leaves 20 s of the 90 s before the save reserve, under the 25 s minimum
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
  const request = (kind: 'scenario' | 'lengths' = 'scenario') => ({ kind, system: 'system', prompt: 'prompt', abortSignal: AbortSignal.timeout(5_000) })

  it('returns the parsed answer when the model replies with matching JSON', async () => {
    const model = new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(answer())) })
    expect(await writeWith(model, request())).toMatchObject({ refuse: false, title: 'Fixture' })
  })

  it('parses a length fix against its own schema, not the scenario schema', async () => {
    const texts = { texts: [{ id: 't1', text: 'A rewritten option' }] }
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(texts)) }), request('lengths'))).toEqual(texts)
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(answer())) }), request('lengths'))).toBeNull()
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

describe('slotsToDraft', () => {
  it('gives each slot its grade and places the flag, matching the test fixture', () => {
    const draft = slotsToDraft(answer(), 'A test situation.')
    for (const d of draft.decisions) expect(d.approaches.map((a) => a.ways.map((w) => w.grade))).toEqual(MIX)
    const expected = fixture()
    delete expected.id
    expected.flags = [{ id: FLAG_ID, label: 'You promised Friday' }]
    expected.decisions[0].approaches[1].ways[0].raises = [FLAG_ID]
    expected.decisions[2].approaches[0].ways[1].ifRaised!.flag = FLAG_ID
    expect(draft).toEqual(expected)
    expect(checkScenario(draft)).toEqual([])
  })
})

describe('SYSTEM_PROMPT', () => {
  it('asks for lengths within the limits the checker enforces', () => {
    for (const [field, asked] of Object.entries(ASK)) expect(asked).toBeLessThan(LIMITS[field as keyof typeof LIMITS])
    expect(SYSTEM_PROMPT).toMatch(/Never use these words: carefully/)
  })
})
