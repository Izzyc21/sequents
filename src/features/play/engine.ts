/**
 * The game rules, as plain functions with no I/O, so the same code runs in the
 * worker (actions) and in unit tests.
 *
 * A run starts at 100. Each locked-in way costs the points of its grade
 * (GRADE_POINTS). A way can raise a flag; a way at a later decision that
 * names that flag in `ifRaised` then plays at its worse override grade. The
 * score is 100 minus the points lost, and the score band decides the ending.
 */
import {
  APPROACHES,
  BANDS,
  CHOICES,
  DECISIONS,
  FORMAT,
  GRADE_POINTS,
  WAYS,
  type DraftWay,
  type Ending,
  type Fix,
  type Grade,
  type PublicScenario,
  type ScenarioAnswers,
  type ScenarioDraft,
  type StepResult,
  type WayAnswer,
} from './types'

/** Text limits checked on every scenario, starters and generated alike. */
export const LIMITS = {
  title: 80,
  situation: 400,
  setting: 600,
  prompt: 300,
  approach: 90,
  way: 120,
  outcome: 220,
  why: 220,
  ending: 600,
  flagLabel: 60,
} as const

/** Shortest situation the "write your own" box accepts (the longest is LIMITS.situation). */
export const SITUATION_MIN = 10

export const MAX_FLAGS = 3
export const FLAG_ID = /^[a-z][a-z0-9-]{0,23}$/

/** Every possible path: 9 choices at each of 4 decisions. */
export const PATHS = CHOICES ** DECISIONS

/** What random picking must look like across every path (see behaviourProblems). */
export const RANDOM_PLAY = {
  minBadShare: 0.6,
  maxGoodShare: 0.03,
  minOkShare: 0.05,
  minAverage: 35,
  maxAverage: 65,
}

/** No simple guessing rule (always the longest, and so on) may average more than this above random. */
export const HEURISTIC_MARGIN = 10

/**
 * At most this many decisions may have a best way strictly longer than both
 * other ways of its approach. A player who finds the right approach (the easy
 * step) and then takes the longest way would otherwise beat chance (1 in 3)
 * by length alone; the length rules above pick the approach by length too, so
 * they miss this.
 */
export const MAX_LONGEST_BEST = 2

/** Sibling texts: the longest at most this many times the shortest, unless they differ by at most LENGTH_SLACK characters. */
export const LENGTH_RATIO = 1.6
export const LENGTH_SLACK = 20

/** Words that make an option sound right. Allowed in the right option only if a sibling also has one. */
export const CUE_WORDS = [
  'carefully',
  'calmly',
  'politely',
  'respectfully',
  'kindly',
  'gently',
  'honestly',
  'professionally',
  'thoughtfully',
  'patiently',
  'tactfully',
  'appropriately',
  'make sure',
]
/** Matches any of CUE_WORDS as a whole word. */
export const CUE_PATTERN = new RegExp(`\\b(${CUE_WORDS.join('|')})\\b`, 'i')

/**
 * Words that mark an option as plainly bad behaviour (rude, aggressive,
 * dishonest or vengeful), so a player can rule it out without understanding
 * the situation. No option may use one. Words that also name sound moves
 * (refuse, insist, a lawyer, the police, walk away, immediately) are left out.
 */
export const WRONG_CUE_WORDS = [
  'demand',
  'demands',
  'demanded',
  'demanding',
  'threaten',
  'threatens',
  'threatened',
  'threatening',
  'yell',
  'yells',
  'yelled',
  'yelling',
  'shout',
  'shouts',
  'shouted',
  'shouting',
  'scream',
  'screams',
  'screamed',
  'screaming',
  'loudly',
  'angrily',
  'rudely',
  'insult',
  'insults',
  'insulted',
  'insulting',
  'sarcastic',
  'sarcastically',
  'mock',
  'mocks',
  'mocked',
  'mocking',
  'lie',
  'lies',
  'lied',
  'lying',
  'pretend',
  'pretends',
  'pretended',
  'pretending',
  'shame',
  'shamed',
  'shaming',
  'revenge',
  'get even',
  'got even',
  'getting even',
  'publicly',
]

/**
 * Sound uses of a cue word that the check lets through, as a lookahead or
 * lookbehind on that word: a demand letter (a formal step), "lie down" and
 * "lying low", a mock interview, "it's a shame", publicly thanking or
 * praising someone (any form of the verb).
 */
