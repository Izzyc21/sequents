/**
 * Helpers every action uses: result builders, parameter parsing, typed record
 * loaders and the one access rule for scenarios.
 *
 * Action tools run with per-record permissions OFF (see
 * src/server/action-routes.ts), so these loaders return any row. Each action
 * checks ownership or canPlay itself before acting on what it loaded.
 */
import type { ActionResult, ActionTools } from 'deepspace/worker'
import type { RunRow, ScenarioAnswers, ScenarioRow } from '../features/play/types'

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function fail(error: string): ActionResult<never> {
  return { success: false, error }
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

export const loadAnswers = (tools: ActionTools, scenarioId: string) =>
  load<ScenarioAnswers & Record<string, unknown>>(tools, 'scenario_answers', scenarioId)

export const loadRun = (tools: ActionTools, id: string) => load<RunRow & Record<string, unknown>>(tools, 'runs', id)

/** Anyone signed in may play a public scenario; a private one only its author. */
export function canPlay(scenario: Pick<ScenarioRow, 'visibility' | 'authorId'>, userId: string): boolean {
  return scenario.visibility === 'public' || (scenario.authorId !== '' && scenario.authorId === userId)
}
