/**
 * `scenarios`: the readable half of each scenario (see features/play/types.ts).
 *
 * Who can do what (enforced by DeepSpace on the server, not in the UI):
 * - signed-out visitors and viewers: nothing
 * - member and admin: read public scenarios and their own ('published' =
 *   owner OR visibility is 'public')
 * - nobody creates, changes or deletes from the browser. Rows are written by
 *   the seedStarters and makeScenario actions, which also write the hidden
 *   half, so a scenario never exists without its answers. Publishing goes
 *   through the setVisibility action so an owner takedown sticks (see
 *   actions/visibility.ts). No deletes means runs that point at a scenario
 *   never lose it.
 */
import type { CollectionSchema } from 'deepspace/schema'

const nothing = { read: false, create: false, update: false, delete: false } as const

export const scenariosSchema: CollectionSchema = {
  name: 'scenarios',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'situation', storage: 'text', interpretation: 'plain' },
    { name: 'setting', storage: 'text', interpretation: 'plain' },
    // 2 for graded scenarios; missing on scenarios from the first version, which pages hide.
    { name: 'format', storage: 'number', interpretation: 'plain' },
    { name: 'decisions', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'guessAverage', storage: 'number', interpretation: 'plain' },
    {
      name: 'visibility',
      storage: 'text',
      interpretation: { kind: 'select', options: ['private', 'public'] },
      required: true,
    },
    { name: 'starter', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'authorId', storage: 'text', interpretation: 'plain' },
    { name: 'seedVersion', storage: 'number', interpretation: 'plain' },
    { name: 'answersId', storage: 'text', interpretation: 'plain', required: true },
    // Starters only: the number of extra hidden versions of the answers (missing = 0).
    { name: 'variants', storage: 'number', interpretation: 'plain' },
    // Set by the owner's unpublish action; setVisibility then refuses 'public'.
    { name: 'takenDown', storage: 'number', interpretation: { kind: 'boolean' } },
  ],
  ownerField: 'authorId',
  // String form: a row is public when data.visibility === 'public'.
  visibilityField: 'visibility',
  permissions: {
    '*': nothing,
    viewer: nothing,
    member: { read: 'published', create: false, update: false, delete: false },
    admin: { read: 'published', create: false, update: false, delete: false },
  },
}
