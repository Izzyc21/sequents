/**
 * Playing: seed the starters, start a run, commit to an approach, lock in a
 * way, take a finished first try's one last chance (rewind), reveal its
 * debrief, and explain a finished run.
 *
 * The browser never writes runs itself (the schema forbids it). Every move
 * comes through here so the server can check it is legal and score it
 * against the hidden answers, which the browser never sees.
 */
import { isAnonymousUserId, type ActionHandler, type ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  analyse,
  beatsShare,
  bestSingleFix,
  fromChoice,
  isChoice,
  replay,
  scoreRun,
  seededRandom,
  shuffleDraft,
  splitDraft,
  tunnelCounts,
} from '../features/play/engine'
import {
  APPROACHES,
  committedApproach,
  DECISIONS,
  FORMAT,
  keepsLaterChoices,
  CHILDREN_READ,
  LAST_CHANCE_CLOSED,
  LAST_CHANCE_NONE,
  hasGrades,
  LAST_CHANCE_WITHDRAWN,
  LAST_CHANCE_USED,
  lastChanceRunId,
  NOT_REVEALED,
  pickLastChance,
  scoreVisible,
  type RunRow,
  type ScenarioAnswers,
  type ScenarioDraft,
  type ScenarioRow,
} from '../features/play/types'
import { STARTERS } from '../seeds/starters'
import { STARTER_VARIANTS } from '../seeds/variants'
import { canPlay, fail, int, isGraded, loadAnswers, loadRun, loadScenario, ok, saveFailed, str } from './shared'

/** Most runs (first runs and rewinds together) one player may start in any 24 hours. */
export const RUNS_PER_DAY = 100
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * True when `userId` has started RUNS_PER_DAY runs in the last 24 hours. It
 * reads one row, the player's RUNS_PER_DAY-th newest run, and checks its
 * creation time (an ISO string the platform stamps). A failed read or a time
 * that does not parse counts as over the limit, so the check never lets runs
 * through by failing.
 */
export async function overRunLimit(tools: ActionTools, userId: string): Promise<boolean> {
  // `offset` is accepted by the records.query tool though ActionTools' type leaves it out.
  const options = { where: { playerId: userId }, orderBy: 'createdAt', orderDir: 'desc', limit: 1, offset: RUNS_PER_DAY - 1 }
  const res = await tools.query('runs', options as Parameters<ActionTools['query']>[1])
  if (!res.success) return true
  const nth = res.data.records[0]
  if (!nth) return false
  return !(Date.now() - Date.parse(nth.createdAt) >= DAY_MS)
}

const RUN_LIMIT_MESSAGE = `You have started ${RUNS_PER_DAY} runs in the last 24 hours. Try again later.`
const OLD_RUN = 'This run is from an older version of sequents and cannot continue. Start the scenario again.'
const SIGN_IN = 'Sign in to play.'

/** Bump when starter text changes; the next seed writes a new version of every starter. */
export const SEED_VERSION = 5

/** recordId of a starter's answers for one seed version; `n` is the hidden version (0 is the main one). */
export const starterAnswersId = (scenarioId: string, version: number, n = 0) =>
  n === 0 ? `${scenarioId}@v${version}` : `${scenarioId}@v${version}.${n}`

/** A uniform whole number in 0..count-1 from the platform's secure random source (no modulo bias). */
function randomBelow(count: number): number {
  const limit = Math.floor(0x100000000 / count) * count
  const word = new Uint32Array(1)
  do crypto.getRandomValues(word)
  while (word[0] >= limit)
  return word[0] % count
}

