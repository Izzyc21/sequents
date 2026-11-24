/**
 * `scenario_answers`: the hidden half of each scenario. One row per scenario,
 * with the same recordId: what every option does to the meters, its outcome
 * text, whether it was the best, ok or trap pick and why, and the endings.
 *
 * No role can read or write it. The record room drops rows a caller cannot
 * read before anything is sent over the WebSocket, so the answers never reach
 * a browser. Only server actions (startRun, choose) open it, one pick at a time.
 */
import type { CollectionSchema } from 'deepspace/schema'

const nothing = { read: false, create: false, update: false, delete: false } as const

export const scenarioAnswersSchema: CollectionSchema = {
  name: 'scenario_answers',
  columns: [
    { name: 'scenarioId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'effects', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'endings', storage: 'text', interpretation: { kind: 'json' } },
  ],
  permissions: { '*': nothing, viewer: nothing, member: nothing, admin: nothing },
}
