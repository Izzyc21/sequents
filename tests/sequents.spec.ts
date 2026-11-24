/**
 * Two-user spec for the important path and the main data rules.
 *
 * Setup:
 *   - two test accounts named "Alice" and "Bob"
 *     (npx deepspace test accounts create --name Alice ...)
 *   - Alice stands in for the app owner, so her visit seeds the starters:
 *     after `deepspace dev start` has written .dev.vars, set OWNER_USER_ID
 *     there to Alice's userId (from ~/.deepspace/test-accounts.json), then:
 *       cd tests && DEEPSPACE_PORT=5180 npx playwright test sequents.spec.ts
 *
 * What it proves:
 *   1. A player starts a starter, makes five picks and gets an ending and a debrief.
 *   2. Rewinding keeps the earlier picks, blocks the same pick at the rewound
 *      decision, and the comparison shows where the runs split.
 *   3. The hidden half of a scenario (the "why" text) never reaches the
 *      browser before the run ends.
 *   4. Another player cannot open someone else's run.
 */
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { STARTERS } from '../src/seeds/starters'

const names = new Set(loadAllTestAccounts().map((a) => a.name))
test.skip(
  !names.has('Alice') || !names.has('Bob'),
  'Needs test accounts named "Alice" (set as OWNER_USER_ID in .dev.vars) and "Bob".',
)

const starter = STARTERS.find((s) => s.id === 'starter-raise') ?? STARTERS[1]
const hiddenWhy = starter.scenes[0].options[0].why

/** Picks option `index` at the current decision and waits for the next one. */
async function pick(page: Page, decision: number, index: number) {
  const box = page.getByTestId('decision')
  await expect(box.getByText(`Decision ${decision} of 5`)).toBeVisible({ timeout: 15_000 })
  await box.getByRole('button').nth(index).click()
  if (decision < 5) await expect(box.getByText(`Decision ${decision + 1} of 5`)).toBeVisible({ timeout: 15_000 })
}

test.setTimeout(120_000)

test('play, rewind, compare; runs stay private; hidden text stays on the server', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])

  // Collect every WebSocket frame Alice's browser receives.
  const frames: string[] = []
  alice.page.on('websocket', (ws) =>
    ws.on('framereceived', (f) => frames.push(typeof f.payload === 'string' ? f.payload : Buffer.from(f.payload).toString('utf8'))),
  )

  // 1. Alice opens the gallery (seeding the starters) and plays one.
  await alice.page.goto('/home')
  const card = alice.page.getByTestId('scenario-card').filter({ hasText: starter.title })
  await expect(card).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Start' }).click()
  await alice.page.waitForURL(/\/run\//, { timeout: 15_000 })
  const firstRun = alice.page.url()

  for (let d = 1; d <= 4; d++) await pick(alice.page, d, 0)
  expect(frames.some((f) => f.includes(hiddenWhy))).toBe(false)
  await pick(alice.page, 5, 0)

  const debrief = alice.page.getByTestId('debrief')
  await expect(debrief.getByText(/ending/i).first()).toBeVisible({ timeout: 15_000 })
  await expect(debrief.getByText('Why:')).toHaveCount(5)

  // 2. Rewind to decision 3: the earlier pick there is blocked.
  await debrief.getByRole('button', { name: 'Rewind to decision 3' }).click()
  await alice.page.waitForURL((url) => url.href !== firstRun && /\/run\//.test(url.href), { timeout: 15_000 })
  const box = alice.page.getByTestId('decision')
  await expect(box.getByText('Decision 3 of 5')).toBeVisible({ timeout: 15_000 })
  await expect(box.getByRole('button').nth(0)).toBeDisabled()
  await expect(box.getByText('Your earlier pick')).toBeVisible()
  await expect(alice.page.getByTestId('story-so-far').locator('li')).toHaveCount(2)

  await pick(alice.page, 3, 1)
  await pick(alice.page, 4, 1)
  await pick(alice.page, 5, 1)
  const rewoundRun = alice.page.url()

  await alice.page.getByRole('link', { name: /Compare with the run you rewound/ }).click()
  await alice.page.waitForURL(/\/compare\//, { timeout: 15_000 })
  await expect(alice.page.getByTestId('charts').locator('figure')).toHaveCount(3)
  await expect(alice.page.getByText('Where you split')).toBeVisible()
  await expect(alice.page.getByTestId('decisions').locator('li').nth(2)).toContainText('Where you split')

  // 4. Bob sees the public starters but not Alice's runs.
  await bob.page.goto('/home')
  await expect(bob.page.getByTestId('scenario-card').filter({ hasText: starter.title })).toBeVisible({ timeout: 20_000 })
  await bob.page.goto(new URL(rewoundRun).pathname)
  await expect(bob.page.getByText('This run does not exist or belongs to someone else.')).toBeVisible({ timeout: 15_000 })
})
