/**
 * Moderation: the app owner can take down a scenario another player
 * published.
 *
 * This is an action and not a schema rule because a schema update rule
 * cannot be limited to one direction: letting the owner change any row's
 * visibility would also let them publish someone's private scenario. The
 * action only ever sets visibility to 'private', and the author can still
 * play it and publish it again.
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { fail, loadScenario, ok, saveFailed, str } from './shared'

export const moderateActions: Record<string, ActionHandler<Env>> = {
  /** Owner only: makes another player's published scenario private. */
  unpublish: async ({ userId, params, tools, env }) => {
    if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return fail('Only the app owner can do that.')
    const scenarioId = str(params.scenarioId)
    const scenario = await loadScenario(tools, scenarioId)
    if (!scenario) return fail('Scenario not found.')
    if (scenario.starter) return fail('Built-in scenarios stay public.')
    if (scenario.visibility !== 'public') return ok({ scenarioId })
    const res = await tools.update('scenarios', scenarioId, { visibility: 'private' })
    if (!res.success) return saveFailed('unpublish', res.error)
    return ok({ scenarioId })
  },
}