/**
 * Makes sure every starter exists at `version`. Pages call the seedStarters
 * action on load, for any signed-in user, so the gallery never depends on the
 * owner visiting first. The text comes from code, so a caller cannot change
 * it, and starters are owned by nobody (authorId ''), so who triggered the
 * write gives them no rights over it.
 *
 * Each starter is shuffled with a random source seeded by its id and version,
 * so every worker writes the same order. A starter may have extra hidden
 * versions in `variants` (keyed by starter id): each is shuffled with the
 * same seed as the main draft, so its readable half must come out identical
 * to the main one (apart from the average-score figure, which the readable
 * row sets to the mean over all versions); a starter whose versions differ is
 * not written and the seed fails. Each version gets its own answers row,
 * written before the readable row is pointed at them: a failure in between leaves the old text with the
 * old answers, and runs already started keep their own answers. Versions only
 * move forward: a worker still running older code never writes an older
 * version over a newer one. A starter is skipped only when it is at this
 * version, points at this version's answers, records the same number of
 * hidden versions and every answers row exists; otherwise it is written
 * again. Starters are always public.
 */
export async function seedStarterRows(
  tools: ActionTools,
  version: number,
  starters: ScenarioDraft[],
  variants: Record<string, ScenarioDraft[]> = STARTER_VARIANTS,
) {
  let written = 0
  for (const draft of starters) {
    const id = draft.id!
    const answersId = starterAnswersId(id, version)
    const extra = variants[id] ?? []
    const existing = await loadScenario(tools, id)
    if (existing && (existing.seedVersion ?? 0) > version) continue
    if (existing && existing.seedVersion === version && existing.answersId === answersId && (existing.variants ?? 0) === extra.length) {
      let complete = true
      for (let n = 0; n <= extra.length && complete; n++) complete = !!(await loadAnswers(tools, starterAnswersId(id, version, n)))
      if (complete) continue
    }
    // Every version is shuffled with the main version's seed, so the readable order is the same.
    const parts = [draft, ...extra].map((d) => splitDraft(shuffleDraft(d, seededRandom(answersId))))
    const readable = (p: (typeof parts)[number]) => JSON.stringify({ ...p.scenario, guessAverage: 0 })
    if (parts.some((p) => readable(p) !== readable(parts[0]))) {
      console.error(`[action] seedStarters: a hidden version of ${id} has different readable text`)
      return fail('That scenario could not be set up.')
    }
    for (let n = extra.length; n >= 0; n--) {
      const a = await tools.create('scenario_answers', { scenarioId: id, ...parts[n].answers }, starterAnswersId(id, version, n))
      if (!a.success) return saveFailed('seedStarters', a.error)
    }
    // The readable row's average is the mean over every version, so it fits whichever one a run gets.
    const guessAverage = Math.round((parts.reduce((sum, p) => sum + p.scenario.guessAverage, 0) / parts.length) * 10) / 10
    const row: ScenarioRow = {
      ...parts[0].scenario,
      guessAverage,
      format: FORMAT,
      visibility: 'public',
      starter: true,
      authorId: '',
      seedVersion: version,
      answersId,
      variants: extra.length,
    }
    const s = await tools.create('scenarios', { ...row }, id)
    if (!s.success) return saveFailed('seedStarters', s.error)
    written++
  }
  return ok({ written })
}

/**
 * The seed version this worker instance has already confirmed, so page loads
 * after the first skip the reads. Each instance checks once; a new deploy
 * starts new instances.
 */
let seededInThisInstance = 0

/** For tests: forget that this instance has seeded. */
export function resetSeedCache() {
  seededInThisInstance = 0
}

/** The fields of a run that are filled when it ends, as they are before then. */
const UNFINISHED = { score: 0, steps: [], fix: { decision: -1, gain: 0 }, beats: 0, ending: '', endingText: '' } as const

/**
 * What only the debrief shows: the grade and points of each decision, the
 * biggest single fix, the share of paths beaten and the tunnel counts. A
 * first try ends without them (its look-back shows the total and the ending
 * only), so its row holds nothing that says where the points went until
 * reveal, or the end of its last chance, writes them.
 */
function debriefFields(wayKeys: ScenarioAnswers['wayKeys'], choices: number[]): Pick<RunRow, 'steps' | 'fix' | 'beats' | 'tunnel'> {
  const { steps, score } = scoreRun(wayKeys, choices)
  return {
    steps,
    fix: bestSingleFix(wayKeys, choices),
    beats: beatsShare(analyse(wayKeys).scoreCounts, score),
    tunnel: tunnelCounts(wayKeys, choices),
  }
}

