import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { checkScenario, LIMITS, longestBestCount, MAX_LONGEST_BEST, repairDraft } from '../features/play/engine'
import { fixture, MIX } from '../features/play/fixture'
import type { ScenarioAnswers, ScenarioDraft, ScenarioRow } from '../features/play/types'
import { fakeTools } from './fake-tools'
import {
  applyFixes,
  applyWhys,
  ASK,
  CUES_SYSTEM_PROMPT,
  cuedSlots,
  beatsMix,
  CALLS_PER_APP_PER_DAY,
  CALLS_PER_USER_PER_DAY,
  FIX_SYSTEM_PROMPT,
  fixRequest,
  fitHiddenTexts,
  FLAG_ID,
  type Generated,
  isCueProblem,
  isFixableProblem,
  isLengthProblem,
  keepsDetails,
  makeGenerateActions,
  pickVersions,
  type ScenarioWriter,
  MIN_TRIMMED,
  TRIM_KEEP_SHARE,
  slotFeedback,
  slotsToDraft,
  SYSTEM_PROMPT,
  trimToSentence,
  VERSIONS_SYSTEM_PROMPT,
  WHYS_SYSTEM_PROMPT,
  wordCountNotes,
  type WriteRequest,
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

/** checkScenario's problem for a best way that is the longest of its approach in every decision, as in longestWins. */
const LONGEST_BEST_ALL = 'the best way is the longest of its approach in 4 of 4 decisions, more than 2'

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

/**
 * The fixture answer with the right approach and the best way written longest
 * in every decision, so "always the longest" finds the best line every time.
 */
function longestWins(): Generated {
  const g = answer()
  for (const d of g.decisions) {
    d.right.text = 'Approach plan with a few more words'
    d.right.best.text = 'Option for this step with a few more words'
  }
  return g
}

/** A length fix's reply that rewrites every text to exactly its target word count, in its own words (toCount). */
const exactFix = (prompt: string) => ({ texts: fixItems(prompt).map((i) => ({ id: i.id, text: toCount(i.text, i.target) })) })

/** The texts a length fix was asked to rewrite, parsed back out of its prompt. */
const fixItems = (prompt: string) =>
  JSON.parse(prompt.slice(prompt.indexOf('<texts>\n') + 8, prompt.indexOf('\n</texts>'))) as { id: string; now: number; target: number; text: string }[]

/** The length fix for `g`, which must be a rewrite. */
function rewrite(g: Generated, problems: string[] = []) {
  const fix = fixRequest(g, problems)
  if (fix?.kind !== 'lengths') throw new Error(`expected a rewrite, got ${fix?.kind ?? 'none'}`)
  return fix
}

/** The length fix for `g`, which must be a versions call. */
function versionsCall(g: Generated, problems: string[]) {
  const fix = fixRequest(g, problems)
  if (fix?.kind !== 'versions') throw new Error(`expected a versions call, got ${fix?.kind ?? 'none'}`)
  return fix
}

/** The texts a versions call asks about, parsed back out of its prompt. */
const versionItems = (prompt: string) =>
  JSON.parse(prompt.slice(prompt.indexOf('<texts>\n') + 8, prompt.indexOf('\n</texts>'))) as {
    id: string
    text: string
    short: number
    medium: number
    long: number
  }[]

/** A word a version must keep once, as keepsDetails checks: a number (in digits or words), a name (capitalised after the first word), a no or another turn word. */
const isDetail = (word: string, i: number) =>
  /\d/.test(word) ||
  /^(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|thousand|million|dozen|half|twice|double|triple)$/i.test(word) || (i > 0 && /^[A-Z]/.test(word)) || /n't$/i.test(word) ||
  /^(not|no|never|without|nothing|nobody|none|neither|nor|cannot|unable|before|after|until|unless|if|only|instead|except|avoid|avoids|avoiding|refuse|refuses|refusing|stop|stops|stopping|deny|denies|denying|fail|fails|failing)$/i.test(word)

/**
 * A versions reply in each text's own words: every version is the text with
 * its plain words dropped from the end, or repeated, until it has the asked
 * count; its numbers, names and noes stay, once each. So it keeps the text's
 * details and characters per word, the way a real rewrite roughly does.
 * `add` is appended to every version.
 */
const ownVersions = (prompt: string, add = '') => ({
  texts: versionItems(prompt).map((i) => ({ id: i.id, short: toCount(i.text, i.short) + add, medium: toCount(i.text, i.medium) + add, long: toCount(i.text, i.long) + add })),
})

/** `text` at `n` words: its plain words dropped from the end, or repeated; its first word, numbers, names and turn words stay, once each. */
function toCount(text: string, n: number): string {
  const w = text.split(' ')
  const plain = w.filter((x, k) => !isDetail(x, k)).map((x) => x.toLowerCase())
  const out = [...w]
  for (let k = 0; out.length < n; k++) out.push(plain[k % plain.length] ?? 'word')
  for (let k = out.length - 1; out.length > n && k > 0; k--) if (!isDetail(out[k], k)) out.splice(k, 1)
  return out.join(' ')
}

/** longestWins with shorter words in the other approaches: by words the right approach is shortest, by characters (what the rules compare) longest. */
function longestByCharacters(): Generated {
  const g = longestWins()
  for (const d of g.decisions) {
    d.second.text = 'Ask him for a raise on the spot'
    d.wrong.text = 'Wait for him to bring it up first'
  }
  return g
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
    const fixed = 'word for this one exact step'
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

  it('falls back to a full retry with the word counts named when two rewrites and two versions calls do not work', async () => {
    const long = answer()
    long.decisions[1].right.best.text = 'word '.repeat(30).trim()
    const { writer, prompts, kinds } = scripted(long, null, { texts: [] }, { texts: [] }, null, answer())
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'lengths', 'lengths', 'versions', 'versions', 'scenario'])
    expect(prompts[5]).toMatch(/over the 120 limit/)
    expect(prompts[5]).toContain('decision 2 right ways: best 30, slip 5, mistake 5 words')
    expect(rows('generations')).toHaveLength(6)
  })

  it('sends an uneven group to a versions call, with the lead groups, once the rewrites are used up', () => {
    const g = answer()
    g.decisions[1].second.slip.text = 'word '.repeat(20).trim()
    expect(fixRequest(g, [], { rewrites: true })?.kind).toBe('lengths')
    const fix = fixRequest(g, [], { rewrites: false })
    if (fix?.kind !== 'versions') throw new Error(`expected a versions call, got ${fix?.kind ?? 'none'}`)
    expect(fix.groups[0].label).toBe('decision 2 second ways')
    expect(fix.groups.slice(1).every((group) => group.leads)).toBe(true)
    expect(fix.groups).toHaveLength(9) // the uneven group and the 8 lead groups
    const items = versionItems(fix.prompt)
    expect(items.slice(0, 3).map((i) => i.text)).toEqual([g.decisions[1].second.slip.text, 'Option 111 for this step', 'Option 112 for this step'])
    expect(items[0]).toMatchObject({ short: 10, long: 14, maxCharacters: LIMITS.way })
  })

  it('offers an uneven lead group once, with the other lead groups', () => {
    const g = answer()
    g.decisions[0].right.slip.text = 'word '.repeat(20).trim()
    const fix = fixRequest(g, [], { rewrites: false })
    if (fix?.kind !== 'versions') throw new Error(`expected a versions call, got ${fix?.kind ?? 'none'}`)
    const labels = fix.groups.map((group) => group.label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(fix.groups).toHaveLength(8) // the 8 lead groups, the uneven one first
    expect(labels[0]).toBe('decision 1 right ways')
  })

  it('evens a group with a versions call when both rewrites leave it uneven, as in the failed real run', async () => {
    const g = answer()
    g.decisions[1].second.slip.text = 'word '.repeat(20).trim()
    const unchanged = { texts: [{ id: 't1', text: g.decisions[1].second.slip.text }] }
    const fix = fixRequest(g, [], { rewrites: false })!
    const { writer, kinds } = scripted(g, unchanged, unchanged, ownVersions(fix.prompt))
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'lengths', 'lengths', 'versions'])
    expect(rows('generations').map((r) => r.ok)).toEqual([false, false, false, true])
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
    g.decisions[2].second.text = 'An approach text that is far too long for its short sibling texts here'
    const { slots, prompt } = rewrite(g)
    expect(fixItems(prompt).map((i) => i.text)).toEqual(['Approach 20 plan', g.decisions[2].second.text, 'Approach 22 plan'])
    const out = applyFixes(g, slots, { texts: [{ id: 't2', text: '  Approach text that is shorter  ' }, { id: 't9', text: 'nowhere' }, { id: 't1', text: ' ' }] })!
    expect(out.decisions[2].second.text).toBe('Approach text that is shorter')
    expect(out.decisions[2].right.text).toBe('Approach 20 plan')
    expect(g.decisions[2].second.text).toMatch(/far too long/) // the input is not changed
    expect(applyFixes(g, slots, { nonsense: true })).toBeNull()
    expect(fixRequest(answer())).toBeNull()
  })

  it('sends only the texts that stand out, and keeps a rewrite only if it moves toward the target', () => {
    const g = answer()
    const ways = g.decisions[0].right
    ways.best.text = 'word '.repeat(27).trim()
    ways.slip.text = 'one two three four five six seven eight nine ten eleven twelve thirteen'
    ways.mistake.text = 'one two three four five six seven eight nine ten eleven twelve'
    const { slots, prompt } = rewrite(g)
    // Target 13 (the middle count); the slip (13) and mistake (12) are within one word, so only the best goes out.
    expect(fixItems(prompt)).toEqual([{ id: 't1', now: 27, target: 13, text: ways.best.text }])
    const worse = applyFixes(g, slots, { texts: [{ id: 't1', text: 'word '.repeat(28).trim() }] })!
    expect(worse.decisions[0].right.best.text).toBe(ways.best.text)
    const nearer = applyFixes(g, slots, { texts: [{ id: 't1', text: 'word '.repeat(20).trim() }] })!
    expect(nearer.decisions[0].right.best.text).toBe('word '.repeat(20).trim())
  })

  it('never puts back two rewrites in one answer that end up the same text', () => {
    const g = answer()
    const ways = g.decisions[0].right
    ways.slip.text = 'You yell at the team about the late report today'
    ways.mistake.text = 'You yell at the manager about the late report now'
    const slots = [
      { d: 0, approach: 'right' as const, way: 'slip', target: 10 },
      { d: 0, approach: 'right' as const, way: 'mistake', target: 10 },
    ]
    const same = 'You speak firmly to the team about the late report'
    const out = applyFixes(g, slots, { texts: [{ id: 't1', text: same }, { id: 't2', text: `${same}!` }] }, { lead: false, slack: 2 })!
    expect(out.decisions[0].right.slip.text).toBe(same)
    expect(out.decisions[0].right.mistake.text).toBe(ways.mistake.text)
  })

  it('never puts back a fixed way text that a sibling way\'s why would copy, as in a real run', () => {
    const g = answer()
    const ways = g.decisions[0].right
    ways.best.text = 'word '.repeat(27).trim()
    ways.slip.text = 'one two three four five six seven eight nine ten eleven twelve thirteen'
    ways.mistake.text = 'one two three four five six seven eight nine ten eleven twelve'
    ways.slip.why = 'Because the zulu yankee xray whiskey victor step was skipped.'
    const { slots } = rewrite(g)
    const copied = 'word zulu yankee xray whiskey victor then some more words to fill it'
    expect(applyFixes(g, slots, { texts: [{ id: 't1', text: copied }] })!.decisions[0].right.best.text).toBe(ways.best.text)
    const own = 'word bravo charlie delta echo and then some more words to fill it'
    expect(applyFixes(g, slots, { texts: [{ id: 't1', text: own }] })!.decisions[0].right.best.text).toBe(own)

    // In a versions pick, a way version a sibling's why would copy is never used.
    const lw = longestWins()
    for (const d of lw.decisions) for (const w of ['best', 'slip', 'mistake'] as const) d.right[w].why = 'Because the zulu yankee xray whiskey victor step was skipped.'
    const problems = checkScenario(repairDraft(slotsToDraft(lw, SITUATION)))
    expect(problems).toEqual([expect.stringMatching(/^picking always the longest averages /), LONGEST_BEST_ALL])
    const fix = versionsCall(lw, problems)
    // Control: a neutral suffix of the same length (32 characters) leaves the way versions usable, and the pick uses some.
    const control = pickVersions(lw, fix.groups, ownVersions(fix.prompt, ' alpha bravo charlie delta hotel'))
    expect(control).not.toBeNull()
    const rightWays = (x: Generated) => x.decisions.flatMap((dec) => (['best', 'slip', 'mistake'] as const).map((w) => dec.right[w].text))
    expect(rightWays(control!)).not.toEqual(rightWays(lw))
    expect(checkScenario(repairDraft(slotsToDraft(control!, SITUATION)))).toEqual([])
    // With the copied suffix, no right-way version is used.
    // The approach groups alone cannot fix it (the best way stays the longest in all 4 decisions), so with
    // the same lengths as the control, no mix passes: the guard is what stops it.
    expect(pickVersions(lw, fix.groups, ownVersions(fix.prompt, ' zulu yankee xray whiskey victor'))).toBeNull()
  })

  it('sends a why that copies a sibling way\'s text out to be reworded, and keeps only a reword that copies nothing', () => {
    const g = answer()
    // Repeats "Option 101 for this step", the text of a sibling way (5 words in a row).
    g.decisions[1].right.mistake.why = 'You chose Option 101 for this step too late.'
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    expect(problems).toEqual(["decision 2 approach 1 way 3: its why copies a sibling way's text"])
    expect(isFixableProblem(problems[0])).toBe(true)
    expect(isLengthProblem(problems[0])).toBe(false)
    const fix = fixRequest(g, problems)
    if (fix?.kind !== 'whys') throw new Error(`expected a reword, got ${fix?.kind ?? 'none'}`)
    expect(fix.slots).toEqual([{ d: 1, approach: 'right', way: 'mistake' }])
    const items = JSON.parse(fix.prompt.slice(fix.prompt.indexOf('<reasons>\n') + 10, fix.prompt.indexOf('\n</reasons>')))
    expect(items).toEqual([{ id: 't1', explains: g.decisions[1].right.mistake.text, reason: g.decisions[1].right.mistake.why, copies: 'option 101 for this step', avoid: ['Option 100 for this step', 'Option 101 for this step'] }])
    expect(fix.prompt).toMatch(/"copies" shows the words it repeats now/)
    expect(fix.prompt).toMatch(/Keep what it says about the text it explains: the same cause, any "not"/)
    expect(fix.prompt.slice(0, fix.prompt.indexOf('<reasons>'))).not.toMatch(/best|slip|mistake|blunder/)
    // With the reword used up, the copied why does not block a length fix of the same answer.
    expect(fixRequest(g, problems, { rewords: false })).toBeNull()
    const uneven = answer()
    uneven.decisions[1].right.mistake.why = g.decisions[1].right.mistake.why
    uneven.decisions[1].second.slip.text = 'word '.repeat(20).trim()
    expect(fixRequest(uneven, [], { rewords: true })?.kind).toBe('whys')
    expect(fixRequest(uneven, [], { rewords: false })?.kind).toBe('lengths')

    const why = (out: Generated | null) => out!.decisions[1].right.mistake.why
    expect(why(applyWhys(g, fix.slots, { texts: [{ id: 't1', text: 'It was Option 101 for this step again.' }] }))).toBe(g.decisions[1].right.mistake.why)
    expect(why(applyWhys(g, fix.slots, { texts: [{ id: 't1', text: 'x'.repeat(LIMITS.why + 1) }] }))).toBe(g.decisions[1].right.mistake.why)
    const good = applyWhys(g, fix.slots, { texts: [{ id: 't1', text: '  You moved too late to matter.  ' }, { id: 't7', text: 'nowhere' }] })
    expect(why(good)).toBe('You moved too late to matter.')
    expect(checkScenario(repairDraft(slotsToDraft(good!, SITUATION)))).toEqual([])
    expect(applyWhys(g, fix.slots, { nonsense: true })).toBeNull()
    expect(g.decisions[1].right.mistake.why).toMatch(/Option 101/) // the input is not changed
  })

  it('repairs a copied why with a reword call, not a full retry, as in a real run', async () => {
    const g = answer()
    g.decisions[1].right.mistake.why = 'You chose Option 101 for this step too late.'
    const { writer, kinds } = scripted(g, { texts: [{ id: 't1', text: 'You moved too late to matter.' }] })
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'whys'])
    expect(writer.mock.calls[1][1].system).toBe(WHYS_SYSTEM_PROMPT)
    expect(rows('generations').map((r) => r.ok)).toEqual([false, true])
  })

  it('tries a second reword before a full retry, as the live runs needed', async () => {
    const g = answer()
    g.decisions[1].right.mistake.why = 'You chose Option 101 for this step too late.'
    const { writer, kinds } = scripted(g, { texts: [{ id: 't1', text: 'Again Option 101 for this step.' }] }, { texts: [{ id: 't1', text: 'You moved too late to matter.' }] })
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'whys', 'whys'])
  })

  it('falls back to a full retry when both reword calls fail to fix the why', async () => {
    const g = answer()
    g.decisions[1].right.mistake.why = 'You chose Option 101 for this step too late.'
    const bad = { texts: [{ id: 't1', text: 'Again Option 101 for this step.' }] }
    const { writer, kinds } = scripted(g, bad, bad, answer())
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'whys', 'whys', 'scenario'])
  })

  it('sends a text with a flagged word out for a neutral rewrite, and keeps only a rewrite without it', () => {
    const g = answer()
    g.decisions[2].wrong.blunder.text = 'Demand 221 for this step'
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    expect(problems).toEqual(['decision 3 approach 3 way 2: uses a word that marks it as a poor choice ("demand")'])
    expect(isCueProblem(problems[0])).toBe(true)
    expect(isFixableProblem(problems[0])).toBe(true)
    expect(isLengthProblem(problems[0])).toBe(false)
    expect(cuedSlots(g)).toEqual([{ d: 2, approach: 'wrong', way: 'blunder' }])
    const fix = fixRequest(g, problems)
    if (fix?.kind !== 'cues') throw new Error(`expected a neutral rewrite, got ${fix?.kind ?? 'none'}`)
    expect(fix.slots).toEqual([{ d: 2, approach: 'wrong', way: 'blunder', target: 5 }])
    const items = JSON.parse(fix.prompt.slice(fix.prompt.indexOf('<texts>\n') + 8, fix.prompt.indexOf('\n</texts>')))
    expect(items).toEqual([{ id: 't1', text: 'Demand 221 for this step', word: 'demand', words: 5 }])
    // Neutral ids and no grade names, so the call cannot tell which option is which.
    expect(fix.prompt.slice(0, fix.prompt.indexOf('<texts>'))).not.toMatch(/best|slip|mistake|blunder|worst/)
    expect(CUES_SYSTEM_PROMPT).not.toMatch(/best|slip|mistake|blunder|worst/)
    expect(CUES_SYSTEM_PROMPT).toMatch(/a poor choice stays the same choice, only said neutrally/)

    const text = (out: Generated | null) => out!.decisions[2].wrong.blunder.text
    const apply = (t: string) => text(applyFixes(g, fix.slots, { texts: [{ id: 't1', text: t }] }, { lead: false, slack: 2 }))
    expect(apply('Demand 221 at this step, firmly')).toBe('Demand 221 for this step') // keeps the word
    expect(apply('Yell for 221 at this step')).toBe('Demand 221 for this step') // swaps in another flagged word
    expect(apply('Press for 222 at this step')).toBe('Demand 221 for this step') // changes the number
    expect(apply('Calmly press for 221 here')).toBe('Demand 221 for this step') // adds a sounds-right word
    expect(apply('Press hard and keep pressing for 221 at every single step')).toBe('Demand 221 for this step') // too long
    const good = applyFixes(g, fix.slots, { texts: [{ id: 't1', text: ' Press for 221 at this step ' }] }, { lead: false, slack: 2 })
    expect(text(good)).toBe('Press for 221 at this step')
    expect(checkScenario(repairDraft(slotsToDraft(good!, SITUATION)))).toEqual([])
    expect(g.decisions[2].wrong.blunder.text).toBe('Demand 221 for this step') // the input is not changed
  })

  it('spends no other fix call on an answer whose flagged word only a neutral rewrite can clear', () => {
    const g = answer()
    g.decisions[2].wrong.blunder.text = 'Demand 221 for this step'
    g.decisions[1].second.slip.text = 'word '.repeat(20).trim()
    expect(fixRequest(g, [])?.kind).toBe('cues')
    // With the neutral rewrite used up, the uneven group gets no rewrite first: a full retry is next.
    expect(fixRequest(g, [], { cues: false })).toBeNull()
    // A flagged word the checker named but no text shows gets no fix either.
    expect(fixRequest(answer(), ['decision 1 approach 1: uses a word that marks it as a poor choice ("lie")'])).toBeNull()
    // A demand letter is a formal step, not a flagged word.
    const letter = answer()
    letter.decisions[2].wrong.blunder.text = 'Send a demand letter about 221'
    expect(cuedSlots(letter)).toEqual([])
  })

  it('repairs a flagged word with one neutral rewrite, not a full retry, as the failed live run needed', async () => {
    const g = answer()
    g.decisions[2].wrong.blunder.text = 'Demand 221 for this step'
    const { writer, kinds } = scripted(g, { texts: [{ id: 't1', text: 'Press for 221 at this step' }] })
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'cues'])
    expect(writer.mock.calls[1][1].system).toBe(CUES_SYSTEM_PROMPT)
    expect(rows('generations').map((r) => r.ok)).toEqual([false, true])
  })

  it('falls back to a full retry when the neutral rewrite keeps the flagged word', async () => {
    const g = answer()
    g.decisions[2].wrong.blunder.text = 'Demand 221 for this step'
    const { writer, kinds, prompts } = scripted(g, { texts: [{ id: 't1', text: 'Demand 221 at this step' }] }, answer())
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'cues', 'scenario'])
    expect(prompts[2]).toMatch(/uses a word that marks it as a poor choice/)
  })

  it('cuts an over-long hidden text after its last whole sentence that fits', () => {
    const first = 'You asked before the deadline, so the landlord had time to act. '.repeat(3).trim() // 191 characters
    const text = `${first} Dr. Lee then signed it and the repair was booked for the next morning, which ended the matter.`
    expect(text.length).toBeGreaterThan(LIMITS.why)
    expect(trimToSentence(text, LIMITS.why)).toBe(first) // never cuts after "Dr."
    expect(trimToSentence(`  ${first}  `, LIMITS.why)).toBe(first) // already fits: only trimmed
    // No sentence ending leaves MIN_TRIMMED characters: left as it is, so the length check still refuses it.
    const stub = `Too short. ${'and then it went on '.repeat(12)}`.trim()
    expect('Too short.'.length).toBeLessThan(MIN_TRIMMED)
    expect(trimToSentence(stub, LIMITS.why)).toBe(stub)
    expect(trimToSentence('x'.repeat(300), LIMITS.why)).toBe('x'.repeat(300))
  })

  it('never cuts away most of a text, inside a quoted question, or after initials', () => {
    // The only cut that fits keeps less than TRIM_KEEP_SHARE of the text: left whole, so a retry rewrites it.
    const most = `You asked the landlord in writing before the deadline, which put the request on record for later. The rest of it ${'keeps going on and on '.repeat(7)}to the end.`
    expect(most.length).toBeGreaterThan(LIMITS.why)
    expect(trimToSentence(most, LIMITS.why)).toBe(most)
    // "?" inside a quote followed by a lowercase word does not end the sentence.
    const quoted = `${'You told the manager about the shift change early on. '.repeat(2).trim()} You asked "Can we wait?" and then explained the deadline to the whole team clearly. It went fine, and the team agreed to the new plan the same day.`
    expect(quoted.length).toBeGreaterThan(LIMITS.why)
    expect(trimToSentence(quoted, LIMITS.why)).toMatch(/clearly\.$/)
    // A "?" inside a quotation never ends the sentence, with or without the closing quote after it.
    const lead = 'You told the manager about the shift change early on. '.repeat(3).trim()
    const inside = `${lead} You wrote "Can we wait? We need the signed approval first." and then sent that same message to the whole team before the meeting.`
    expect(inside.length).toBeGreaterThan(LIMITS.why)
    expect(trimToSentence(inside, LIMITS.why)).toBe(inside)
    const attributed = `${lead} “Can we wait?” Alex asked, and then the team sent the same message to the client before the meeting.`
    expect(attributed.length).toBeGreaterThan(LIMITS.why)
    expect(trimToSentence(attributed, LIMITS.why)).toBe(lead)
    // "U.S." does not end a sentence.
    const initials = `${'You filed the claim with the right office on time. '.repeat(3).trim()} You wrote to the U.S. Postal Service office and kept the receipt for later.`
    expect(initials.length).toBeGreaterThan(LIMITS.why)
    expect(trimToSentence(initials, LIMITS.why)).toMatch(/on time\.$/)
    expect(TRIM_KEEP_SHARE).toBeGreaterThan(0.5)
  })

  it('cuts only hidden texts, counts the cuts and leaves its input alone', () => {
    const g = answer()
    const long = `${'The repair crew came on time and fixed it. '.repeat(5).trim()} The rest of the week was quiet.`
    g.decisions[2].right.slip.outcome = long
    g.flag.why = long
    g.decisions[0].right.best.text = 'x'.repeat(LIMITS.way + 5) // a choice text is never cut
    const { answer: out, trimmed } = fitHiddenTexts(g)
    expect(trimmed).toBe(2)
    expect(out.decisions[2].right.slip.outcome.length).toBeLessThanOrEqual(LIMITS.outcome)
    expect(out.decisions[2].right.slip.outcome).toMatch(/fixed it\.$/)
    expect(out.flag.why.length).toBeLessThanOrEqual(LIMITS.why)
    expect(out.decisions[0].right.best.text).toBe(g.decisions[0].right.best.text)
    expect(g.flag.why).toBe(long)
  })

  it('saves an answer whose hidden texts run a little over, with no retry', async () => {
    const g = answer()
    g.decisions[3].right.slip.why = `${'You waited for the reply before you acted on it. '.repeat(4).trim()} Then the deposit came back in full.`
    g.flag.outcome = g.decisions[3].right.slip.why
    const { writer, kinds } = scripted(g)
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario'])
  })

  it('names problems in the retry by the answer\'s own field names, not positions', async () => {
    expect(slotFeedback('decision 4 approach 1 way 2 flag reaction outcome is 231 characters, over the 220 limit')).toBe('decision 4 flag.outcome is 231 characters, over the 220 limit')
    expect(slotFeedback('decision 2 approach 3 way 1 why is 230 characters, over the 220 limit')).toBe('decision 2 wrong.mistake why is 230 characters, over the 220 limit')
    expect(slotFeedback('decision 1 approach 2: way texts differ too much in length')).toBe('decision 1 second: way texts differ too much in length')
    expect(slotFeedback('decision 3: approach 1 and approach 3 have the same text')).toBe('decision 3: right and wrong have the same text')
    expect(slotFeedback('picking always the longest averages 90, more than 10 above random (50)')).toBe('picking always the longest averages 90, more than 10 above random (50)')

    const g = answer()
    g.decisions[0].second.mistake.text = g.decisions[0].right.best.text
    const { writer, prompts, kinds } = scripted(g, answer())
    const { call } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'scenario'])
    expect(prompts[1]).toMatch(/decision 1: right\.best and second\.mistake have the same text/)
  })

  it('treats the best option being findable by length as a length problem, and asks for three versions of every lead-group text', () => {
    const g = longestWins()
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    expect(problems).toEqual([expect.stringMatching(/^picking always the longest averages /), LONGEST_BEST_ALL])
    expect(problems.every(isLengthProblem)).toBe(true)
    expect(isLengthProblem('prefer sounds-right words averages 90, more than 10 above random (52.7)')).toBe(false)
    expect(fixRequest(g)).toBeNull() // nothing to fix unless the rule is named
    const fix = versionsCall(g, problems)
    // The two lead groups of each decision (approach texts, then the right approach's ways), 3 texts each, in order.
    const items = versionItems(fix.prompt)
    expect(items.map((i) => i.id)).toEqual(Array.from({ length: 24 }, (_, k) => `t${k + 1}`))
    expect(items.map((i) => i.text)).toEqual(
      g.decisions.flatMap((d) => [d.right.text, d.second.text, d.wrong.text, d.right.best.text, d.right.slip.text, d.right.mistake.text]),
    )
    for (const [k, i] of items.entries()) {
      expect([i.short, i.medium, i.long]).toEqual(Math.floor(k / 3) % 2 === 0 ? [7, 9, 10] : [10, 12, 14])
    }
    expect(fix.prompt).not.toMatch(/best|slip|mistake|blunder/)
    expect(fixRequest(g, problems)).toEqual(fix) // the same answer always gets the same request
  })

  it('picks a mix of versions measured on the real texts, so a reply in each text own words passes', () => {
    for (const g of [longestWins(), longestByCharacters()]) {
      const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
      expect(problems).toEqual([expect.stringMatching(/^picking always the longest averages /), LONGEST_BEST_ALL])
      const fix = versionsCall(g, problems)
      const reply = ownVersions(fix.prompt)
      const before = structuredClone(g)
      const out = pickVersions(g, fix.groups, reply)!
      expect(out).not.toBeNull()
      expect(checkScenario(repairDraft(slotsToDraft(out, SITUATION)))).toEqual([])
      expect(pickVersions(g, fix.groups, reply)).toEqual(out) // the same reply always gets the same pick
      // Only option texts of the lead groups change: no grade, outcome, reason or other group.
      for (const [d, dec] of out.decisions.entries()) {
        expect(dec.prompt).toBe(g.decisions[d].prompt)
        expect(dec.second.slip).toEqual(g.decisions[d].second.slip)
        expect(dec.wrong.worst).toEqual(g.decisions[d].wrong.worst)
        expect({ ...dec.right.best, text: '' }).toEqual({ ...g.decisions[d].right.best, text: '' })
      }
      expect(out.flag).toEqual(g.flag)
      expect(g).toEqual(before) // the input is not changed
    }
  })

  it('moves the wrong options before the correct text when either would pass', () => {
    const g = longestWins()
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    const fix = versionsCall(g, problems)
    const out = pickVersions(g, fix.groups, ownVersions(fix.prompt))!
    expect(checkScenario(repairDraft(slotsToDraft(out, SITUATION)))).toEqual([])
    // The right approach and its best way keep their texts; only other options were changed.
    for (const [d, dec] of out.decisions.entries()) {
      expect(dec.right.text).toBe(g.decisions[d].right.text)
      expect(dec.right.best.text).toBe(g.decisions[d].right.best.text)
    }
    expect(out).not.toEqual(g)
  })

  it('lengthens two wrong options rather than shorten the right one, though that changes one text fewer', () => {
    const g = answer()
    g.decisions[0].right.text = 'Approach plan with a few more words'
    g.decisions[0].right.best.text = 'Option for this step with a few more words'
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    const fix = versionsCall(g, problems)
    // Shortening the right approach to tie its siblings passes with one change; lengthening one wrong option
    // alone breaks the sibling length rule, so keeping the right text takes two changes.
    const alt: Record<string, { short?: string; long?: string }> = {
      'Approach plan with a few more words': { short: 'Approach my plan' },
      'Approach 01 plan': { long: 'Approach 01 plan with a few extras, ok' },
      'Approach 02 plan': { long: 'Approach 02 plan with a few extras, ok' },
    }
    const reply = { texts: versionItems(fix.prompt).map((i) => ({ id: i.id, short: alt[i.text]?.short ?? i.text, medium: i.text, long: alt[i.text]?.long ?? i.text })) }
    const out = pickVersions(g, fix.groups, reply)!
    expect(checkScenario(repairDraft(slotsToDraft(out, SITUATION)))).toEqual([])
    expect(out.decisions[0].right.text).toBe('Approach plan with a few more words')
    expect([out.decisions[0].second.text, out.decisions[0].wrong.text]).toEqual(['Approach 01 plan with a few extras, ok', 'Approach 02 plan with a few extras, ok'])
  })

  it('gives no pick when no mix of versions passes or the reply is unusable', () => {
    const g = longestWins()
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    const fix = versionsCall(g, problems)
    const items = versionItems(fix.prompt)
    // Versions identical to the originals leave only the original mix, which fails.
    const same = { texts: items.map((i) => ({ id: i.id, short: i.text, medium: i.text, long: i.text })) }
    expect(pickVersions(g, fix.groups, same)).toBeNull()
    // A version with a sounds-right word is never used: with one in every version, only the originals are left.
    expect(pickVersions(g, fix.groups, ownVersions(fix.prompt, ' calmly'))).toBeNull()
    // A version over the limit is never used.
    expect(pickVersions(g, fix.groups, ownVersions(fix.prompt, ` ${'x'.repeat(120)}`))).toBeNull()
    expect(pickVersions(g, fix.groups, { nonsense: true })).toBeNull()
    expect(pickVersions(g, fix.groups, { texts: [] })).toBeNull()
  })

  it('asks for an ordinary rewrite first when a group is uneven, even with a guessing rule broken', () => {
    const g = longestWins()
    for (const d of g.decisions) {
      d.right.text = 'Approach plan with many more words than either of the other two here'
      d.right.best.text = 'Option for this step with very many more words than either of the other two options'
    }
    const longest = 'picking always the longest averages 95, more than 10 above random (60)'
    expect(rewrite(g, [longest]).slots.length).toBeGreaterThan(0)
    expect(fixRequest(g, [longest])).toEqual(fixRequest(g))
  })

  it('repairs a best option findable by length with a versions call, not a full retry', async () => {
    const g = longestWins()
    const fix = versionsCall(g, checkScenario(repairDraft(slotsToDraft(g, SITUATION))))
    const { writer, kinds } = scripted(g, ownVersions(fix.prompt))
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'versions'])
    expect(writer.mock.calls[1][1].system).toBe(VERSIONS_SYSTEM_PROMPT)
    expect(rows('generations').map((r) => r.ok)).toEqual([false, true])
  })

  it('falls back to a full retry when two versions calls give no passing mix', async () => {
    const g = longestWins()
    const items = versionItems(versionsCall(g, checkScenario(repairDraft(slotsToDraft(g, SITUATION)))).prompt)
    const same = { texts: items.map((i) => ({ id: i.id, short: i.text, medium: i.text, long: i.text })) }
    const { writer, kinds } = scripted(g, same, null, answer())
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'versions', 'versions', 'scenario'])
    expect(rows('generations').map((r) => r.ok)).toEqual([false, false, false, true])
  })

  it('still makes a versions call after both rewrites are used on uneven texts, as in the real runs', async () => {
    const g = longestWins()
    g.decisions[1].second.slip.text = 'word '.repeat(20).trim()
    const fix1 = rewrite(g, checkScenario(repairDraft(slotsToDraft(g, SITUATION))))
    const reply1 = exactFix(fix1.prompt)
    const g1 = applyFixes(g, fix1.slots, reply1)!
    const second = checkScenario(repairDraft(slotsToDraft(g1, SITUATION)))
    // The first rewrite is unusable, the second evens the group, and the guessing rule then shows.
    const { writer, kinds } = scripted(g, null, reply1, ownVersions(versionsCall(g1, second).prompt))
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    expect(kinds).toEqual(['scenario', 'lengths', 'lengths', 'versions'])
    expect(rows('generations').map((r) => r.ok)).toEqual([false, false, false, true])
  })

  it('replays the live failure order: uneven texts rewritten first, then the best option findable by length fixed with versions', async () => {
    const g = longestWins()
    g.decisions[1].second.slip.text = 'word '.repeat(20).trim()
    const first = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    expect(first.some((p) => /way texts differ too much in length/.test(p))).toBe(true)
    expect(first.every(isLengthProblem)).toBe(true)
    const fix1 = rewrite(g, first)
    const reply1 = exactFix(fix1.prompt)
    const g1 = applyFixes(g, fix1.slots, reply1)!
    const second = checkScenario(repairDraft(slotsToDraft(g1, SITUATION)))
    expect(second).toEqual([expect.stringMatching(/^picking always the longest averages /), LONGEST_BEST_ALL])
    const { writer, kinds } = scripted(g, reply1, ownVersions(versionsCall(g1, second).prompt))
    const { call, rows } = setup(writer)
    expect((await call('user_a')).success).toBe(true)
    // Two length fixes and no second full call.
    expect(kinds).toEqual(['scenario', 'lengths', 'versions'])
    expect(rows('generations').map((r) => r.ok)).toEqual([false, false, true])
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
  const request = (kind: WriteRequest['kind'] = 'scenario') => ({ kind, system: 'system', prompt: 'prompt', abortSignal: AbortSignal.timeout(5_000) })

  it('returns the parsed answer when the model replies with matching JSON', async () => {
    const model = new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(answer())) })
    expect(await writeWith(model, request())).toMatchObject({ refuse: false, title: 'Fixture' })
  })

  it('parses a length fix against its own schema, not the scenario schema', async () => {
    const texts = { texts: [{ id: 't1', text: 'A rewritten option' }] }
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(texts)) }), request('lengths'))).toEqual(texts)
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(answer())) }), request('lengths'))).toBeNull()
  })

  it('parses a reword reply against the rewrite schema', async () => {
    const texts = { texts: [{ id: 't1', text: 'A reworded reason' }] }
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(texts)) }), request('whys'))).toEqual(texts)
  })

  it('parses a neutral rewrite reply against the rewrite schema', async () => {
    const texts = { texts: [{ id: 't1', text: 'A neutral option' }] }
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(texts)) }), request('cues'))).toEqual(texts)
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(answer())) }), request('cues'))).toBeNull()
  })

  it('parses a versions reply against its own schema', async () => {
    const versions = { texts: [{ id: 't1', short: 'Short one', medium: 'A medium version', long: 'A somewhat longer version here' }] }
    const texts = { texts: [{ id: 't1', text: 'A rewritten option' }] }
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(versions)) }), request('versions'))).toEqual(versions)
    expect(await writeWith(new MockLanguageModelV4({ doGenerate: reply(JSON.stringify(texts)) }), request('versions'))).toBeNull()
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

