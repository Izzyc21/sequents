/**
 * `scenario_answers`: the hidden half of each scenario (recordId = the
 * scenario's answersId): every way's grade, outcome and why, the flags and
 * their overrides, and the endings.
 *
 * No role can read or write it. The record room drops rows a caller cannot
 * read before anything is sent over the WebSocket, so the answers never reach
 * a browser. Only server actions (startRun, choose, explain) open it.
 */
import type { CollectionSchema } from 'deepspace/schema'

const nothing = { read: false, create: false, update: false, delete: false } as const

export const scenarioAnswersSchema: CollectionSchema = {
  name: 'scenario_answers',
  columns: [
    { name: 'scenarioId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'format', storage: 'number', interpretation: 'plain' },
    { name: 'wayKeys', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'flags', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'endings', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: { '*': nothing, viewer: nothing, member: nothing, admin: nothing },
}