/** One decision of a finished run as the explain action reports it. */
export interface Explained {
  /** True when the reason may be shown: the way was best, or the player has tried 2+ choices here. */
  unlocked: boolean
  /** Why the way scored as it did; '' while locked. */
  why: string
  /** Label of the flag that changed this step; '' when none, or while locked. */
  flag: string
  /** How many different choices the player has finished runs with at this decision, this one included. */
  tried: number
}

/**
 * The runs started from first try `runId` (its last chance, and any extra
 * ones an earlier version allowed), oldest first; null when the lookup failed.
 */
async function childrenOf(tools: ActionTools, userId: string, runId: string) {
  const res = await tools.query('runs', {
    where: { playerId: userId, parentRunId: runId },
    orderBy: 'createdAt',
    orderDir: 'asc',
    limit: CHILDREN_READ,
  })
  return res.success ? res.data.records.map((r) => ({ recordId: r.recordId, data: r.data as unknown as RunRow })) : null
}

/**
 * The last-chance run started from `runId` (see pickLastChance): its id and
 * whether it is finished; undefined when there is none, or null when the
 * lookup failed (callers refuse then, so a failed read never lets a second
 * last chance or an early reveal through).
 */
export async function lastChanceOf(
  tools: ActionTools,
  userId: string,
  runId: string,
): Promise<{ id: string; done: boolean } | undefined | null> {
  const rows = await childrenOf(tools, userId, runId)
  return rows && pickLastChance(rows)
}

const RUNS_UNREADABLE = 'Could not load your runs. Try again.'
const LAST_CHANCE_OPEN = 'Finish your last chance first. When it ends you see where your points went on both tries.'

/** Finished runs the player may read through explain: at most this many are counted. */
const EXPLAIN_RUNS = 200

