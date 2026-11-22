/**
 * Two-user spec for the app's important path and its main security rule.
 *
 * Setup:
 *   - two test accounts named "Alice" and "Bob"
 *     (npx deepspace test accounts create --name Alice ...)
 *   - Alice must be the app's admin. Test accounts can't sign in as the real
 *     owner, so for this run Alice stands in for the owner: after any
 *     `deepspace dev start` / `test run` has written .dev.vars, set
 *     OWNER_USER_ID in .dev.vars to Alice's userId (from
 *     ~/.deepspace/test-accounts.json), then run Playwright directly:
 *       cd tests && DEEPSPACE_PORT=5180 npx playwright test stuckpoint.spec.ts
 *     The next deepspace dev/test/deploy run rewrites .dev.vars back.
 *
 * What it proves:
 *   1. An admin creates a funnel; a tester marks steps done/stuck.
 *   2. The admin's dashboard updates live, without a reload.
 *   3. The server only sends a tester their OWN reports: Bob's view of the
 *      same dashboard counts one tester (himself) while Alice's counts two.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

const names = new Set(loadAllTestAccounts().map((a) => a.name))
test.skip(
  !names.has('Alice') || !names.has('Bob'),
  'Needs test accounts named "Alice" (set as OWNER_USER_ID in .dev.vars) and "Bob".',
)

test('tester reports reach the team live, and testers only see their own', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])

  // 1. Alice (admin) creates a funnel from the pre-filled starter steps.
  await alice.page.goto('/funnels/new')
  const funnelName = `E2E funnel ${Date.now()}`
  await alice.page.getByLabel('Name').fill(funnelName)
  await alice.page.getByTestId('save-funnel').click()
  await alice.page.waitForURL(/\/dashboard\//, { timeout: 20_000 })
  const funnelId = alice.page.url().split('/dashboard/')[1]
  await expect(alice.page.getByText('No reports yet')).toBeVisible({ timeout: 15_000 })

  // 2. Bob (tester) finishes step 1 and gets stuck on step 2.
  await bob.page.goto(`/try/${funnelId}`)
  const step1 = bob.page.getByTestId('step-0')
  await step1.getByRole('button', { name: 'Done' }).click()
  await expect(step1.getByText('Done', { exact: true }).first()).toBeVisible({ timeout: 15_000 })
  const step2 = bob.page.getByTestId('step-1')
  await step2.getByRole('button', { name: 'Stuck' }).click()
  await step2.getByLabel('What went wrong?').fill('create command crashed on npm 10')
  await step2.getByRole('button', { name: 'Save as stuck' }).click()

  // Alice's dashboard, still open, updates without a reload.
  await expect(alice.page.getByTestId('tester-count')).toHaveText('1', { timeout: 15_000 })
  await expect(alice.page.getByTestId('stuck-1')).toHaveText('stuck 1')
  await expect(alice.page.getByText('create command crashed on npm 10')).toBeVisible()

  // 3. Alice also tries the funnel, so two testers have reports.
  await alice.page.goto(`/try/${funnelId}`)
  await alice.page.getByTestId('step-0').getByRole('button', { name: 'Done' }).click()
  await alice.page.goto(`/dashboard/${funnelId}`)
  await expect(alice.page.getByTestId('tester-count')).toHaveText('2', { timeout: 15_000 })

  // Bob opens the same dashboard: the server sent him only his own rows.
  await bob.page.goto(`/dashboard/${funnelId}`)
  await expect(bob.page.getByTestId('own-only')).toBeVisible({ timeout: 15_000 })
  await expect(bob.page.getByTestId('tester-count')).toHaveText('1')
  await expect(bob.page.getByText('create command crashed on npm 10')).toBeVisible()

  // 4. Only the team can delete. Bob has no Delete button; Alice deletes
  //    (two clicks) and the funnel disappears from Bob's list live.
  await expect(bob.page.getByTestId('delete-funnel')).toHaveCount(0)
  await bob.page.goto('/funnels')
  await expect(bob.page.getByText(funnelName)).toBeVisible({ timeout: 15_000 })
  await alice.page.getByTestId('delete-funnel').click()
  await alice.page.getByTestId('delete-funnel').click()
  await alice.page.waitForURL(/\/funnels$/)
  await expect(bob.page.getByText(funnelName)).toHaveCount(0, { timeout: 15_000 })
})
