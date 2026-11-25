import type { ScenarioDraft } from '../features/play/types'
import { phishingVersion1 } from './scenarios/phishing'

/**
 * Extra hidden versions of a starter, keyed by the starter's id. Each draft
 * holds the same readable half as the starter's main draft (title, situation,
 * setting, prompts, approach and way texts) and a different hidden half
 * (grades, flags, outcomes, whys, endings). startRun gives each run one
 * version at random; the player cannot choose.
 */
export const STARTER_VARIANTS: Record<string, ScenarioDraft[]> = {
  'starter-phishing': [phishingVersion1],
}
