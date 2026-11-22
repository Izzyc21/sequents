/**
 * Funnels: the ordered list of steps a team wants testers to walk through
 * (for example Install -> Scaffold -> Run locally -> Deploy).
 *
 * Who can do what (enforced by DeepSpace on the server, not in the UI):
 * - signed-out visitors: nothing
 * - member (any signed-in tester): read funnels so they can follow the steps
 * - admin (the app owner, plus anyone they promote): create, edit, delete
 */
import type { CollectionSchema } from 'deepspace/schema'

/** One step inside a funnel. Stored as JSON in the `steps` column. */
export interface FunnelStep {
  /** Stable id so reports still match a step after it is renamed or moved. */
  id: string
  title: string
  /** Optional instructions shown to the tester, e.g. a command to run. */
  hint?: string
}

export interface Funnel {
  name: string
  description: string
  steps: FunnelStep[]
}

const nothing = { read: false, create: false, update: false, delete: false } as const

export const funnelsSchema: CollectionSchema = {
  name: 'funnels',
  columns: [
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, maxLength: 80 },
    { name: 'description', storage: 'text', interpretation: 'plain', maxLength: 500 },
    { name: 'steps', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: {
    '*': nothing,
    viewer: nothing,
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
