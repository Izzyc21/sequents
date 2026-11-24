/**
 * Playing: seed the starters, start a run, make a pick, rewind.
 *
 * The browser never writes runs itself (the schema forbids it). Every move
 * comes through here so the server can check it is legal and apply the
 * hidden meter changes, which the browser never sees ahead of a pick.
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { applyDelta, endingFor, splitDraft } from '../features/play/engine'
import { OPTIONS, SCENES, type RunRow, type ScenarioRow } from '../features/play/types'
import { STARTERS } from '../seeds/starters'
import { canPlay, fail, int, loadAnswers, loadRun, loadScenario, ok, str } from './shared'

/** Bump when starter text changes; the next seed rewrites every starter. */
export const SEED_VERSION = 1

export const playActions: Record<string, ActionHandler<Env>> = {
  /**
   * Writes the six starters if they are missing or out of date. Only the app
   * owner's call does anything (pages call it on load); for everyone else it
   * returns at once without reading. Answers are written before the readable
   * row, so a starter never shows up without them.
   */
  seedStarters: async ({ userId, tools, env }) => {
    if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return ok({ skipped: true })
    let written = 0
    for (const draft of STARTERS) {
      const id = draft.id!
      const existing = await loadScenario(tools, id)
      if (existing && existing.seedVersion === SEED_VERSION) continue
      const { scenario, answers } = splitDraft(draft)
      const a = await tools.create('scenario_answers', { scenarioId: id, ...answers }, id)
      if (!a.success) return fail(a.error)
      const row: ScenarioRow = { ...scenario, visibility: 'public', starter: true, authorId: '', seedVersion: SEED_VERSION }
      const s = await tools.create('scenarios', { ...row }, id)
      if (!s.success) return fail(s.error)
      written++
    }
    return ok({ written })
  },

  /** Starts a first run of a scenario the caller may play. */
  startRun: async ({ userId, params, tools }) => {
    const scenarioId = str(params.scenarioId)
    const scenario = await loadScenario(tools, scenarioId)
    if (!scenario || !canPlay(scenario, userId)) return fail('That scenario is not available.')
    const { title, situation, setting, meters, scenes } = scenario
    const run: RunRow = {
      scenarioId,
      playerId: userId,
      parentRunId: '',
      branchAt: -1,
      snapshot: { title, situation, setting, meters, scenes },
      choices: [],
      meterHistory: [meters.map((m) => m.start)],
      outcomes: [],
      status: 'playing',
      ending: '',
      endingText: '',
      debrief: [],
    }
    const res = await tools.create('runs', { ...run })
    if (!res.success) return fail(res.error)
    return ok({ runId: res.data.recordId })
  },

  /**
   * Makes the pick for decision `scene` of the caller's run. `scene` must be
   * the next undecided one, so a double click or a stale tab cannot pick twice.
   * On a rewound run, the decision it was rewound to must differ from the
   * original pick. A run that started may finish even if its scenario was
   * made private since; its text lives in the run's snapshot.
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
    const answers = await loadAnswers(tools, run.scenarioId)
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
    if (!res.success) return fail(res.error)
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
    const child: RunRow = {
      scenarioId: run.scenarioId,
      playerId: userId,
      parentRunId: runId,
      branchAt: decision,
      snapshot: run.snapshot,
      choices: run.choices.slice(0, decision),
      meterHistory: run.meterHistory.slice(0, decision + 1),
      outcomes: run.outcomes.slice(0, decision),
      status: 'playing',
      ending: '',
      endingText: '',
      debrief: [],
    }
    const res = await tools.create('runs', { ...child })
    if (!res.success) return fail(res.error)
    return ok({ runId: res.data.recordId })
  },
}
