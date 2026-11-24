/**
 * Server actions, exposed at POST /api/actions/<name> to signed-in callers
 * (src/server/action-routes.ts verifies the caller first).
 */
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { generateActions } from './generate'
import { visibilityActions } from './visibility'
import { playActions } from './play'

export const actions: Record<string, ActionHandler<Env>> = {
  ...playActions,
  ...generateActions,
  ...visibilityActions,
}
