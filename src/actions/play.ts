/**
 * Playing: seed the starters, start a run, make a pick, rewind.
 *
 * The browser never writes runs itself (the schema forbids it). Every move
 * comes through here so the server can check it is legal and apply the
 * hidden meter changes, which the browser never sees ahead of a pick.
 */
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { applyDelta, endingFor, splitDraft } from '../features/play/engine'
import { OPTIONS, SCENES, type RunRow, type ScenarioDraft, type ScenarioRow } from '../features/play/types'
import { STARTERS } from '../seeds/starters'
import { canPlay, fail, int, loadAnswers, loadRun, loadScenario, ok, saveFailed, str } from './shared'

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

/** Bump when starter text changes; the next seed writes a new version of every starter. */
export const SEED_VERSION = 1

/** recordId of a starter's answers for one seed version. */
export const starterAnswersId = (scenarioId: string, version: number) => `${scenarioId}@v${version}`

/**
 * Makes sure every starter exists at `version`. Pages call the seedStarters
 * action on load, for any signed-in user, so the gallery never depends on the
 * owner visiting first. The text comes from code, so a caller cannot change
 * it, and starters are owned by nobody (authorId ''), so who triggered the
 * write gives them no rights over it.
 *
 * Each version gets its own answers row, written before the readable row is
 * pointed at it: a failure in between leaves the old text with the old
 * answers, and runs already started keep their own answers. Versions only move
 * forward: a worker still running older code never writes an older version
 * over a newer one. A starter is skipped only when it is at this version,
 * points at this version's answers and those answers exist; otherwise it is
 * written again. Starters are always public.
 */
export async function seedStarterRows(tools: ActionTools, version: number, starters: ScenarioDraft[]) {
  let written = 0
  for (const draft of starters) {
    const id = draft.id!
    const answersId = starterAnswersId(id, version)
    const existing = await loadScenario(tools, id)
    if (existing && (existing.seedVersion ?? 0) > version) continue
    if (existing && existing.seedVersion === version && existing.answersId === answersId && (await loadAnswers(tools, answersId))) {
      continue
    }
    const { scenario, answers } = splitDraft(draft)
    const a = await tools.create('scenario_answers', { scenarioId: id, ...answers }, answersId)
    if (!a.success) return saveFailed('seedStarters', a.error)
    const row: ScenarioRow = {
      ...scenario,
      visibility: 'public',
      starter: true,
      authorId: '',
      seedVersion: version,
      answersId,
    }
    const s = await tools.create('scenarios', { ...row }, id)
    if (!s.success) return saveFailed('seedStarters', s.error)
    written++
  }
  return ok({ written })
}

/**
 * The seed version this worker instance has already confirmed, so page loads
 * after the first skip the twelve reads. Each instance checks once; a new
 * deploy starts new instances.
 */
let seededInThisInstance = 0

/** For tests: forget that this instance has seeded. */
export function resetSeedCache() {
  seededInThisInstance = 0
}