describe('repair guards', () => {
  it('applyFixes drops a rewrite that flips a no, changes a number or changes the first word', () => {
    const g = answer()
    g.decisions[0].right.best.text = 'Do not refund the $40 order today'
    const slot = { d: 0, approach: 'right' as const, way: 'best', target: 7 }
    const out = (text: string) => applyFixes(g, [slot], { texts: [{ id: 't1', text }] })!.decisions[0].right.best.text
    expect(out('Do refund the $40 order today')).toBe('Do not refund the $40 order today')
    expect(out('Do not refund the $50 order today')).toBe('Do not refund the $40 order today')
    expect(out('Never refund the $40 order today')).toBe('Do not refund the $40 order today')
    expect(out('Do not refund the $40 order right now')).toBe('Do not refund the $40 order right now')
    // A length rewrite may not bring in a flagged word or a new sounds-right word.
    expect(out('Do not refund the $40 order, lie')).toBe('Do not refund the $40 order today')
    expect(out('Do not calmly refund the $40 order')).toBe('Do not refund the $40 order today')
  })
  it('applyWhys drops a reword that flips a no or adds a name', () => {
    const g = answer()
    const way = g.decisions[0].right.best
    way.why = 'It works because you did not wait for the 3 pm call'
    const slot = { d: 0, approach: 'right' as const, way: 'best' }
    const out = (text: string) => applyWhys(g, [slot], { texts: [{ id: 't1', text }] })!.decisions[0].right.best.why
    expect(out('It works because you waited for the 3 pm call')).toBe(way.why)
    expect(out('It works because Dana did not wait for the 3 pm call')).toBe(way.why)
    expect(out('Acting before the 3 pm call, not waiting, is what worked')).toBe(way.why) // a turn word added
    expect(out('Not waiting for the 3 pm call is what made it work')).toBe('Not waiting for the 3 pm call is what made it work')
  })
})

