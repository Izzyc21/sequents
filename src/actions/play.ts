/**
 * Playing: seed the starters, start a run, commit to an approach, lock in a
 * way, ask for a hint and reveal the score of a finished run, rewind, and
 * explain a finished run.
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
  gainsByDecision,
  hintFor,
  isChoice,
  replay,
  scoreRun,
  seededRandom,
  shuffleDraft,
  splitDraft,
  tunnelCounts,
} from '../features/play/engine'
import {
  ALREADY_REVEALED,
  APPROACHES,
  committedApproach,
  DECISIONS,
  FORMAT,
  keepsLaterChoices,
  NOT_REVEALED,
  scoreVisible,
  type RunRow,
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
   * last choice scores the run: grades and points per decision, the score,
   * the biggest single fix and the share of paths it beats, and opens its
   * look-back (score not yet revealed) with its tunnel counts. A run that
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
      const { steps, score, ending } = scoreRun(answers!.wayKeys, choices)
      update.status = 'done'
      update.score = score
      update.steps = steps
      update.fix = bestSingleFix(answers!.wayKeys, choices)
      update.beats = beatsShare(analyse(answers!.wayKeys).scoreCounts, score)
      update.ending = ending
      update.endingText = answers!.endings[ending]
      update.hidden = 1
      update.lookback = { hintGuess: -1, hint: '' }
      update.tunnel = tunnelCounts(answers!.wayKeys, choices)
    }
    const res = await tools.update('runs', runId, update)
    if (!res.success) return saveFailed('choose', res.error)
    // The outcome is read from the run row; the reply only says whether the run ended.
    return ok({ done })
  },

  /**
   * Starts a new run from a finished one, keeping every choice before
   * `decision` and letting the player choose again there. Choosing a
   * different way at `decision` finishes the new run (see choose): the
   * decisions after it keep what the finished run had.
   */
  rewind: async ({ userId, params, tools }) => {
    if (!userId || isAnonymousUserId(userId)) return fail(SIGN_IN)
    const runId = str(params.runId)
    const decision = int(params.decision)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'done') return fail('Finish the run before rewinding it.')
    if (decision === null || decision < 0 || decision >= DECISIONS) return fail('Pick a decision to rewind to.')
    const scenario = await loadScenario(tools, run.scenarioId)
    if (!scenario || !canPlay(scenario, userId)) return fail('This scenario is no longer available.')
    if (await overRunLimit(tools, userId)) return fail(RUN_LIMIT_MESSAGE)
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
    const res = await tools.create('runs', { ...child })
    if (!res.success) return saveFailed('rewind', res.error)
    return ok({ runId: res.data.recordId })
  },

  /**
   * One hint for a finished run whose score is still hidden: the player
   * names the decision they would change (`decision` 0-3, or 4 for "none")
   * and gets one line (hintFor). The guess and line are stored on the run,
   * and a later call returns the stored line and writes nothing, so a run has
   * one hint. It writes only `lookback`, never `hidden`, so a reveal sent at
   * the same time is never undone. Two hint calls sent at the same moment can
   * both write; the page shows the stored line, so it settles on one. A
   * revealed run, or one with no look-back state, gets ALREADY_REVEALED.
   */
  hint: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const decision = int(params.decision)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'done') return fail('Finish the run first.')
    if (!run.lookback || scoreVisible(run)) return fail(ALREADY_REVEALED)
    if (decision === null || decision < 0 || decision > DECISIONS) return fail('Pick a decision, or none.')
    if (run.lookback.hintGuess >= 0) return ok({ hint: run.lookback.hint })
    const answers = await loadAnswers(tools, run.answersId)
    if (!isGraded(answers)) return fail('This scenario is missing its answers.')
    const { steps, score } = scoreRun(answers!.wayKeys, run.choices)
    const hint = hintFor(decision, score, steps, gainsByDecision(answers!.wayKeys, run.choices))
    const res = await tools.update('runs', runId, { lookback: { hintGuess: decision, hint } })
    if (!res.success) return saveFailed('hint', res.error)
    return ok({ hint })
  },

  /**
   * Lets the page show a finished run's score and debrief. It writes only
   * `hidden`, so a hint stored at the same time stays. A run that is already
   * revealed, or has no look-back state, is fine and nothing is written.
   */
  reveal: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (!isGraded(run)) return fail(OLD_RUN)
    if (run.status !== 'done') return fail('Finish the run first.')
    if (scoreVisible(run)) return ok({ revealed: true })
    const res = await tools.update('runs', runId, { hidden: 0 })
    if (!res.success) return saveFailed('reveal', res.error)
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
   * A finished run whose score is not yet revealed gets NOT_REVEALED.
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
