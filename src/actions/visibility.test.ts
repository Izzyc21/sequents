import { describe, expect, it } from 'vitest'
import type { ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'
import { fakeTools } from './fake-tools'
import { TAKEN_DOWN, visibilityActions } from './visibility'

const OWNER = 'user_owner'
const AUTHOR = 'user_author'
const env = { OWNER_USER_ID: OWNER } as Env

function setup() {
  const store: ReturnType<typeof fakeTools>['store'] = new Map()
  const seed = async (id: string, data: Record<string, unknown>) => {
    await fakeTools(AUTHOR, store).tools.create('scenarios', { authorId: AUTHOR, ...data }, id)
  }
  const call = async (name: 'unpublish' | 'setVisibility', userId: string, params: Record<string, unknown>, callEnv: Env = env) =>
    (await visibilityActions[name]({
      userId,
      params,
      tools: fakeTools(userId, store).tools,
      env: callEnv,
      callerJwt: 'jwt',
    })) as ActionResult<{ scenarioId: string; visibility?: string }>
  const unpublish = (userId: string, scenarioId: string, callEnv: Env = env) => call('unpublish', userId, { scenarioId }, callEnv)
  const setVisibility = (userId: string, scenarioId: string, visibility: unknown) =>
    call('setVisibility', userId, { scenarioId, visibility })
  const data = (id: string) => store.get('scenarios')?.get(id)?.data
  const visibility = (id: string) => data(id)?.visibility
  return { seed, unpublish, setVisibility, data, visibility }
}

describe('unpublish', () => {
  it("lets the owner make another player's published scenario private and marks it taken down", async () => {
    const { seed, unpublish, data } = setup()
    await seed('gen_1', { visibility: 'public', starter: false })
    expect(await unpublish(OWNER, 'gen_1')).toEqual({ success: true, data: { scenarioId: 'gen_1' } })
    expect(data('gen_1')).toMatchObject({ visibility: 'private', takenDown: true })
  })

  it('refuses anyone but the owner, the author included', async () => {
    const { seed, unpublish, visibility } = setup()
    await seed('gen_1', { visibility: 'public', starter: false })
    for (const userId of [AUTHOR, 'user_other', '']) {
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

  it('marks an already private scenario taken down, and reports a missing one', async () => {
    const { seed, unpublish, data } = setup()
    await seed('gen_2', { visibility: 'private', starter: false })
    expect((await unpublish(OWNER, 'gen_2')).success).toBe(true)
    expect(data('gen_2')).toMatchObject({ visibility: 'private', takenDown: true })
    expect(await unpublish(OWNER, 'gen_missing')).toEqual({ success: false, error: 'Scenario not found.' })
  })
})

describe('setVisibility', () => {
  it('lets the author publish their scenario and make it private again', async () => {
    const { seed, setVisibility, visibility } = setup()
    await seed('gen_1', { visibility: 'private', starter: false })
    expect(await setVisibility(AUTHOR, 'gen_1', 'public')).toEqual({
      success: true,
      data: { scenarioId: 'gen_1', visibility: 'public' },
    })
    expect(visibility('gen_1')).toBe('public')
    expect((await setVisibility(AUTHOR, 'gen_1', 'private')).success).toBe(true)
    expect(visibility('gen_1')).toBe('private')
  })

  it('refuses other players, signed-out callers and anonymous ones', async () => {
    const { seed, setVisibility, visibility } = setup()
    await seed('gen_1', { visibility: 'private', starter: false })
    for (const userId of ['user_other', OWNER, '', 'anon-123']) {
      expect((await setVisibility(userId, 'gen_1', 'public')).success).toBe(false)
    }
    expect(visibility('gen_1')).toBe('private')
  })

  it('refuses built-in scenarios and values other than public or private', async () => {
    const { seed, setVisibility, visibility } = setup()
    await seed('starter_1', { visibility: 'public', starter: true })
    expect((await setVisibility(AUTHOR, 'starter_1', 'private')).success).toBe(false)
    expect(visibility('starter_1')).toBe('public')
    await seed('gen_1', { visibility: 'private', starter: false })
    for (const v of ['unlisted', '', 1, null]) expect((await setVisibility(AUTHOR, 'gen_1', v)).success).toBe(false)
    expect(visibility('gen_1')).toBe('private')
  })

  it('keeps a takedown: the author cannot publish it again but can keep it private', async () => {
    const { seed, unpublish, setVisibility, visibility } = setup()
    await seed('gen_1', { visibility: 'public', starter: false })
    expect((await unpublish(OWNER, 'gen_1')).success).toBe(true)
    expect(await setVisibility(AUTHOR, 'gen_1', 'public')).toEqual({ success: false, error: TAKEN_DOWN })
    expect(visibility('gen_1')).toBe('private')
    expect((await setVisibility(AUTHOR, 'gen_1', 'private')).success).toBe(true)
    expect(visibility('gen_1')).toBe('private')
  })

  it('undoes a publish when the takedown lands between its read and its write', async () => {
    const store: ReturnType<typeof fakeTools>['store'] = new Map()
    await fakeTools(AUTHOR, store).tools.create('scenarios', { authorId: AUTHOR, visibility: 'private', starter: false }, 'gen_1')
    const authorTools = fakeTools(AUTHOR, store).tools
    const realUpdate = authorTools.update.bind(authorTools)
    let raced = false
    // The owner's unpublish lands just before the author's publish write.
    authorTools.update = async (...args: Parameters<typeof realUpdate>) => {
      if (!raced) {
        raced = true
        await fakeTools(OWNER, store).tools.update('scenarios', 'gen_1', { visibility: 'private', takenDown: true })
      }
      return realUpdate(...args)
    }
    const res = await visibilityActions.setVisibility({
      userId: AUTHOR,
      params: { scenarioId: 'gen_1', visibility: 'public' },
      tools: authorTools,
      env,
      callerJwt: 'jwt',
    })
    expect(res).toEqual({ success: false, error: TAKEN_DOWN })
    expect(store.get('scenarios')?.get('gen_1')?.data).toMatchObject({ visibility: 'private', takenDown: true })
  })

  it('treats a change to the current visibility as done without writing', async () => {
    const { seed, setVisibility, visibility } = setup()
    await seed('gen_1', { visibility: 'public', starter: false })
    expect(await setVisibility(AUTHOR, 'gen_1', 'public')).toEqual({
      success: true,
      data: { scenarioId: 'gen_1', visibility: 'public' },
    })
    expect(visibility('gen_1')).toBe('public')
  })
})