export const playActions: Record<string, ActionHandler<Env>> = {
  /** Makes sure the starters exist at the current seed version (see seedStarterRows). */
  seedStarters: async ({ tools }) => {
    if (seededInThisInstance >= SEED_VERSION) return ok({ written: 0 })
    const res = await seedStarterRows(tools, SEED_VERSION, STARTERS)
    if (res.success) seededInThisInstance = SEED_VERSION
    return res
  },

  /**
   * Starts a first run of a scenario the caller may play. A starter with
   * hidden versions gives the run one of them at random (see seedStarterRows);
   * the run keeps that answers id for good, rewinds included.
   */
  startRun: async ({ userId, params, tools }) => {
    if (!userId || isAnonymousUserId(userId)) return fail(SIGN_IN)
    const scenarioId = str(params.scenarioId)
    const scenario = await loadScenario(tools, scenarioId)
    if (!scenario || !isGraded(scenario) || !canPlay(scenario, userId)) return fail('That scenario is not available.')
    // A scenario whose answers are missing could not finish; refuse it up front.
    if (!isGraded(await loadAnswers(tools, scenario.answersId))) return fail('That scenario is not available.')
    if (await overRunLimit(tools, userId)) return fail(RUN_LIMIT_MESSAGE)
    // Each run gets one of the starter's hidden versions at random; a version whose answers are missing falls back to the main one.
    let answersId = scenario.answersId
    const n = randomBelow((scenario.variants ?? 0) + 1)
    if (n > 0 && isGraded(await loadAnswers(tools, `${scenario.answersId}.${n}`))) answersId = `${scenario.answersId}.${n}`
    const { title, situation, setting, decisions, guessAverage } = scenario
    const run: RunRow = {
      format: FORMAT,
      scenarioId,
      playerId: userId,
      parentRunId: '',
      branchAt: -1,
      snapshot: { title, situation, setting, decisions, guessAverage },
      answersId,
      choices: [],
      outcomes: [],
      approach: -1,
      approachAt: -1,
      status: 'playing',
      ...UNFINISHED,
      steps: [],
    }
    const res = await tools.create('runs', { ...run })
    if (!res.success) return saveFailed('startRun', res.error)
    return ok({ runId: res.data.recordId })
  },

  /**
   * Commits the caller's run to `approach` (0-2) at decision `decision`, the
   * next undecided one. The approach is stored on the run, so a reload or a
   * second tab cannot switch it, and choose accepts only a way inside it.
   * Committing again to the same approach changes nothing; a different one is
   * refused. The commit is stored with its decision number, so a commit that
   * arrives late, after that decision was locked in, cannot bind the next one.
   */
  commit: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const decision = int(params.decision)
    const approach = int(params.approach)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'playing') return fail('This run is already finished.')
    if (decision !== run.choices.length) return fail('That decision was already made. Reload the page to continue.')
    if (approach === null || approach < 0 || approach >= APPROACHES) return fail('Pick an approach.')
    const current = committedApproach(run)
    if (current === approach) return ok({ approach })
    if (current >= 0) return fail('You already chose an approach for this decision.')
    const res = await tools.update('runs', runId, { approach, approachAt: decision })
    if (!res.success) return saveFailed('commit', res.error)
    return ok({ approach })
  },

  /**
   * Locks in `choice` (approach * 3 + way) for decision `decision` of the
   * caller's run. `decision` must be the next undecided one, so a double
   * click or a stale tab cannot choose twice, and the way must belong to the
   * approach committed to there (see commit). On a rewound run, the decision
   * it was rewound to must get a different choice than the original. The
   * last choice ends the run with its score and ending. A first try opens its
   * look-back screen (debrief hidden, last chance open) and gets no grades on
   * its row yet. A last-chance run gets them (debriefFields), shows its
   * debrief at once and turns its first try's debrief on too, writing that
   * run's grades, since the last chance is now used. A last chance whose
   * first try's debrief already shows (the player chose to see it) is
   * refused. A run that
   * started may finish even if its scenario was made private since; its text
   * lives in the snapshot and its answers row never changes.
   */
  choose: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const decision = int(params.decision)
    const choice = params.choice
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'playing') return fail('This run is already finished.')
    if (decision !== run.choices.length) return fail('That decision was already made. Reload the page to continue.')
    if (!isChoice(choice)) return fail('Pick an approach and a way.')
    const committed = committedApproach(run)
    if (committed < 0) return fail('Choose an approach first.')
    if (fromChoice(choice).approach !== committed) return fail('That way belongs to a different approach than the one you chose.')
    const branching = run.branchAt >= 0 && decision === run.branchAt
    const parent = branching ? await loadRun(tools, run.parentRunId) : null
    if (run.parentRunId && runId === lastChanceRunId(run.parentRunId)) {
      // A last chance never finishes once its first try's debrief shows, so the debrief cannot guide it, even if a
      // reveal sent at the same moment as the rewind could not withdraw it (see rewind and reveal). A first try that
      // is gone shows no debrief, so its last chance plays on.
      const firstTry = parent ?? (await loadRun(tools, run.parentRunId))
      if (firstTry && scoreVisible(firstTry)) return fail(LAST_CHANCE_WITHDRAWN)
    }
    if (parent && parent.choices[decision] === choice) {
      return fail('You chose that last time. Rewinding is for trying a different choice.')
    }
    const answers = await loadAnswers(tools, run.answersId)
    if (!isGraded(answers)) return fail('This scenario is missing its answers.')

    // The new choice at the branch also settles every later decision: they keep the parent's choices.
    const choices = keepsLaterChoices(run, parent) ? [...run.choices, choice, ...parent.choices.slice(decision + 1)] : [...run.choices, choice]
    const details = replay(answers!.wayKeys, choices)
    const update: Partial<RunRow> = { choices, outcomes: details.map((d) => d.outcome), approach: -1, approachAt: -1 }
    const done = choices.length === DECISIONS
    if (done) {
      const { score, ending } = scoreRun(answers!.wayKeys, choices)
      update.status = 'done'
      update.score = score
      update.ending = ending
      update.endingText = answers!.endings[ending]
      update.hidden = run.parentRunId ? 0 : 1
      // A first try keeps its grades off its row until its debrief opens (see debriefFields).
      if (run.parentRunId) Object.assign(update, debriefFields(answers!.wayKeys, choices))
    }
    const res = await tools.update('runs', runId, update)
    if (!res.success) return saveFailed('choose', res.error)
    if (done && run.parentRunId) {
      // The last chance is used, so the first try's debrief may show, with its grades. It stays hidden when the first
      // try cannot be loaded or graded, or when another of its runs is unfinished (only runs saved by an earlier
      // version can have several). Then, or if this write fails, the first try keeps its look-back screen, which
      // links to the unfinished run or offers its own reveal; rewind stays refused because this run exists.
      const first = parent ?? (await loadRun(tools, run.parentRunId))
      const graded = first && first.status === 'done' && first.answersId === run.answersId && first.choices.length === DECISIONS
      const others = graded ? await childrenOf(tools, userId, run.parentRunId) : null
      if (graded && others && !others.some((r) => r.recordId !== runId && r.data.status !== 'done')) {
        const shown = await tools.update('runs', run.parentRunId, { hidden: 0, ...debriefFields(answers!.wayKeys, first.choices) })
        if (!shown.success) console.error('[action] choose: could not show the first try\'s debrief', shown.error)
      }
    }
    // The outcome is read from the run row; the reply only says whether the run ended.
    return ok({ done })
  },

  /**
   * The one last chance of a finished first try: starts a new run from it,
   * keeping every choice before `decision` and letting the player choose
   * again there. Choosing a different way at `decision` finishes the new run
   * (see choose): the decisions after it keep what the first try had. Each
   * first try gets one: a last-chance run cannot be rewound, nor a first try
   * that already has one or whose debrief the player chose to see (reveal).
   * The record API has no conditional write, so two requests sent at the same
   * instant can both pass the checks. The last-chance run therefore has a
   * fixed id (lastChanceRunId): two rewinds write the same row. And each of
   * rewind and reveal checks the other's write after its own: rewind reads
   * the first try again after creating, and reveal reads the last chance
   * after writing, so when the two overlap the reveal wins. Should that
   * withdrawal fail, choose still refuses to finish a last chance whose first
   * try's debrief shows, so the debrief can never guide it. Two rewinds sent at
   * once to different decisions leave the one row with the later write's
   * decision; both get its id.
   */
  rewind: async ({ userId, params, tools }) => {
    if (!userId || isAnonymousUserId(userId)) return fail(SIGN_IN)
    const runId = str(params.runId)
    const decision = int(params.decision)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'done') return fail('Finish the run before rewinding it.')
    if (run.parentRunId) return fail(LAST_CHANCE_USED)
    if (decision === null || decision < 0 || decision >= DECISIONS) return fail('Pick a decision to rewind to.')
    if (scoreVisible(run)) {
      // Its debrief shows because its last chance was used, or because the player chose to see it.
      const used = await lastChanceOf(tools, userId, runId)
      return fail(used ? LAST_CHANCE_USED : LAST_CHANCE_CLOSED)
    }
    if (hasGrades(run)) return fail(LAST_CHANCE_NONE)
    const scenario = await loadScenario(tools, run.scenarioId)
    if (!scenario || !canPlay(scenario, userId)) return fail('This scenario is no longer available.')
    // Not counted against the daily run limit: each first try (which is counted) gets at most this one run.
    // Checked last, right before the write, to keep the window for a second request small.
    const taken = await lastChanceOf(tools, userId, runId)
    if (taken === null) return fail(RUNS_UNREADABLE)
    if (taken) return fail(LAST_CHANCE_USED)
    const child: RunRow = {
      format: FORMAT,
      scenarioId: run.scenarioId,
      playerId: userId,
      parentRunId: runId,
      branchAt: decision,
      snapshot: run.snapshot,
      answersId: run.answersId,
      choices: run.choices.slice(0, decision),
      outcomes: run.outcomes.slice(0, decision),
      approach: -1,
      approachAt: -1,
      status: 'playing',
      ...UNFINISHED,
      steps: [],
    }
    const childId = lastChanceRunId(runId)
    const res = await tools.create('runs', { ...child }, childId)
    if (!res.success) return saveFailed('rewind', res.error)
    // A reveal that landed meanwhile wins: its debrief is showing, so this last chance must not be playable.
    const after = await loadRun(tools, runId)
    if (!after || scoreVisible(after)) {
      const removed = await tools.remove('runs', childId)
      if (!removed.success) console.error('[action] rewind: could not withdraw the last chance', removed.error)
      return fail(after ? LAST_CHANCE_CLOSED : RUNS_UNREADABLE)
    }
    return ok({ runId: childId })
  },

  /**
   * Lets the page show a finished first try's debrief (where every point
   * went), at the player's request. This closes its last chance: rewind
   * refuses a revealed run. While its last chance is still being played it
   * is refused, so the debrief cannot guide that choice; once the last chance
   * is finished it is allowed (choose normally reveals it already). A run
   * that is already revealed is fine and nothing is written. It also writes
   * the debrief's fields (debriefFields), which a first try ends without.
   * A last chance that a rewind started while this ran is withdrawn after the
   * write (see rewind).
   */
  reveal: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'done') return fail('Finish the run first.')
    if (scoreVisible(run)) return ok({ revealed: true })
    if (!run.parentRunId) {
      const chance = await lastChanceOf(tools, userId, runId)
      if (chance === null) return fail(RUNS_UNREADABLE)
      if (chance && !chance.done) return fail(LAST_CHANCE_OPEN)
    }
    const answers = await loadAnswers(tools, run.answersId)
    if (!isGraded(answers)) return fail('This scenario is missing its answers.')
    const res = await tools.update('runs', runId, { hidden: 0, ...debriefFields(answers!.wayKeys, run.choices) })
    if (!res.success) return saveFailed('reveal', res.error)
    if (!run.parentRunId) {
      const rows = await childrenOf(tools, userId, runId)
      if (!rows) console.error('[action] reveal: could not read the last chance after the reveal')
      for (const row of rows ?? []) {
        if (row.data.status === 'done') continue
        const removed = await tools.remove('runs', row.recordId)
        if (!removed.success) console.error('[action] reveal: could not withdraw the last chance', removed.error)
      }
    }
    return ok({ revealed: true })
  },

  /**
   * The reasons behind a finished run, one per decision. A best way's reason
   * is always shown. Any other reason, and the label of a flag that changed
   * the step, unlocks only once the player has finished runs with at least
   * two different choices at that decision on these same answers, so the
   * debrief cannot be read as an answer key after one try. It counts the run
   * being explained plus up to EXPLAIN_RUNS of the player's finished runs on
   * these answers, oldest started first. Below that many finished runs every
   * one counts, so an unlocked reason stays unlocked; past it, a choice tried
   * only in later runs counts only when the run being explained holds it.
   * A finished run whose debrief is not showing yet gets NOT_REVEALED.
   */
  explain: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'done') return fail('Finish the run first.')
    if (!scoreVisible(run)) return fail(NOT_REVEALED)
    const answers = await loadAnswers(tools, run.answersId)
    if (!isGraded(answers)) return fail('This scenario is missing its answers.')
    const mine = await tools.query('runs', {
      where: { playerId: userId, answersId: run.answersId, status: 'done' },
      orderBy: 'createdAt',
      orderDir: 'asc',
      limit: EXPLAIN_RUNS,
    })
    if (!mine.success) return fail('Could not load your runs. Try again.')
    const finished = [run.choices, ...mine.data.records.map((r) => (r.data as Partial<RunRow>).choices ?? [])]
    const labels = new Map(answers!.flags.map((f) => [f.id, f.label]))
    const decisions: Explained[] = replay(answers!.wayKeys, run.choices).map((step, d) => {
      const tried = new Set(finished.map((c) => c[d]).filter(isChoice)).size
      const unlocked = step.points === 0 || tried >= 2
      return {
        unlocked,
        why: unlocked ? step.why : '',
        flag: unlocked && step.flag ? (labels.get(step.flag) ?? '') : '',
        tried,
      }
    })
    return ok({ decisions })
  },
}
