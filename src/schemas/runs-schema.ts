/**
 * `runs`: one play-through of a scenario by one player. A rewind creates a
 * new run that points at the run it came from (parentRunId) and the decision
 * where it splits (branchAt), so the two can be compared.
 *
 * Players only ever receive their own runs (read 'own' on playerId). Nobody
 * writes runs from the browser: the startRun, commit, choose and rewind actions do,
 * after checking the move is legal, so a player cannot set their own score.
 * A run holds grades and points once it ends, never the reasons: those come
 * from the explain action once unlocked. The hint and reveal actions write the
 * look-back column.
 */
import type { CollectionSchema } from 'deepspace/schema'

const nothing = { read: false, create: false, update: false, delete: false } as const
const ownReadOnly = { read: 'own', create: false, update: false, delete: false } as const

export const runsSchema: CollectionSchema = {
  name: 'runs',
  columns: [
    // 2 for runs of the graded version; missing on runs from the first version.
    { name: 'format', storage: 'number', interpretation: 'plain' },
    { name: 'scenarioId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'playerId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'parentRunId', storage: 'text', interpretation: 'plain' },
    { name: 'branchAt', storage: 'number', interpretation: 'plain' },
    { name: 'snapshot', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'answersId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'choices', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'outcomes', storage: 'text', interpretation: { kind: 'json' } },
    // The approach committed to at the next decision; -1 when none (see RunRow.approach).
    { name: 'approach', storage: 'number', interpretation: 'plain' },
    // The decision that approach was committed at (see RunRow.approachAt).
    { name: 'approachAt', storage: 'number', interpretation: 'plain' },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['playing', 'done'] },
      required: true,
    },
    { name: 'score', storage: 'number', interpretation: 'plain' },
    { name: 'steps', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'fix', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'beats', storage: 'number', interpretation: 'plain' },
    { name: 'ending', storage: 'text', interpretation: 'plain' },
    { name: 'endingText', storage: 'text', interpretation: 'plain' },
    // Look-back state of a finished run: { revealed, hintGuess, hint } (see RunRow.lookback). Json because stored booleans are not read back as booleans.
    { name: 'lookback', storage: 'text', interpretation: { kind: 'json' } },
    // Good endings still reachable after the first 0-4 choices (see RunRow.tunnel).
    { name: 'tunnel', storage: 'text', interpretation: { kind: 'json' } },
  ],
  ownerField: 'playerId',
  permissions: { '*': nothing, viewer: nothing, member: ownReadOnly, admin: ownReadOnly },
}
