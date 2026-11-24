import { describe, expect, it } from 'vitest'
import { canRead, canUpdate, checkFieldPermissions, lintSchemas } from 'deepspace/worker'
import { schemas } from './schemas'
import { scenariosSchema } from './schemas/scenarios-schema'
import { scenarioAnswersSchema } from './schemas/scenario-answers-schema'
import { runsSchema } from './schemas/runs-schema'
import { generationsSchema } from './schemas/generations-schema'

const ROLES = ['*', 'viewer', 'member', 'admin']
const row = (data: Record<string, unknown>) => ({ data, createdBy: 'user_seeder', recordId: 'r1' })

describe('schemas', () => {
  it('pass the SDK schema lint', () => {
    expect(lintSchemas(schemas)).toEqual([])
  })
})

describe('scenario_answers', () => {
  it('cannot be read or changed by any role, the author included', () => {
    const answers = row({ scenarioId: 's1' })
    for (const role of ROLES) {
      expect(canRead(scenarioAnswersSchema, role, answers, 'user_seeder')).toBe(false)
      expect(canUpdate(scenarioAnswersSchema, role, answers, 'user_seeder')).toBe(false)
    }
  })
})

describe('scenarios', () => {
  const starter = row({ authorId: '', visibility: 'public', starter: true })
  const hers = row({ authorId: 'user_a', visibility: 'private', starter: false })

  it('lets members and admins read public scenarios but not someone else’s private one', () => {
    for (const role of ['member', 'admin']) {
      expect(canRead(scenariosSchema, role, starter, 'user_b')).toBe(true)
      expect(canRead(scenariosSchema, role, hers, 'user_b')).toBe(false)
      expect(canRead(scenariosSchema, role, hers, 'user_a')).toBe(true)
    }
    expect(canRead(scenariosSchema, '*', starter, 'user_b')).toBe(false)
  })

  it('lets nobody change a starter, even the user whose visit seeded it', () => {
    for (const role of ROLES) expect(canUpdate(scenariosSchema, role, starter, 'user_seeder')).toBe(false)
  })

  it('lets only the author change their own scenario, and only its visibility', () => {
    expect(canUpdate(scenariosSchema, 'member', hers, 'user_a')).toBe(true)
    expect(canUpdate(scenariosSchema, 'member', hers, 'user_b')).toBe(false)
    expect(canUpdate(scenariosSchema, 'admin', hers, 'user_b')).toBe(false)
    expect(checkFieldPermissions(scenariosSchema, 'member', { visibility: 'public' }, hers.data)).toBeNull()
    expect(checkFieldPermissions(scenariosSchema, 'member', { title: 'x' }, hers.data)).not.toBeNull()
  })
})

describe('runs', () => {
  it('can be read only by the player and changed by no one from the browser', () => {
    const run = row({ playerId: 'user_a' })
    for (const role of ROLES) expect(canUpdate(runsSchema, role, run, 'user_a')).toBe(false)
    expect(canRead(runsSchema, 'member', run, 'user_a')).toBe(true)
    expect(canRead(runsSchema, 'member', run, 'user_b')).toBe(false)
    expect(canRead(runsSchema, 'admin', run, 'user_b')).toBe(false)
  })
})

describe('generations', () => {
  it('cannot be read or changed by any role', () => {
    const entry = row({ userDay: 'user_a_2026-11-24', appDay: '2026-11-24', ok: true })
    for (const role of ROLES) {
      expect(canRead(generationsSchema, role, entry, 'user_seeder')).toBe(false)
      expect(canUpdate(generationsSchema, role, entry, 'user_seeder')).toBe(false)
    }
  })
})