const LIE_RESTING = '(?!\\s+(?:down|low)\\b)'
const PUBLIC_PRAISE = '(?!\\s+(?:thank|prais|credit|acknowledg|recogni[sz]|congratulat)\\w*\\b)'
const CUE_EXCEPTIONS: Record<string, { before?: string; after?: string }> = {
  demand: { after: '(?![\\s-]+letters?\\b)' },
  lie: { after: LIE_RESTING },
  lies: { after: LIE_RESTING },
  lying: { after: LIE_RESTING },
  mock: { after: '(?![\\s-]+(?:exams?|tests?|interviews?|trials?)\\b)' },
  shame: { before: '(?<!\\ba\\s)' },
  publicly: { after: PUBLIC_PRAISE },
}

const cueSource = (word: string) => {
  const ex = CUE_EXCEPTIONS[word] ?? {}
  return `${ex.before ?? ''}${word.replace(/ /g, '\\s+')}${ex.after ?? ''}`
}

/** Matches any of WRONG_CUE_WORDS as a whole word, except the sound uses in CUE_EXCEPTIONS; group 1 is the word. */
export const WRONG_CUE_PATTERN = new RegExp(`\\b(${WRONG_CUE_WORDS.map(cueSource).join('|')})\\b`, 'i')

/** A way's why may not repeat this many consecutive words of a sibling way's text. */
export const ECHO_WORDS = 5

const GRADES: Grade[] = ['best', 'slip', 'mistake', 'blunder']

export const toChoice = (approach: number, way: number) => approach * WAYS + way
export const fromChoice = (choice: number) => ({ approach: Math.floor(choice / WAYS), way: choice % WAYS })

export function isChoice(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CHOICES
}

export function endingFor(score: number): Ending {
  if (score >= BANDS.good) return 'good'
  if (score >= BANDS.ok) return 'ok'
  return 'bad'
}

/** One scored step, with the texts the player sees (outcome now, why once unlocked). */
export interface StepDetail extends StepResult {
  outcome: string
  why: string
  /** The flag that changed this step; '' if none. */
  flag: string
}

/**
 * Scores the choices made so far, in order. At each decision the way's
 * override applies when its flag was raised at an earlier decision; the
 * way's own raises are applied after it is scored. causedBy is the earliest
 * decision that raised the flag.
 */
export function replay(wayKeys: WayAnswer[][][], choices: number[]): StepDetail[] {
  const raisedAt = new Map<string, number>()
  return choices.map((choice, d) => {
    const { approach, way } = fromChoice(choice)
    const key = wayKeys[d][approach][way]
    const o = key.ifRaised
    const hit = o && raisedAt.has(o.flag) ? o : null
    const grade = hit ? hit.grade : key.grade
    for (const flag of key.raises ?? []) if (!raisedAt.has(flag)) raisedAt.set(flag, d)
    return {
      grade,
      base: key.grade,
      points: GRADE_POINTS[grade],
      causedBy: hit ? raisedAt.get(hit.flag)! : -1,
      flag: hit ? hit.flag : '',
      outcome: hit ? hit.outcome : key.outcome,
      why: hit ? hit.why : key.why,
    }
  })
}

/** Score of a full or partial path. Max loss is 4 x 20 = 80, so it never goes below 20; max(0) is only a guard. */
export function scoreOf(steps: StepResult[]): number {
  return Math.max(0, 100 - steps.reduce((sum, s) => sum + s.points, 0))
}

export function scoreRun(wayKeys: WayAnswer[][][], choices: number[]) {
  const details = replay(wayKeys, choices)
  const steps: StepResult[] = details.map(({ grade, points, base, causedBy }) => ({ grade, points, base, causedBy }))
  const score = scoreOf(steps)
  return { details, steps, score, ending: endingFor(score) }
}

/** Calls `visit` with every one of the 6,561 full paths. */
function forEachPath(visit: (choices: number[]) => void) {
  const choices = new Array<number>(DECISIONS).fill(0)
  for (let n = 0; n < PATHS; n++) {
    let rest = n
    for (let d = 0; d < DECISIONS; d++) {
      choices[d] = rest % CHOICES
      rest = Math.floor(rest / CHOICES)
    }
    visit(choices)
  }
}

export interface Analysis {
  /** Mean score over every path. */
  guessAverage: number
  endings: Record<Ending, number>
  /** scoreCounts[s] = how many paths score exactly s. */
  scoreCounts: number[]
}