export const playActions: Record<string, ActionHandler<Env>> = {
  /** Makes sure the starters exist at the current seed version (see seedStarterRows). */
  seedStarters: async ({ tools }) => {
    if (seededInThisInstance >= SEED_VERSION) return ok({ written: 0 })
    const res = await seedStarterRows(tools, SEED_VERSION, STARTERS)
    if (res.success) seededInThisInstance = SEED_VERSION
    return res
  },

  /** Starts a first run of a scenario the caller may play. */
  startRun: async ({ userId, params, tools }) => {
    const scenarioId = str(params.scenarioId)
    const scenario = await loadScenario(tools, scenarioId)
    if (!scenario || !canPlay(scenario, userId)) return fail('That scenario is not available.')
    // A scenario whose answers are missing could not finish; refuse it up front.
    if (!(await loadAnswers(tools, scenario.answersId))) return fail('That scenario is not available.')
    if (await overRunLimit(tools, userId)) return fail(RUN_LIMIT_MESSAGE)
    const { title, situation, setting, meters, scenes } = scenario
    const run: RunRow = {
      scenarioId,
      playerId: userId,
      parentRunId: '',
      branchAt: -1,
      snapshot: { title, situation, setting, meters, scenes },
      answersId: scenario.answersId,
      choices: [],
      meterHistory: [meters.map((m) => m.start)],
      outcomes: [],
      status: 'playing',
      ending: '',
      endingText: '',
      debrief: [],
    }
    const res = await tools.create('runs', { ...run })
    if (!res.success) return saveFailed('startRun', res.error)
    return ok({ runId: res.data.recordId })
  },

  /**
   * Makes the pick for decision `scene` of the caller's run. `scene` must be
   * the next undecided one, so a double click or a stale tab cannot pick twice.
   * On a rewound run, the decision it was rewound to must differ from the
   * original pick. A run that started may finish even if its scenario was
   * made private since; its text lives in the run's snapshot and its answers
   * row never changes.
   */
  choose: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const scene = int(params.scene)
    const option = int(params.option)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (run.status !== 'playing') return fail('This run is already finished.')
    if (scene !== run.choices.length) return fail('That decision was already made. Reload the page to continue.')
    if (option === null || option < 0 || option >= OPTIONS) return fail('Pick one of the three options.')
    if (run.branchAt >= 0 && scene === run.branchAt) {
      const parent = await loadRun(tools, run.parentRunId)
      if (parent && parent.choices[scene] === option) {
        return fail('You picked that last time. Rewinding is for trying a different option.')
      }
    }
    const answers = await loadAnswers(tools, run.answersId)
    if (!answers) return fail('This scenario is missing its answers.')

    const effect = answers.effects[scene][option]
    const meters = applyDelta(run.meterHistory[run.meterHistory.length - 1], effect.delta)
    const choices = [...run.choices, option]
    const update: Partial<RunRow> = {
      choices,
      meterHistory: [...run.meterHistory, meters],
      outcomes: [...run.outcomes, effect.outcome],
    }
    const done = choices.length === SCENES
    if (done) {
      const ending = endingFor(meters)
      update.status = 'done'
      update.ending = ending
      update.endingText = answers.endings[ending]
      update.debrief = choices.map((c, i) => ({ kind: answers.effects[i][c].kind, why: answers.effects[i][c].why }))
    }
    const res = await tools.update('runs', runId, update)
    if (!res.success) return saveFailed('choose', res.error)
    return ok({ outcome: effect.outcome, meters, done })
  },

  /**
   * Starts a new run from a finished one, keeping every pick before
   * `decision` and letting the player choose again from there.
   */
  rewind: async ({ userId, params, tools }) => {
    const runId = str(params.runId)
    const decision = int(params.decision)
    const run = await loadRun(tools, runId)
    if (!run || run.playerId !== userId) return fail('Run not found.')
    if (run.status !== 'done') return fail('Finish the run before rewinding it.')
    if (decision === null || decision < 0 || decision >= SCENES) return fail('Pick a decision to rewind to.')
    const scenario = await loadScenario(tools, run.scenarioId)
    if (!scenario || !canPlay(scenario, userId)) return fail('This scenario is no longer available.')
    if (await overRunLimit(tools, userId)) return fail(RUN_LIMIT_MESSAGE)
    const child: RunRow = {
      scenarioId: run.scenarioId,
      playerId: userId,
      parentRunId: runId,
      branchAt: decision,
      snapshot: run.snapshot,
      answersId: run.answersId,
      choices: run.choices.slice(0, decision),
      meterHistory: run.meterHistory.slice(0, decision + 1),
      outcomes: run.outcomes.slice(0, decision),
      status: 'playing',
      ending: '',
      endingText: '',
      debrief: [],
    }
    const res = await tools.create('runs', { ...child })
    if (!res.success) return saveFailed('rewind', res.error)
    return ok({ runId: res.data.recordId })
  },
}
