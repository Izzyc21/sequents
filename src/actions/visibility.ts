/**
 * Who can make a scenario public or private.
 *
 * - setVisibility: the author publishes their own scenario or makes it private.
 * - unpublish: the app owner takes down another player's published scenario.
 *
 * Both are actions rather than schema rules. The schema lets nobody change a
 * scenario from the browser, because a takedown has to stick: if authors
 * could write `visibility` directly, they could publish a taken-down
 * scenario again, and a schema update rule cannot say "only while the owner
 * has not taken it down". setVisibility checks `takenDown`; unpublish sets it.
 *
 * While writing is off (WRITING_ENABLED), setVisibility refuses to publish;
 * making a scenario private and the owner's takedown still work.
 */
import { isAnonymousUserId, type ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { WRITING_ENABLED } from '../features/play/types'
import { fail, loadScenario, ok, saveFailed, str } from './shared'

export const TAKEN_DOWN = 'The app owner took this scenario down, so it cannot be published again.'

export const PUBLISHING_OFF = 'Publishing is turned off while writing your own scenario is off. You can still play it yourself.'

/** `writing` false makes setVisibility refuse every publish (see WRITING_ENABLED in features/play/types). */
export function makeVisibilityActions(writing: boolean): Record<string, ActionHandler<Env>> {
  return {
    /** Author only: sets their own scenario to 'public' or 'private'. */
    setVisibility: async ({ userId, params, tools }) => {
      if (!userId || isAnonymousUserId(userId)) return fail('Sign in to do that.')
      const visibility = params.visibility
      if (visibility !== 'public' && visibility !== 'private') return fail('Choose public or private.')
      const scenarioId = str(params.scenarioId)
      const scenario = await loadScenario(tools, scenarioId)
      // Someone else's scenario gets the same answer as a missing one.
      if (!scenario || scenario.authorId !== userId) return fail('Scenario not found.')
      if (scenario.starter) return fail('Built-in scenarios stay public.')
      if (visibility === 'public' && !writing) return fail(PUBLISHING_OFF)
      if (visibility === 'public' && scenario.takenDown) return fail(TAKEN_DOWN)
      if (scenario.visibility === visibility) return ok({ scenarioId, visibility })
      const res = await tools.update('scenarios', scenarioId, { visibility })
      if (!res.success) return saveFailed('setVisibility', res.error)
      if (visibility === 'public') {
        // The owner's takedown may have landed between the read above and this
        // write. Each store operation runs in order, so reading again now sees
        // it; if so, undo the publish.
        const after = await loadScenario(tools, scenarioId)
        if (!after || after.takenDown) {
          await tools.update('scenarios', scenarioId, { visibility: 'private' })
          return fail(TAKEN_DOWN)
        }
      }
      return ok({ scenarioId, visibility })
    },

    /**
     * Owner only: makes another player's scenario private for good. The author
     * can still play it but can no longer publish it.
     */
    unpublish: async ({ userId, params, tools, env }) => {
      if (!env.OWNER_USER_ID || userId !== env.OWNER_USER_ID) return fail('Only the app owner can do that.')
      const scenarioId = str(params.scenarioId)
      const scenario = await loadScenario(tools, scenarioId)
      if (!scenario) return fail('Scenario not found.')
      if (scenario.starter) return fail('Built-in scenarios stay public.')
      if (scenario.visibility === 'private' && scenario.takenDown) return ok({ scenarioId })
      // Set even if the author made it private a moment ago, so it cannot come back.
      const res = await tools.update('scenarios', scenarioId, { visibility: 'private', takenDown: true })
      if (!res.success) return saveFailed('unpublish', res.error)
      return ok({ scenarioId })
    },
  }
}

export const visibilityActions = makeVisibilityActions(WRITING_ENABLED)