describe('beatsMix', () => {
  it('ranks a passing mix that keeps the correct texts above one that buys headroom by changing them', () => {
    expect(beatsMix({ over: -2, keys: 0, changed: 3 }, { over: -8, keys: 1, changed: 101 })).toBe(true)
    expect(beatsMix({ over: -8, keys: 1, changed: 101 }, { over: -2, keys: 0, changed: 3 })).toBe(false)
  })
  it('then prefers the headroom, then fewer changes; any passing mix beats a failing one', () => {
    expect(beatsMix({ over: -6, keys: 0, changed: 5 }, { over: -1, keys: 0, changed: 1 })).toBe(true)
    expect(beatsMix({ over: -6, keys: 0, changed: 2 }, { over: -9, keys: 0, changed: 3 })).toBe(true)
    expect(beatsMix({ over: 0, keys: 2, changed: 300 }, { over: 1, keys: 0, changed: 0 })).toBe(true)
    expect(beatsMix({ over: 3, keys: 2, changed: 300 }, { over: 5, keys: 0, changed: 0 })).toBe(true)
    expect(beatsMix({ over: -6, keys: 0, changed: 2 }, { over: -7, keys: 0, changed: 2 })).toBe(false) // a tie keeps the first found
  })
})

describe('keepsDetails', () => {
  const text = 'Email Dana by 5 pm with the $40 quote, not a call'
  it('accepts a version that keeps every number, name and no', () => {
    expect(keepsDetails(text, 'Send Dana the $40 quote by 5 pm, not by phone')).toBe(true)
    expect(keepsDetails('Pay $40, not more.', '  Pay   $40 and\nnot a cent more  ')).toBe(true) // spacing and punctuation do not count
  })
  it('rejects a version that drops, changes or adds a number', () => {
    expect(keepsDetails(text, 'Email Dana with the $40 quote, not a call')).toBe(false)
    expect(keepsDetails(text, 'Email Dana by 6 pm with the $40 quote, not a call')).toBe(false)
    expect(keepsDetails(text, 'Email Dana by 5 pm with the $40 quote and 2 options, not a call')).toBe(false)
  })
  it('rejects a version that drops a name or flips a no', () => {
    expect(keepsDetails(text, 'Email her by 5 pm with the $40 quote, not a call')).toBe(false)
    expect(keepsDetails(text, 'Email Dana by 5 pm with the $40 quote and a call')).toBe(false)
    expect(keepsDetails('Call Dana by 5 pm', "Don't call Dana by 5 pm")).toBe(false)
    expect(keepsDetails('You cannot refund it', 'You can refund it')).toBe(false)
  })
  it('counts numbers written as words and each turn word as often as it appears', () => {
    expect(keepsDetails('Give Legal two days', 'Give Legal three days')).toBe(false)
    expect(keepsDetails('Give Legal two days to answer', 'Give Legal time to answer')).toBe(false)
    expect(keepsDetails('Give Legal two days to answer', 'Give Legal two full days to answer it')).toBe(true)
    expect(keepsDetails('Do not reply yet', 'Do not reply, not yet')).toBe(false) // a second no
    expect(keepsDetails('Wait a dozen days', 'Wait twelve days')).toBe(false) // a changed form counts as a changed number
  })
  it('rejects a version that adds a name or swaps one after a title', () => {
    expect(keepsDetails(text, 'Email Dana and Priya the $40 quote by 5 pm, not a call')).toBe(false)
    expect(keepsDetails('Ask Mr. Smith first', 'Ask Mr. Jones first')).toBe(false)
    expect(keepsDetails('Dana signs off today', 'Priya signs off today', { lead: true })).toBe(false) // a leading name is the lead word
  })
  it('rejects a version that changes the order or condition of an action', () => {
    expect(keepsDetails('Call the client before you send the invoice', 'Call the client after you send the invoice')).toBe(false)
    expect(keepsDetails('Refund it only if the box is unopened', 'Refund it if the box is unopened')).toBe(false)
    expect(keepsDetails('Refund it if the box is unopened', 'Refund it, the box is unopened')).toBe(false)
    expect(keepsDetails('Pay the deposit after the walkthrough', 'Pay the deposit right after the walkthrough ends')).toBe(true)
  })
  it("does not count I or its contractions as names", () => {
    expect(keepsDetails("Say I'm on it today", 'Say I am on it today')).toBe(true)
    expect(keepsDetails('Tell them I will call', "Tell them I'll call back")).toBe(true)
  })
  it('with lead, keeps the first word of an option, most often its action', () => {
    expect(keepsDetails('Delete the draft and tell the team', 'Publish the draft and tell the team', { lead: true })).toBe(false)
    expect(keepsDetails('Delete the draft and tell the team', 'Publish the draft and tell the team')).toBe(true) // only details without lead
    expect(keepsDetails('Delete the draft and tell the team', 'Quietly delete the draft, then tell the team', { lead: true })).toBe(true)
    expect(keepsDetails('Delete the draft and tell the team', 'Publish the draft, then delete it and tell the team', { lead: true })).toBe(false)
    expect(keepsDetails('Politely ask Dana for the file', 'Ask Dana for the file', { lead: true })).toBe(true) // an -ly opener is not the action
    expect(keepsDetails("Don't reply to Dana yet", 'Do not reply to Dana yet', { lead: true })).toBe(true)
    expect(keepsDetails('Do not refund the order', "Don't refund the order", { lead: true })).toBe(true)
  })
  it('with drop, for a reworded reason, lets numbers and names go but never come in', () => {
    const why = 'You chose Option 101 for this step too late'
    expect(keepsDetails(why, 'You moved too late to matter', { drop: true })).toBe(true)
    expect(keepsDetails(why, 'You moved too late to matter')).toBe(false)
    expect(keepsDetails(why, 'You chose Option 102 too late', { drop: true })).toBe(false)
    expect(keepsDetails(why, 'You did not move in time', { drop: true })).toBe(false)
  })
})

