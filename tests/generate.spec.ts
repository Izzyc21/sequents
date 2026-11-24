/**
 * Write your own and publishing.
 *
 * The first test costs nothing. The second makes one real call to the AI
 * model (billed to the app owner), so it runs only when RUN_AI_TESTS=1.
 */
import { test, expect } from 'deepspace/testing'
import { DECISIONS } from '../src/features/play/types'

test.setTimeout(180_000)

test('the write box needs 10 to 400 characters', async ({ users }) => {
  const [alice] = await users(['Alice'])
  await alice.page.goto('/home')
  const box = alice.page.getByTestId('write-your-own')
  const button = box.getByRole('button', { name: 'Write and play' })
  await expect(box.getByText('Your text is sent to Claude (Anthropic) to write the scenario. Leave out private details.', { exact: false })).toBeVisible({
    timeout: 20_000,
  })
  await expect(button).toBeDisabled()
  await box.getByRole('textbox').fill('too short')
  await expect(button).toBeDisabled()
  await box.getByRole('textbox').fill('Telling my landlord the heater has been broken for two weeks')
  await expect(button).toBeEnabled()
})

test('write a scenario, play it, publish it to another player, then make it private', async ({ users }) => {
  test.skip(process.env.RUN_AI_TESTS !== '1', 'makes a real AI call; set RUN_AI_TESTS=1')
  const [alice, bob] = await users(['Alice', 'Bob'])

  const frames: string[] = []
  alice.page.on('websocket', (ws) =>
    ws.on('framereceived', (f) => frames.push(typeof f.payload === 'string' ? f.payload : Buffer.from(f.payload).toString('utf8'))),
  )

  // 1. Alice writes one and lands on its first decision.
  await alice.page.goto('/home')
  const box = alice.page.getByTestId('write-your-own')
  await box.getByRole('textbox').fill('Telling my landlord the heater has been broken for two weeks and I want it fixed this week')
  await box.getByRole('button', { name: 'Write and play' }).click()
  await alice.page.waitForURL(/\/run\//, { timeout: 120_000 }) // the action stops at 95 s
  await expect(alice.page.getByTestId('decision').getByText(`Decision 1 of ${DECISIONS}`)).toBeVisible({ timeout: 15_000 })
  // The hidden half (each way's reason, outcome, flags and answers) never
  // reaches her browser. "grade" is not searched: her finished runs from
  // earlier sessions rightly carry their graded steps.
  expect(frames.filter((t) => /"(why|outcome|raises|ifRaised|wayKeys)"\s*:/.test(t))).toEqual([])

  // 2. It is hers and private: Bob cannot see it.
  await alice.page.goto('/home')
  const mine = alice.page.getByTestId('scenario-card').filter({ has: alice.page.getByRole('button', { name: 'Publish' }) }).first()
  await expect(mine).toBeVisible({ timeout: 20_000 })
  const title = (await mine.locator('h3').textContent())!.trim()
  await bob.page.goto('/home')
  await expect(bob.page.getByTestId('scenario-card').first()).toBeVisible({ timeout: 20_000 })
  await expect(bob.page.getByTestId('scenario-card').filter({ hasText: title })).toHaveCount(0)

  // 3. Publishing asks first, then Bob sees it and can play it.
  await mine.getByRole('button', { name: 'Publish' }).click()
  await expect(alice.page.getByText('Everyone signed in will see this title, setting and situation', { exact: false })).toBeVisible()
  await alice.page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click()
  const bobCard = bob.page.getByTestId('scenario-card').filter({ hasText: title })
  await expect(bobCard).toBeVisible({ timeout: 20_000 })
  await expect(bobCard.getByRole('button', { name: 'Publish' })).toHaveCount(0)
  await bobCard.getByRole('button', { name: 'Start' }).click()
  await bob.page.waitForURL(/\/run\//, { timeout: 15_000 })

  // 4. Making it private again hides it from Bob's gallery.
  await alice.page.getByTestId('scenario-card').filter({ hasText: title }).getByRole('button', { name: 'Make private' }).click()
  await bob.page.goto('/home')
  await expect(bob.page.getByTestId('scenario-card').first()).toBeVisible({ timeout: 20_000 })
  await expect(bob.page.getByTestId('scenario-card').filter({ hasText: title })).toHaveCount(0)
})
