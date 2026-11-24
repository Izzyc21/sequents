/**
 * `scenarios`: the readable half of each scenario (see features/play/types.ts).
 *
 * Who can do what (enforced by DeepSpace on the server, not in the UI):
 * - signed-out visitors and viewers: nothing
 * - member: read public scenarios and their own ('published' = owner OR
 *   visibility is 'public'); change only the visibility of their own
 * - admin: the same as member. An update rule cannot be limited to one
 *   direction, so letting admins hide any scenario would also let them publish
 *   someone else's private one.
 * - nobody creates or deletes from the browser. Rows are written by the
 *   seedStarters and makeScenario actions, which also write the hidden half,
 *   so a scenario never exists without its answers. No deletes means runs
 *   that point at a scenario never lose it.
 */
import type { CollectionSchema } from 'deepspace/schema'

const nothing = { read: false, create: false, update: false, delete: false } as const

export const scenariosSchema: CollectionSchema = {
  name: 'scenarios',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'situation', storage: 'text', interpretation: 'plain' },
    { name: 'setting', storage: 'text', interpretation: 'plain' },
    { name: 'meters', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'scenes', storage: 'text', interpretation: { kind: 'json' } },
    {
      name: 'visibility',
      storage: 'text',
      interpretation: { kind: 'select', options: ['private', 'public'] },
      required: true,
    },
    { name: 'starter', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'authorId', storage: 'text', interpretation: 'plain' },
    { name: 'seedVersion', storage: 'number', interpretation: 'plain' },
    { name: 'answersId', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'authorId',
  // String form: a row is public when data.visibility === 'public'.
  visibilityField: 'visibility',
  permissions: {
    '*': nothing,
    viewer: nothing,
    member: { read: 'published', create: false, update: 'own', delete: false, writableFields: ['visibility'] },
    admin: { read: 'published', create: false, update: 'own', delete: false, writableFields: ['visibility'] },
  },
}
