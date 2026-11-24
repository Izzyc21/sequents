/**
 * Two-user spec for the important path and the main data rules.
 *
 * Setup:
 *   - two test accounts named "Alice" and "Bob"
 *     (npx deepspace test accounts create --name Alice ...)
 *   - with `deepspace dev start` running:
 *       cd tests && DEEPSPACE_PORT=5180 npx playwright test sequents.spec.ts
 *
 * What it proves:
 *   1. A player starts a starter, makes five picks and gets an ending and a debrief.
 *   2. Rewinding keeps the earlier picks, blocks the same pick at the rewound
 *      decision, and the comparison shows where the runs split.
 *   3. The hidden half of a scenario never reaches the browser early: no
 *      "why" or ending text of the scenario being played arrives in any
 *      WebSocket frame or HTTP response before the last pick, and no hidden
 *      text of any other starter arrives at all.
 *   4. Another player cannot open someone else's run.
 */
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { STARTERS } from '../src/seeds/starters'

const names = new Set(loadAllTestAccounts().map((a) => a.name))
test.skip(
  !names.has('Alice') || !names.has('Bob'),
  'Needs test accounts named "Alice" and "Bob".',
)

const starter = STARTERS.find((s) => s.id === 'starter-raise') ?? STARTERS[1]
/** Text of the played scenario that must stay on the server until the run ends. */
const hiddenUntilEnd = [
  ...starter.scenes.flatMap((scene) => scene.options.map((o) => o.why)),
  starter.endings.good,
  starter.endings.ok,
  starter.endings.bad,
]
/** Hidden text of the starters nobody plays here, which must never arrive. */
const neverSent = STARTERS.filter((s) => s.id !== starter.id).flatMap((s) => [
  ...s.scenes.flatMap((scene) => scene.options.flatMap((o) => [o.why, o.outcome])),
  s.endings.good,
  s.endings.ok,
  s.endings.bad,
])
type Received = { from: string; text: string }

/**
 * A finished run rightly carries its debrief and ending, and test accounts
 * keep their runs from earlier sessions, so finished runs are dropped from a
 * received message before it is searched.
 */
function withoutFinishedRuns(text: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return text
  }
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip)
    if (!v || typeof v !== 'object') return v
    const o = v as Record<string, unknown>
    const data = o.data as Record<string, unknown> | undefined
    if (data && data.status === 'done' && typeof data.playerId === 'string') return null
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, strip(x)]))
  }
  return JSON.stringify(strip(parsed))
}

/** Each hidden string that arrived, with where it came from. */
const leaks = (received: Received[], secrets: string[]) =>
  secrets.flatMap((h) =>
    received.filter((r) => withoutFinishedRuns(r.text).includes(h)).map((r) => `${r.from}: ${h.slice(0, 40)}`),
  )

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

  // Collect every WebSocket frame and every text HTTP response (pages,
  // scripts, action answers) Alice's browser receives.
  const received: Received[] = []
  const pending: Promise<void>[] = []
  alice.page.on('websocket', (ws) =>
    ws.on('framereceived', (f) =>
      received.push({
        from: `ws ${new URL(ws.url()).pathname}`,
        text: typeof f.payload === 'string' ? f.payload : Buffer.from(f.payload).toString('utf8'),
      }),
    ),
  )
  alice.page.on('response', (r) => {
    const type = r.headers()['content-type'] ?? ''
    if (!/json|javascript|html|text/.test(type)) return
    pending.push(
      r.text().then(
        (text) => void received.push({ from: `http ${new URL(r.url()).pathname}`, text }),
        () => undefined,
      ),
    )
  })
  const snapshot = async () => {
    await Promise.all(pending)
    return [...received]
  }

  // 1. Alice opens the gallery (seeding the starters) and plays one.
  await alice.page.goto('/home')
  const card = alice.page.getByTestId('scenario-card').filter({ hasText: starter.title })
  await expect(card).toBeVisible({ timeout: 20_000 })
  await card.getByRole('button', { name: 'Start' }).click()
  await alice.page.waitForURL(/\/run\//, { timeout: 15_000 })
  const firstRun = alice.page.url()

  for (let d = 1; d <= 4; d++) await pick(alice.page, d, 0)
  const beforeLast = await snapshot()
  // The search is not vacuous: the scenario's readable text did arrive.
  expect(beforeLast.some((r) => withoutFinishedRuns(r.text).includes(starter.scenes[4].prompt))).toBe(true)
  expect(leaks(beforeLast, hiddenUntilEnd)).toEqual([])
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
  expect(leaks(await snapshot(), neverSent)).toEqual([])

  // 4. Bob sees the public starters but not Alice's runs.
  await bob.page.goto('/home')
  await expect(bob.page.getByTestId('scenario-card').filter({ hasText: starter.title })).toBeVisible({ timeout: 20_000 })
  await bob.page.goto(new URL(rewoundRun).pathname)
  await expect(bob.page.getByText('This run does not exist or belongs to someone else.')).toBeVisible({ timeout: 15_000 })
})
