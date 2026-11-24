/**
 * `runs`: one play-through of a scenario by one player. A rewind creates a
 * new run that points at the run it came from (parentRunId) and the decision
 * where it splits (branchAt), so the two can be compared.
 *
 * Players only ever receive their own runs (read 'own' on playerId). Nobody
 * writes runs from the browser: the startRun, choose and rewind actions do,
 * after checking the move is legal, so a player cannot set their own meters.
 */
import type { CollectionSchema } from 'deepspace/schema'

const nothing = { read: false, create: false, update: false, delete: false } as const
const ownReadOnly = { read: 'own', create: false, update: false, delete: false } as const

export const runsSchema: CollectionSchema = {
  name: 'runs',
  columns: [
    { name: 'scenarioId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'playerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'parentRunId', storage: 'text', interpretation: 'plain' },
    { name: 'branchAt', storage: 'number', interpretation: 'plain' },
    { name: 'snapshot', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'answersId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'choices', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'meterHistory', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'outcomes', storage: 'text', interpretation: { kind: 'json' } },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['playing', 'done'] },
      required: true,
    },
    { name: 'ending', storage: 'text', interpretation: 'plain' },
    { name: 'endingText', storage: 'text', interpretation: 'plain' },
    { name: 'debrief', storage: 'text', interpretation: { kind: 'json' } },
  ],
  ownerField: 'playerId',
  permissions: { '*': nothing, viewer: nothing, member: ownReadOnly, admin: ownReadOnly },
}
