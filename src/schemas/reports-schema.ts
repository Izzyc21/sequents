/**
 * Step reports: one row per tester per step, saying whether they got through
 * it ("done") or got stuck ("stuck"), plus an optional note.
 *
 * The rules that keep this honest are all server-side:
 * - `testerId` is `userBound`: DeepSpace fills it with the caller's own id, so
 *   nobody can file a report in someone else's name.
 * - `uniqueOn` [funnelId, stepId, testerId]: a tester has at most ONE report
 *   per step. Changing "stuck" to "done" updates that row instead of adding one.
 * - member read 'own': a tester only ever receives their own reports. The
 *   server drops other testers' rows before anything reaches the browser.
 * - admin read true: the team sees every report, which powers the dashboard.
 */
import type { CollectionSchema } from 'deepspace/schema'

export type Outcome = 'done' | 'stuck'

export interface StepReport {
  funnelId: string
  stepId: string
  outcome: Outcome
  note: string
  testerId: string
}

const nothing = { read: false, create: false, update: false, delete: false } as const

export const reportsSchema: CollectionSchema = {
  name: 'step_reports',
  columns: [
    { name: 'funnelId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'stepId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'outcome',
      storage: 'text',
      interpretation: { kind: 'select', options: ['done', 'stuck'] },
      required: true,
    },
    { name: 'note', storage: 'text', interpretation: 'plain', maxLength: 1000 },
    { name: 'testerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
  ],
  uniqueOn: ['funnelId', 'stepId', 'testerId'],
  ownerField: 'testerId',
  permissions: {
    '*': nothing,
    viewer: nothing,
    member: {
      read: 'own',
      create: true,
      update: 'own',
      delete: 'own',
      // testerId is stamped by the server, so the client may only send these.
      writableFields: ['funnelId', 'stepId', 'outcome', 'note'],
    },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
