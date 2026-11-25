/**
 * Helpers every action uses: result builders, parameter parsing, typed record
 * loaders and the one access rule for scenarios.
 *
 * Action tools run with per-record permissions OFF (see
 * src/server/action-routes.ts), so these loaders return any row. Each action
 * checks ownership or canPlay itself before acting on what it loaded.
 */
import type { ActionResult, ActionTools } from 'deepspace/worker'
import { FORMAT, WRITING_ENABLED, type RunRow, type ScenarioAnswers, type ScenarioRow } from '../features/play/types'

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function fail(error: string): ActionResult<never> {
  return { success: false, error }
}

/**
 * For a failed record write: logs the storage error for the app's logs and
 * gives the browser a plain message, so internal error text never reaches it.
 */
export function saveFailed(action: string, error: string): ActionResult<never> {
  console.error(`[action] ${action} write failed: ${error}`)
  return fail('Something went wrong saving that. Try again.')
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** A whole number, or null for anything else (so `0` is kept and `'0'` is refused). */
export function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

async function load<T extends Record<string, unknown>>(
  tools: ActionTools,
  collection: string,
  recordId: string,
): Promise<T | null> {
  if (!recordId) return null
  const res = await tools.get<T>(collection, recordId)
  return res.success ? res.data.record.data : null
}

export const loadScenario = (tools: ActionTools, id: string) =>
  load<ScenarioRow & Record<string, unknown>>(tools, 'scenarios', id)

/** Loads a `scenario_answers` row by its recordId (a scenario's or run's `answersId`). */
export const loadAnswers = (tools: ActionTools, answersId: string) =>
  load<ScenarioAnswers & Record<string, unknown>>(tools, 'scenario_answers', answersId)

export const loadRun = (tools: ActionTools, id: string) => load<RunRow & Record<string, unknown>>(tools, 'runs', id)

/**
 * Who may start a run on a scenario: its author always, anyone signed in on a
 * public one. While `writing` is off (WRITING_ENABLED), other players'
 * scenarios are not playable even when public, so scenarios the AI wrote
 * before it was turned off reach only their authors; starters stay public.
 */
export function canPlay(
  scenario: Pick<ScenarioRow, 'visibility' | 'authorId' | 'takenDown' | 'starter'>,
  userId: string,
  writing: boolean = WRITING_ENABLED,
): boolean {
  // A taken-down scenario stays playable only by its author, even if a late
  // write left it public (see setVisibility).
  if (scenario.authorId !== '' && scenario.authorId === userId) return true
  if (!writing && !scenario.starter) return false
  return scenario.visibility === 'public' && !scenario.takenDown
}

/**
 * True for rows written in the graded shape (`format: 2`). Rows from the
 * first version (no format) have a different shape and cannot be played or
 * scored by this code.
 */
export function isGraded(row: { format?: unknown } | null): boolean {
  return row?.format === FORMAT
}
