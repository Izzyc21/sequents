/**
 * `generations`: one row per call to the scenario writer, written before the
 * call is made, so a call that fails or times out still counts. The
 * makeScenario action counts these rows to cap calls per user per day and for
 * the whole app per day.
 *
 * No role can read or write it; only that action touches it.
 */
import type { CollectionSchema } from 'deepspace/schema'

const nothing = { read: false, create: false, update: false, delete: false } as const

export const generationsSchema: CollectionSchema = {
  name: 'generations',
  columns: [
    /** `${userId}_${YYYY-MM-DD}` (UTC day): the per-user daily count looks this up. */
    { name: 'userDay', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    /** `YYYY-MM-DD` (UTC day): the app-wide daily count looks this up. */
    { name: 'appDay', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    /** Set to true once the call produced a saved scenario. */
    { name: 'ok', storage: 'number', interpretation: { kind: 'boolean' } },
  ],
  permissions: { '*': nothing, viewer: nothing, member: nothing, admin: nothing },
}
