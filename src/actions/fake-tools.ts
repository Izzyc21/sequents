/**
 * In-memory stand-in for the record tools an action receives, for unit tests.
 * Like the real tools it ignores permissions; create with a recordId merges
 * into an existing row, query filters by exact match and honours limit.
 */
import type { ActionTools } from 'deepspace/worker'

type Row = { recordId: string; createdBy: string; data: Record<string, unknown> }

export function fakeTools(userId: string, store = new Map<string, Map<string, Row>>()) {
  const table = (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    return store.get(name)!
  }
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  const notFound = { success: false as const, error: 'Record not found', code: 'RECORD_NOT_FOUND' }

  const tools = {
    async create(collection: string, data: Record<string, unknown>, recordId?: string) {
      const id = recordId ?? `rec_${crypto.randomUUID()}`
      const existing = table(collection).get(id)
      table(collection).set(id, {
        recordId: id,
        createdBy: existing?.createdBy ?? userId,
        data: { ...existing?.data, ...clone(data) },
      })
      return { success: true as const, data: { recordId: id } }
    },
    async update(collection: string, recordId: string, data: Record<string, unknown>) {
      const row = table(collection).get(recordId)
      if (!row) return notFound
      row.data = { ...row.data, ...clone(data) }
      return { success: true as const, data: { recordId } }
    },
    async get(collection: string, recordId: string) {
      const row = table(collection).get(recordId)
      return row ? { success: true as const, data: { record: clone(row) } } : notFound
    },
    async query(collection: string, options: { where?: Record<string, unknown>; limit?: number } = {}) {
      const where = options.where ?? {}
      const records = [...table(collection).values()]
        .filter((r) =>
          Object.entries(where).every(([k, v]) =>
            k === 'recordId' ? r.recordId === v : k === 'createdBy' ? r.createdBy === v : r.data[k] === v,
          ),
        )
        .slice(0, options.limit ?? 50)
        .map(clone)
      return { success: true as const, data: { records, count: records.length } }
    },
  }
  return { tools: tools as unknown as ActionTools, store }
}
