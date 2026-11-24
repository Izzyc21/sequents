/**
 * Starter scenarios shown to every signed-in user, one file each in
 * ./scenarios.
 *
 * Each one is a ScenarioDraft: the same shape AI-written scenarios are mapped
 * into, so starters and generated scenarios go through the same split
 * (readable half -> `scenarios`, hidden half -> `scenario_answers`) and the
 * same checks (engine.test.ts runs checkScenario on every starter).
 *
 * This file is imported by worker code only. It holds the hidden half
 * (grades, outcomes, reasons, flags, endings), so a page must never import it.
 *
 * Changing any starter text means bumping SEED_VERSION in actions/play.ts so
 * the seed rewrites the rows.
 */
import type { ScenarioDraft } from '../features/play/types'
import angryCustomer from './scenarios/angry-customer'
import groupProject from './scenarios/group-project'
import phishing from './scenarios/phishing'
import raise from './scenarios/raise'
import rentIncrease from './scenarios/rent-increase'
import wifiDeadline from './scenarios/wifi-deadline'

export const STARTERS: ScenarioDraft[] = [wifiDeadline, raise, groupProject, angryCustomer, phishing, rentIncrease]