describe('longest best way repair', () => {
  /** The fixture answer with each best way one character longer than its siblings: too short a gap for the length rules, but the best way is the longest in all 4 decisions. */
  function bestOneLonger(): Generated {
    const g = answer()
    for (const d of g.decisions) d.right.best.text += 's'
    return g
  }

  it('counts the longest best way as a length problem and fixes it with a versions call over the lead groups', () => {
    const g = bestOneLonger()
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    const message = 'the best way is the longest of its approach in 4 of 4 decisions, more than 2'
    expect(problems).toContain(message)
    expect(isLengthProblem(message)).toBe(true)
    expect(isFixableProblem(message)).toBe(true)
    const fix = versionsCall(g, [message])
    expect(fix.groups.every((group) => group.leads)).toBe(true)
    expect(fix.groups).toHaveLength(8)
  })

  it('picks versions that leave the best way longest in at most 2 decisions, and the result passes every check', () => {
    const g = bestOneLonger()
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    const fix = versionsCall(g, problems)
    const picked = pickVersions(g, fix.groups, ownVersions(fix.prompt))
    expect(picked).not.toBeNull()
    const draft = repairDraft(slotsToDraft(picked!, SITUATION))
    expect(longestBestCount(draft)).toBeLessThanOrEqual(MAX_LONGEST_BEST)
    expect(checkScenario(draft)).toEqual([])
  })
})

describe('pickVersions detail guard', () => {
  it('never picks a version that adds a number: with every version given one, nothing changes', () => {
    const g = longestWins()
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    const fix = versionsCall(g, problems)
    // Control: a plain word of the same length lets the pick fix the scenario.
    expect(pickVersions(g, fix.groups, ownVersions(fix.prompt, ' brisk'))).not.toBeNull()
    // The same versions with a number added are all thrown away, so no mix is good enough.
    expect(pickVersions(g, fix.groups, ownVersions(fix.prompt, ' 70000'))).toBeNull()
  })

  it('never picks a version that changes the first word, the action: with every version led by another verb, nothing changes', () => {
    const g = longestWins()
    const problems = checkScenario(repairDraft(slotsToDraft(g, SITUATION)))
    const fix = versionsCall(g, problems)
    const reply = ownVersions(fix.prompt)
    expect(pickVersions(g, fix.groups, reply)).not.toBeNull() // control
    const publish = (t: string) => t.replace(/^\S+/, 'Publish')
    const releads = { texts: reply.texts.map((t) => ({ id: t.id, short: publish(t.short), medium: publish(t.medium), long: publish(t.long) })) }
    expect(pickVersions(g, fix.groups, releads)).toBeNull()
  })
})