export function analyse(wayKeys: WayAnswer[][][]): Analysis {
  const scoreCounts = new Array<number>(101).fill(0)
  const endings: Record<Ending, number> = { good: 0, ok: 0, bad: 0 }
  let total = 0
  forEachPath((choices) => {
    const score = scoreOf(replay(wayKeys, choices))
    scoreCounts[score]++
    endings[endingFor(score)]++
    total += score
  })
  return { guessAverage: round1(total / PATHS), endings, scoreCounts }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Percent of all paths that score strictly lower than `score`, rounded down. */
export function beatsShare(scoreCounts: number[], score: number): number {
  let lower = 0
  for (let s = 0; s < score && s < scoreCounts.length; s++) lower += scoreCounts[s]
  return Math.floor((lower / PATHS) * 100)
}

/**
 * For each decision, the most points that changing only that decision would
 * win back: every one of the 8 other choices is tried and later steps are
 * rescored, since a change can raise or avoid a flag. 0 when nothing helps.
 */
export function gainsByDecision(wayKeys: WayAnswer[][][], choices: number[]): number[] {
  const base = scoreOf(replay(wayKeys, choices))
  return choices.map((own, d) => {
    let best = 0
    for (let c = 0; c < CHOICES; c++) {
      if (c === own) continue
      const changed = [...choices]
      changed[d] = c
      best = Math.max(best, scoreOf(replay(wayKeys, changed)) - base)
    }
    return best
  })
}

/**
 * The one changed choice that gains the most (see gainsByDecision). Ties go
 * to the earliest decision. Decision -1 when no change gains.
 */
export function bestSingleFix(wayKeys: WayAnswer[][][], choices: number[]): Fix {
  let fix: Fix = { decision: -1, gain: 0 }
  gainsByDecision(wayKeys, choices).forEach((gain, decision) => {
    if (gain > fix.gain) fix = { decision, gain }
  })
  return fix
}

/**
 * For k = 0..DECISIONS: how many paths that start with the player's first k
 * choices end good (score at or above BANDS.good). One walk over every path:
 * a good path counts at each k up to the length of the prefix it shares with
 * the player's choices.
 */
export function tunnelCounts(wayKeys: WayAnswer[][][], choices: number[]): number[] {
  const counts = new Array<number>(DECISIONS + 1).fill(0)
  forEachPath((path) => {
    if (endingFor(scoreOf(replay(wayKeys, path))) !== 'good') return
    let shared = 0
    while (shared < DECISIONS && path[shared] === choices[shared]) shared++
    for (let k = 0; k <= shared; k++) counts[k]++
  })
  return counts
}

/** The hint for a run that no single change improves; a perfect run gets it too. */
export const NO_SINGLE_FIX = 'No single change wins points back here.'

/** The hint guess that means "I would change none of them". Guesses 0-3 are decisions. */
export const HINT_NOWHERE = DECISIONS

/**
 * The one-line hint for the decision a player says they would change in a
 * finished run (or HINT_NOWHERE for "none"), from the run's score, its scored
 * steps and `gains` (gainsByDecision). The first rule that matches decides;
 * no line names an option or a grade. "None" and any decision that cost
 * nothing get the same line on a perfect run as on a run that no single change
 * can improve, so a hint never confirms a perfect score.
 */
export function hintFor(guess: number, score: number, steps: StepResult[], gains: number[]): string {
  const max = score === 100 ? 0 : Math.max(...gains)
  if (max <= 0) return guess === HINT_NOWHERE || steps[guess].points === 0 ? NO_SINGLE_FIX : 'That one cost you, but changing it alone wins nothing back.'
  if (guess === HINT_NOWHERE) return 'One change would win points back. Look again.'
  const top = gains.flatMap((g, d) => (g === max ? [d] : []))
  if (top.includes(guess)) {
    return top.length === 1
      ? 'Yes. Changing that one decision would win back more than changing any other.'
      : 'Yes. That is one of the best places to change.'
  }
  const step = steps[guess]
  if (step.causedBy >= 0 && top.includes(step.causedBy)) return 'It went wrong there, but an earlier choice set it up.'
  // The nearest decision in the top set; an equal distance goes to the earlier one.
  const nearest = top.reduce((a, b) => (Math.abs(b - guess) < Math.abs(a - guess) ? b : a))
  const direction = nearest < guess ? 'Look earlier.' : 'Look later.'
  return step.points > 0 ? `That one cost you, but it is not your biggest fix. ${direction}` : `That one cost nothing by itself. ${direction}`
}

/**
 * The expected score of a player who, at each decision, picks evenly among
 * the choices `candidates(d)` returns. Every branch is followed, so flags
 * raised on one branch count only on that branch.
 */
export function expectedScore(wayKeys: WayAnswer[][][], candidates: (d: number) => number[]): number {
  // candidates depends only on the decision, so each decision's list is worked out once, not at every branch.
  const lists: number[][] = []
  const walk = (choices: number[]): number => {
    if (choices.length === DECISIONS) return scoreOf(replay(wayKeys, choices))
    const options = (lists[choices.length] ??= candidates(choices.length))
    return options.reduce((sum, c) => sum + walk([...choices, c]), 0) / options.length
  }
  return round1(walk([]))
}

/** Indexes of the items `pick` keeps from `values`; all of them when it keeps none. */
function keepIndexes(values: string[], pick: TextRule): number[] {
  const kept = values.map((v, i) => (pick(v, values) ? i : -1)).filter((i) => i >= 0)
  return kept.length > 0 ? kept : values.map((_, i) => i)
}

type TextRule = (text: string, all: string[]) => boolean
const longest: TextRule = (t, all) => t.length === Math.max(...all.map((a) => a.length))
const shortest: TextRule = (t, all) => t.length === Math.min(...all.map((a) => a.length))
const middle: TextRule = (t, all) => t.length === all.map((a) => a.length).sort((a, b) => a - b)[1]
const cued: TextRule = (t) => CUE_PATTERN.test(t)

/** The guessing rules that go only by text length in characters. */
const BY_LENGTH: Record<string, TextRule> = {
  'always the longest': longest,
  'always the shortest': shortest,
  'always the middle length': middle,
}
/** Names of the guessing rules in HEURISTICS that go only by length (a length fix can break them). */
export const LENGTH_RULES: readonly string[] = Object.keys(BY_LENGTH)

/** The guessing rules a scenario must not reward (see giveawayProblems). Ties are split evenly. */
export const HEURISTICS: Record<string, TextRule> = {
  ...BY_LENGTH,
  'prefer sounds-right words': cued,
}

/** The choices a text-only rule picks at decision `d`: first an approach, then a way inside it. */
export function heuristicChoices(draft: ScenarioDraft, rule: TextRule, d: number): number[] {
  const approaches = draft.decisions[d].approaches
  const picked = keepIndexes(
    approaches.map((a) => a.text),
    rule,
  )
  return picked.flatMap((a) =>
    keepIndexes(
      approaches[a].ways.map((w) => w.text),
      rule,
    ).map((w) => toChoice(a, w)),
  )
}

/** The hidden half of every way, in the shape `scenario_answers` stores. */
export function wayKeysOf(draft: ScenarioDraft): WayAnswer[][][] {
  return draft.decisions.map((decision) =>
    decision.approaches.map((approach) =>
      approach.ways.map((w) => {
        const key: WayAnswer = { grade: w.grade, outcome: w.outcome, why: w.why }
        if (w.raises && w.raises.length > 0) key.raises = [...w.raises]
        if (w.ifRaised) key.ifRaised = { ...w.ifRaised }
        return key
      }),
    ),
  )
}

/** The path that takes the best way at every decision. */
export function bestLine(draft: ScenarioDraft): number[] {
  return draft.decisions.map((decision) => {
    for (let a = 0; a < APPROACHES; a++) {
      const w = decision.approaches[a].ways.findIndex((way) => way.grade === 'best')
      if (w >= 0) return toChoice(a, w)
    }
    return 0
  })
}

function textProblem(label: string, value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return `${label} is empty`
  if (value.length > max) return `${label} is ${value.length} characters, over the ${max} limit`
  return null
}

/**
 * Every rule a scenario must pass before it can be played. Returns the
 * problems found; an empty list means the scenario is playable.
 *
 * First the shape, text limits and flag references (`shapeProblems`); only if
 * those pass, the grade mix, flags and giveaways; only if those pass, how
 * random play scores.
 */
export function checkScenario(draft: ScenarioDraft): string[] {
  const shape = shapeProblems(draft)
  if (shape.length > 0) return shape
  const content = [...mixProblems(draft), ...flagProblems(draft), ...giveawayProblems(draft)]
  return content.length > 0 ? content : behaviourProblems(draft)
}

/**
 * Counts, text limits, grades and flag references. Stops early when a list
 * has the wrong length, since the checks after it index into that list.
 */
export function shapeProblems(draft: ScenarioDraft): string[] {
  const problems: string[] = []
  const add = (p: string | null) => {
    if (p) problems.push(p)
  }

  add(textProblem('title', draft?.title, LIMITS.title))
  add(textProblem('situation', draft?.situation, LIMITS.situation))
  add(textProblem('setting', draft?.setting, LIMITS.setting))
  for (const ending of ['good', 'ok', 'bad'] as const) {
    add(textProblem(`${ending} ending`, draft?.endings?.[ending], LIMITS.ending))
  }

  const flags = Array.isArray(draft?.flags) ? draft.flags : null
  if (!flags || flags.length < 1 || flags.length > MAX_FLAGS) {
    problems.push(`needs 1 to ${MAX_FLAGS} flags`)
    return problems
  }
  const ids = new Set<string>()
  flags.forEach((f, i) => {
    if (typeof f?.id !== 'string' || !FLAG_ID.test(f.id)) problems.push(`flag ${i + 1} id must be lowercase letters, digits or dashes`)
    else if (ids.has(f.id)) problems.push(`flag id "${f.id}" is used twice`)
    else ids.add(f.id)
    add(textProblem(`flag ${i + 1} label`, f?.label, LIMITS.flagLabel))
  })

  if (!Array.isArray(draft.decisions) || draft.decisions.length !== DECISIONS) {
    problems.push(`needs exactly ${DECISIONS} decisions`)
    return problems
  }
  draft.decisions.forEach((decision, d) => {
    const at = `decision ${d + 1}`
    add(textProblem(`${at} prompt`, decision?.prompt, LIMITS.prompt))
    if (!Array.isArray(decision?.approaches) || decision.approaches.length !== APPROACHES) {
      problems.push(`${at} needs exactly ${APPROACHES} approaches`)
      return
    }
    decision.approaches.forEach((approach, a) => {
      const where = `${at} approach ${a + 1}`
      add(textProblem(`${where} text`, approach?.text, LIMITS.approach))
      if (!Array.isArray(approach?.ways) || approach.ways.length !== WAYS) {
        problems.push(`${where} needs exactly ${WAYS} ways`)
        return
      }
      approach.ways.forEach((way, w) => problems.push(...wayProblems(way, `${where} way ${w + 1}`, ids)))
    })
  })
  return problems
}

function wayProblems(way: DraftWay, where: string, ids: Set<string>): string[] {
  const problems: string[] = []
  const add = (p: string | null) => {
    if (p) problems.push(p)
  }
  add(textProblem(`${where} text`, way?.text, LIMITS.way))
  add(textProblem(`${where} outcome`, way?.outcome, LIMITS.outcome))
  add(textProblem(`${where} why`, way?.why, LIMITS.why))
  if (!GRADES.includes(way?.grade)) problems.push(`${where} needs a grade: best, slip, mistake or blunder`)
  if (way?.raises !== undefined) {
    if (!Array.isArray(way.raises) || way.raises.some((f) => !ids.has(f))) problems.push(`${where} raises a flag that does not exist`)
    else if (new Set(way.raises).size !== way.raises.length) problems.push(`${where} raises the same flag twice`)
  }
  const o = way?.ifRaised
  if (o !== undefined) {
    if (!ids.has(o?.flag)) problems.push(`${where} reacts to a flag that does not exist`)
    if (!GRADES.includes(o?.grade)) problems.push(`${where} flag reaction needs a grade`)
    else if (GRADES.includes(way.grade) && GRADE_POINTS[o.grade] <= GRADE_POINTS[way.grade]) {
      problems.push(`${where} flag reaction must be graded worse than the way itself`)
    }
    add(textProblem(`${where} flag reaction outcome`, o?.outcome, LIMITS.outcome))
    add(textProblem(`${where} flag reaction why`, o?.why, LIMITS.why))
  }
  return problems
}

/**
 * The grade mix of each decision, so that the wrong plan costs more than an
 * imprecise way of carrying out the right one:
 * - exactly one best way;
 * - its approach (the right one) also holds a slip and a mistake or blunder;
 * - the other two approaches hold at most one slip between them, and every
 *   other way in them is a mistake or blunder;
 * - at least one blunder.
 */
export function mixProblems(draft: ScenarioDraft): string[] {
  const problems: string[] = []
  draft.decisions.forEach((decision, d) => {
    const at = `decision ${d + 1}`
    const grades = decision.approaches.map((a) => a.ways.map((w) => w.grade))
    const all = grades.flat()
    const count = (g: Grade, list: Grade[] = all) => list.filter((x) => x === g).length
    if (count('best') !== 1) {
      problems.push(`${at} needs exactly one best way`)
      return
    }
    const right = grades.findIndex((list) => list.includes('best'))
    const r = grades[right]
    if (count('slip', r) < 1 || count('mistake', r) + count('blunder', r) < 1) {
      problems.push(`${at}: the approach with the best way also needs a slip and a mistake or blunder`)
    }
    const others = grades.filter((_, a) => a !== right).flat()
    if (count('slip', others) > 1) problems.push(`${at}: the two other approaches may hold at most one slip between them`)
    if (count('blunder') < 1) problems.push(`${at} needs at least one blunder`)
  })
  return problems
}

/**
 * Flags must matter and must not touch the best line: each flag is named by
 * an override at a later decision than one that raises it, every override
 * has an earlier raise, and taking the best way at every decision scores
 * exactly 100.
 */
export function flagProblems(draft: ScenarioDraft): string[] {
  const problems: string[] = []
  const ways = draft.decisions.map((decision) => decision.approaches.flatMap((a) => a.ways))
  for (const flag of draft.flags) {
    const raisedAt = ways.findIndex((list) => list.some((w) => w.raises?.includes(flag.id)))
    const hitLater = raisedAt >= 0 && ways.some((list, d) => d > raisedAt && list.some((w) => w.ifRaised?.flag === flag.id))
    if (!hitLater) problems.push(`flag "${flag.id}" must be raised at one decision and change a way at a later one`)
  }
  ways.forEach((list, d) => {
    for (const w of list) {
      if (!w.ifRaised) continue
      const flag = w.ifRaised.flag
      const earlier = ways.slice(0, d).some((prev) => prev.some((p) => p.raises?.includes(flag)))
      if (!earlier) problems.push(`decision ${d + 1}: a way reacts to flag "${flag}", which no earlier decision raises`)
    }
  })
  const best = scoreOf(replay(wayKeysOf(draft), bestLine(draft)))
  if (best !== 100) problems.push(`taking the best way at every decision scores ${best}, not 100`)
  return problems
}

/** A text's words, lowercase: letters of any language, digits and apostrophes (curly ones read as straight). */
function wordsOf(text: string): string[] {
  return text.normalize('NFC').toLowerCase().replace(/[‘’]/g, "'").match(/[\p{L}\p{M}\p{N}']+/gu) ?? []
}

/** The first run of ECHO_WORDS consecutive words of `source` that `text` repeats (lowercase, punctuation dropped), or null. */
export function echoedRun(text: string, source: string): string | null {
  const src = wordsOf(source)
  const runs = new Set<string>()
  for (let i = 0; i + ECHO_WORDS <= src.length; i++) runs.add(src.slice(i, i + ECHO_WORDS).join(' '))
  const words = wordsOf(text)
  for (let i = 0; i + ECHO_WORDS <= words.length; i++) {
    const run = words.slice(i, i + ECHO_WORDS).join(' ')
    if (runs.has(run)) return run
  }
  return null
}

/** True when `text` repeats ECHO_WORDS or more consecutive words of `source`. */
export function echoes(text: string, source: string): boolean {
  return echoedRun(text, source) !== null
}

/** A text's words in order, lowercase, punctuation dropped: two texts with the same key say the same thing word for word. */
const sameWordsKey = (text: string) => wordsOf(text).join(' ')

/** True when `a` and `b` have the same words (see sameWordsKey). */
export function sameWords(a: string, b: string): boolean {
  const key = sameWordsKey(a)
  return key !== '' && key === sameWordsKey(b)
}

/** Pairs of positions in `texts` whose words are the same (see sameWordsKey). */
function duplicatePairs(texts: string[]): [number, number][] {
  const pairs: [number, number][] = []
  const keys = texts.map(sameWordsKey)
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) if (keys[i] !== '' && keys[i] === keys[j]) pairs.push([i, j])
  }
  return pairs
}

/** True when sibling texts are similar enough in length (see LENGTH_RATIO). */
export function lengthsClose(texts: string[]): boolean {
  const lengths = texts.map((t) => t.length)
  const lo = Math.min(...lengths)
  const hi = Math.max(...lengths)
  return hi - lo <= LENGTH_SLACK || hi <= LENGTH_RATIO * lo
}

/** True when the right item uses a sounds-right word and none of its siblings does. */
function loneCue(texts: string[], right: number): boolean {
  return right >= 0 && CUE_PATTERN.test(texts[right]) && !texts.some((t, i) => i !== right && CUE_PATTERN.test(t))
}

/**
 * Surface clues that would let a player find the right option without
 * understanding the situation: sibling lengths far apart, a sounds-right word
 * only on the right option, a word that marks an option as plainly bad, two
 * options with the same words, a why that copies a sibling's text, any
 * simple guessing rule scoring well above random, and a best way that is the
 * longest of its approach too often (MAX_LONGEST_BEST).
 */
export function giveawayProblems(draft: ScenarioDraft): string[] {
  const problems: string[] = []
  const wrongCue = (text: string, where: string) => {
    const word = WRONG_CUE_PATTERN.exec(text)?.[1]
    if (word) problems.push(`${where}: uses a word that marks it as a poor choice ("${word.toLowerCase()}")`)
  }
  draft.decisions.forEach((decision, d) => {
    const at = `decision ${d + 1}`
    const approachTexts = decision.approaches.map((a) => a.text)
    if (!lengthsClose(approachTexts)) problems.push(`${at}: approach texts differ too much in length`)
    const right = decision.approaches.findIndex((a) => a.ways.some((w) => w.grade === 'best'))
    if (loneCue(approachTexts, right)) problems.push(`${at}: only the right approach uses a sounds-right word`)
    for (const [i, j] of duplicatePairs(approachTexts)) problems.push(`${at}: approach ${i + 1} and approach ${j + 1} have the same text`)
    const allWays = decision.approaches.flatMap((approach, a) => approach.ways.map((way, w) => ({ text: way.text, where: `approach ${a + 1} way ${w + 1}` })))
    for (const [i, j] of duplicatePairs(allWays.map((x) => x.text))) problems.push(`${at}: ${allWays[i].where} and ${allWays[j].where} have the same text`)
    decision.approaches.forEach((approach, a) => {
      wrongCue(approach.text, `${at} approach ${a + 1}`)
      approach.ways.forEach((way, w) => wrongCue(way.text, `${at} approach ${a + 1} way ${w + 1}`))
      const texts = approach.ways.map((w) => w.text)
      if (!lengthsClose(texts)) problems.push(`${at} approach ${a + 1}: way texts differ too much in length`)
      if (loneCue(texts, approach.ways.findIndex((w) => w.grade === 'best'))) {
        problems.push(`${at}: only the best way uses a sounds-right word`)
      }
      approach.ways.forEach((way, w) => {
        if (texts.some((t, other) => other !== w && echoes(way.why, t))) {
          problems.push(`${at} approach ${a + 1} way ${w + 1}: its why copies a sibling way's text`)
        }
      })
    })
  })
  if (problems.length > 0) return problems

  const { random, scores } = guessScores(draft)
  for (const [name, got] of Object.entries(scores)) {
    if (got > random + HEURISTIC_MARGIN) {
      problems.push(`picking ${name} averages ${got}, more than ${HEURISTIC_MARGIN} above random (${random})`)
    }
  }
  const longestBest = longestBestCount(draft)
  if (longestBest > MAX_LONGEST_BEST) {
    problems.push(`the best way is the longest of its approach in ${longestBest} of ${DECISIONS} decisions, more than ${MAX_LONGEST_BEST}`)
  }
  return problems
}

/** How many decisions have a best way strictly longer, in characters, than both other ways of its approach (see MAX_LONGEST_BEST). */
export function longestBestCount(draft: ScenarioDraft): number {
  return draft.decisions.filter((decision) =>
    decision.approaches.some((approach) => {
      const best = approach.ways.find((w) => w.grade === 'best')
      return best !== undefined && approach.ways.every((w) => w === best || w.text.length < best.text.length)
    }),
  ).length
}

/** What random play averages on `draft`, and what each guessing rule in HEURISTICS averages, by name. */
export function guessScores(draft: ScenarioDraft): { random: number; scores: Record<string, number> } {
  return { random: randomScore(draft), scores: ruleScores(draft, Object.keys(HEURISTICS)) }
}

/**
 * What random play averages on `draft`. It walks all 6,561 paths, the costly
 * part of guessScores, and depends only on the grades and flags, not on texts.
 */
export function randomScore(draft: ScenarioDraft): number {
  return expectedScore(wayKeysOf(draft), () => ALL_CHOICES)
}

/** What each named guessing rule in HEURISTICS averages on `draft`, by name. */
export function ruleScores(draft: ScenarioDraft, names: readonly string[]): Record<string, number> {
  const wayKeys = wayKeysOf(draft)
  const scores: Record<string, number> = {}
  for (const name of names) scores[name] = expectedScore(wayKeys, (d) => heuristicChoices(draft, HEURISTICS[name], d))
  return scores
}

const ALL_CHOICES = Array.from({ length: CHOICES }, (_, i) => i)

/** How random play scores across every path; see RANDOM_PLAY. */
export function behaviourProblems(draft: ScenarioDraft): string[] {
  const problems: string[] = []
  const { guessAverage, endings } = analyse(wayKeysOf(draft))
  const share = (e: Ending) => endings[e] / PATHS
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`
  if (share('bad') < RANDOM_PLAY.minBadShare) problems.push(`only ${pct(share('bad'))} of paths end bad; needs ${pct(RANDOM_PLAY.minBadShare)}`)
  if (share('good') > RANDOM_PLAY.maxGoodShare) problems.push(`${pct(share('good'))} of paths end good; at most ${pct(RANDOM_PLAY.maxGoodShare)}`)
  if (share('ok') < RANDOM_PLAY.minOkShare) problems.push(`only ${pct(share('ok'))} of paths end ok; needs ${pct(RANDOM_PLAY.minOkShare)}`)
  if (guessAverage < RANDOM_PLAY.minAverage || guessAverage > RANDOM_PLAY.maxAverage) {
    problems.push(`random picking averages ${guessAverage}; must be ${RANDOM_PLAY.minAverage} to ${RANDOM_PLAY.maxAverage}`)
  }
  return problems
}

/** Separates a checked draft into its readable half and its hidden half. */
export function splitDraft(draft: ScenarioDraft): {
  scenario: PublicScenario
  answers: Omit<ScenarioAnswers, 'scenarioId'>
} {
  const wayKeys = wayKeysOf(draft)
  return {
    scenario: {
      title: draft.title,
      situation: draft.situation,
      setting: draft.setting,
      decisions: draft.decisions.map((decision) => ({
        prompt: decision.prompt,
        approaches: decision.approaches.map((a) => ({ text: a.text, ways: a.ways.map((w) => w.text) })),
      })),
      guessAverage: analyse(wayKeys).guessAverage,
    },
    answers: {
      format: FORMAT,
      wayKeys,
      flags: draft.flags.map((f) => ({ id: f.id, label: f.label })),
      endings: { ...draft.endings },
    },
  }
}

/**
 * Trims every text in generated output before it is checked. It never
 * invents missing parts or changes a grade; those still fail `checkScenario`.
 */
export function repairDraft(draft: ScenarioDraft): ScenarioDraft {
  const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v) as string
  return {
    ...draft,
    title: trim(draft.title),
    situation: trim(draft.situation),
    setting: trim(draft.setting),
    flags: (draft.flags ?? []).map((f) => ({ id: trim(f?.id), label: trim(f?.label) })),
    decisions: (draft.decisions ?? []).map((decision) => ({
      prompt: trim(decision?.prompt),
      approaches: (decision?.approaches ?? []).map((approach) => ({
        text: trim(approach?.text),
        ways: (approach?.ways ?? []).map((w) => {
          const way: DraftWay = { text: trim(w?.text), grade: w?.grade, outcome: trim(w?.outcome), why: trim(w?.why) }
          if (w?.raises !== undefined) way.raises = Array.isArray(w.raises) ? w.raises.map(trim) : w.raises
          if (w?.ifRaised !== undefined) {
            way.ifRaised = w.ifRaised && {
              flag: trim(w.ifRaised.flag),
              grade: w.ifRaised.grade,
              outcome: trim(w.ifRaised.outcome),
              why: trim(w.ifRaised.why),
            }
          }
          return way
        }),
      })),
    })),
    endings: {
      good: trim(draft.endings?.good),
      ok: trim(draft.endings?.ok),
      bad: trim(draft.endings?.bad),
    },
  }
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Shuffles the approaches inside each decision and the ways inside each
 * approach, so the right option is not always in the same place. Flags are
 * named by id, not position, so they survive the shuffle. `random` returns a
 * number in [0, 1).
 */
export function shuffleDraft(draft: ScenarioDraft, random: () => number = Math.random): ScenarioDraft {
  return {
    ...draft,
    decisions: draft.decisions.map((decision) => ({
      ...decision,
      approaches: shuffled(decision.approaches, random).map((a) => ({ ...a, ways: shuffled(a.ways, random) })),
    })),
  }
}

/**
 * A repeatable random number source from a string, so a starter shuffles the
 * same way on every worker (mulberry32 seeded with an FNV-1a hash).
 */
export function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
