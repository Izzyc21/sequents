import { describe, expect, it } from 'vitest'
import type { ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'
import { fakeTools } from './fake-tools'
import { moderateActions } from './moderate'

const OWNER = 'user_owner'
const env = { OWNER_USER_ID: OWNER } as Env

function setup() {
  const store: ReturnType<typeof fakeTools>['store'] = new Map()
  const seed = async (id: string, data: Record<string, unknown>) => {
    await fakeTools('user_author', store).tools.create('scenarios', { authorId: 'user_author', ...data }, id)
  }
  const unpublish = async (userId: string, scenarioId: string, callEnv: Env = env) =>
    (await moderateActions.unpublish({
      userId,
      params: { scenarioId },
      tools: fakeTools(userId, store).tools,
      env: callEnv,
      callerJwt: 'jwt',
    })) as ActionResult<{ scenarioId: string }>
  const visibility = (id: string) => store.get('scenarios')?.get(id)?.data.visibility
  return { seed, unpublish, visibility }
}

describe('unpublish', () => {
  it("lets the owner make another player's published scenario private", async () => {
    const { seed, unpublish, visibility } = setup()
    await seed('gen_1', { visibility: 'public', starter: false })
    expect(await unpublish(OWNER, 'gen_1')).toEqual({ success: true, data: { scenarioId: 'gen_1' } })
    expect(visibility('gen_1')).toBe('private')
  })

  it('refuses anyone but the owner, the author included', async () => {
    const { seed, unpublish, visibility } = setup()
    await seed('gen_1', { visibility: 'public', starter: false })
    for (const userId of ['user_author', 'user_other', '']) {
      expect((await unpublish(userId, 'gen_1')).success).toBe(false)
    }
    expect(visibility('gen_1')).toBe('public')
  })

  it('refuses everyone when no owner is configured', async () => {
    const { seed, unpublish, visibility } = setup()
    await seed('gen_1', { visibility: 'public', starter: false })
    const noOwner = { OWNER_USER_ID: '' } as Env
    expect((await unpublish('', 'gen_1', noOwner)).success).toBe(false)
    expect(visibility('gen_1')).toBe('public')
  })

  it('leaves built-in scenarios public', async () => {
    const { seed, unpublish, visibility } = setup()
    await seed('starter_1', { visibility: 'public', starter: true, authorId: '' })
    expect((await unpublish(OWNER, 'starter_1')).success).toBe(false)
    expect(visibility('starter_1')).toBe('public')
  })

  it('does nothing to a scenario that is already private, and reports a missing one', async () => {
    const { seed, unpublish, visibility } = setup()
    await seed('gen_2', { visibility: 'private', starter: false })
    expect((await unpublish(OWNER, 'gen_2')).success).toBe(true)
    expect(visibility('gen_2')).toBe('private')
    expect(await unpublish(OWNER, 'gen_missing')).toEqual({ success: false, error: 'Scenario not found.' })
  })
})
