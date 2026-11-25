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
 *   1. A player starts a starter, makes four two-step choices (an approach,
 *      then a way inside it) and lands on the look-back screen: how it went in
 *      one line, the ending, what happened at each decision, and no score. One
 *      hint can be asked for and stays after a reload. "Show my exact score"
 *      then opens the debrief: the score out of 100, an ending, the list of
 *      every lost point and the tunnel strip.
 *   2. Rewinding keeps the earlier choices, blocks the same choice at the
 *      rewound decision, keeps the later choices as they were, finishes the
 *      run as soon as the rewound decision is locked in, marks the changed and
 *      kept decisions on the look-back screen, unlocks the reason only at a
 *      decision where two choices were tried, and the comparison shows where
 *      the runs split.
 *   3. The hidden half of a scenario never reaches the browser early: no
 *      "why", flag label or ending text of the scenario being played arrives
 *      before the last choice; the outcome and reason of a way nobody picked
 *      never arrive; no data message carries the hidden grading fields; and no
 *      hidden text of any other starter arrives at all.
 *   4. Another player cannot open someone else's run.
 */
import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { STARTERS } from '../src/seeds/starters'
import { SEED_VERSION, starterAnswersId } from '../src/actions/play'
import { STARTER_VARIANTS } from '../src/seeds/variants'
import { seededRandom, shuffleDraft } from '../src/features/play/engine'
import { DECISIONS, type DraftWay, type ScenarioDraft } from '../src/features/play/types'

const names = new Set(loadAllTestAccounts().map((a) => a.name))
test.skip(
  !names.has('Alice') || !names.has('Bob'),
  'Needs test accounts named "Alice" and "Bob".',
)

const raw = STARTERS.find((s) => s.id === 'starter-raise') ?? STARTERS[1]
/** The starter as the browser shows it: shuffled the same way the server seeds it. */
const starter: ScenarioDraft = shuffleDraft(raw, seededRandom(starterAnswersId(raw.id!, SEED_VERSION)))
/** Every hidden string a way carries: its outcome and reason, and those of its flag override. */
const wayTexts = (w: DraftWay, keys: ('why' | 'outcome')[]) => keys.flatMap((k) => [w[k], ...(w.ifRaised ? [w.ifRaised[k]] : [])])
const hiddenEndings = (s: ScenarioDraft) => [s.endings.good, s.endings.ok, s.endings.bad, ...s.flags.map((f) => f.label)]
/** Hidden text of the starters nobody plays here, which must never arrive. */
const neverSent = [...STARTERS.filter((s) => s.id !== raw.id), ...Object.values(STARTER_VARIANTS).flat()].flatMap((s) => [
  ...s.decisions.flatMap((d) => d.approaches.flatMap((a) => a.ways.flatMap((w) => wayTexts(w, ['why', 'outcome'])))),
  ...hiddenEndings(s),
])
type Received = { from: string; text: string }

/**
 * A finished run rightly carries its debrief and ending, and test accounts
 * keep their runs from earlier sessions, so the player's own finished runs are
 * dropped from a received message before it is searched. Anyone else's
 * finished run is kept, so it would count as a leak.
 */
let ownPlayerId = ''
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
    if (data && data.status === 'done' && ownPlayerId && data.playerId === ownPlayerId) return null
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, strip(x)]))
  }
  return JSON.stringify(strip(parsed))
}

/** Each hidden string that arrived, with where it came from. */
const leaks = (received: Received[], secrets: string[]) =>
  secrets.flatMap((h) =>
    received.filter((r) => withoutFinishedRuns(r.text).includes(h)).map((r) => `${r.from}: ${h.slice(0, 40)}`),
  )

/**
 * Messages that carry data (WebSocket frames and action answers), as opposed
 * to scripts and pages, whose library code may use the same words.
 */
const dataMessages = (received: Received[]) =>
  received.filter((r) => r.from.startsWith('ws ') || r.from.startsWith('http /api/actions/'))

/**
 * At decision `decision` (1-based), commits to approach `a`, picks way `w`, locks in, and waits for what comes next:
 * the next decision, or the look-back screen after the last one.
 */
async function choose(page: Page, decision: number, a: number, w: number) {
  const box = page.getByTestId('decision')
  await expect(box.getByText(`Decision ${decision} of ${DECISIONS}`)).toBeVisible({ timeout: 15_000 })
  await box.getByTestId('approaches').getByRole('button').nth(a).click()
  await box.getByTestId('ways').getByRole('radio').nth(w).click()
  await box.getByRole('button', { name: 'Lock in' }).click()
  if (decision < DECISIONS) await expect(box.getByText(`Decision ${decision + 1} of ${DECISIONS}`)).toBeVisible({ timeout: 15_000 })
  else await expect(page.getByTestId('lookback')).toBeVisible({ timeout: 15_000 })
}

/** The browser's choices, [approach, way] per decision: the first run takes the first way of the first approach throughout. */
const firstPicks: [number, number][] = [[0, 0], [0, 0], [0, 0], [0, 0]]
/**
 * The rewound run keeps decisions 1-2, takes the second way of the first approach at 3, and
 * decision 4 stays as played the first time.
 */
const secondPicks: [number, number][] = [[0, 0], [0, 0], [0, 1], [0, 0]]

test.setTimeout(120_000)

test('play, look back, reveal, rewind, compare; runs stay private; hidden text stays on the server', async ({ users }) => {
  const [alice, bob] = await users(['Alice', 'Bob'])
  expect(alice.userId, 'the test account registry should know Alice\'s user id').toBeTruthy()
  ownPlayerId = alice.userId!

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

  for (let d = 1; d < DECISIONS; d++) await choose(alice.page, d, ...firstPicks[d - 1])
  // Reasons of the ways being picked, flag labels and endings stay hidden until the last choice.
  const pickedWhys = starter.decisions.flatMap((d, i) =>
    [firstPicks[i], secondPicks[i]].flatMap(([a, w]) => wayTexts(d.approaches[a].ways[w], ['why'])),
  )
  const beforeLast = await snapshot()
  // The search is not vacuous: the scenario's readable text did arrive.
  expect(beforeLast.some((r) => withoutFinishedRuns(r.text).includes(starter.decisions[DECISIONS - 1].prompt))).toBe(true)
  expect(leaks(beforeLast, [...pickedWhys, ...hiddenEndings(starter)])).toEqual([])
  await choose(alice.page, DECISIONS, ...firstPicks[DECISIONS - 1])

  // 1b. The look-back screen: the band line and ending, a row per decision, and no score anywhere.
  const lookBack = alice.page.getByTestId('lookback')
  await expect(lookBack.getByRole('heading', { name: 'Look back', exact: true })).toBeVisible()
  await expect(lookBack.getByTestId('band-line')).toHaveText(/^(It went well\.|Parts of it went wrong\.|It went badly\.)$/)
  await expect(lookBack.getByTestId('lookback-row')).toHaveCount(DECISIONS)
  await expect(lookBack.getByRole('heading', { name: 'Which decision would you change, if any?' })).toBeVisible()
  await expect(lookBack.getByRole('button', { name: /Change this one/ })).toHaveCount(DECISIONS)
  await expect(lookBack.getByText('Other options at this decision').first()).toBeVisible()
  await expect(alice.page.getByTestId('compared')).toHaveCount(0)
  await expect(alice.page.getByTestId('debrief')).toHaveCount(0)
  await expect(alice.page.locator('body')).not.toContainText(/\/ 100|biggest single fix|Every point you lost/)

  // 1c. One hint: pick a decision, read one line; after a reload the line stays and the link is gone.
  await lookBack.getByRole('button', { name: 'Ask for a hint' }).click()
  const picker = alice.page.getByRole('group', { name: 'Which decision would you change, if any?' })
  await expect(picker.getByLabel('None, I would keep them all')).toHaveCount(1)
  await expect(picker.getByRole('radio')).toHaveCount(DECISIONS + 1)
  await picker.getByLabel('Decision 1', { exact: true }).check()
  await picker.getByRole('button', { name: 'Get my hint' }).click()
  await expect(alice.page.getByTestId('hint')).toHaveCount(1, { timeout: 15_000 })
  const hintLine = (await alice.page.getByTestId('hint').innerText()).replace(/^Your hint:\s*/, '')
  expect(hintLine.length).toBeGreaterThan(10)
  await expect(alice.page.getByRole('button', { name: 'Ask for a hint' })).toHaveCount(0)
  await alice.page.reload()
  await expect(alice.page.getByTestId('hint')).toContainText(hintLine, { timeout: 15_000 })
  await expect(alice.page.getByRole('button', { name: 'Ask for a hint' })).toHaveCount(0)

  // 1d. At the bottom only, the exact score, on request.
  const reveal = alice.page.getByRole('button', { name: 'Show my exact score' })
  await expect(reveal).toHaveCount(1)
  await reveal.click()
  const debrief = alice.page.getByTestId('debrief')
  await expect(debrief.getByTestId('score')).toHaveText(/^\d{1,3} \/ 100$/, { timeout: 15_000 })
  await expect(debrief.getByTestId('demerits').locator('li')).toHaveCount(DECISIONS)
  await expect(debrief.getByTestId('why')).toHaveCount(DECISIONS)
  await expect(alice.page.getByTestId('lookback')).toHaveCount(0)
  // The tunnel strip: four nodes with a grade in words, how many paths from there still end well, and the start.
  await expect(alice.page.getByTestId('tunnel-start')).toHaveText(/^At the start: [\d,]+ of 6,561 paths ended well\.$/)
  const nodes = alice.page.getByTestId('tunnel-nodes').locator('li')
  await expect(nodes).toHaveCount(DECISIONS)
  for (let k = 0; k < DECISIONS; k++) {
    await expect(nodes.nth(k)).toContainText(/Best|Slip|Mistake|Blunder/)
    await expect(nodes.nth(k)).toContainText(new RegExp(`Paths from here that still end well: [\\d,]+ of ${(9 ** (DECISIONS - 1 - k)).toLocaleString('en-US')}`))
  }
  await expect(debrief.getByRole('link', { name: /Compare with the run you rewound/ })).toHaveCount(0)

  // 2. Rewind to decision 3: the earlier choice there is blocked.
  await debrief.getByRole('button', { name: 'Rewind to decision 3' }).click()
  await alice.page.waitForURL((url) => url.href !== firstRun && /\/run\//.test(url.href), { timeout: 15_000 })
  const box = alice.page.getByTestId('decision')
  await expect(box.getByText(`Decision 3 of ${DECISIONS}`)).toBeVisible({ timeout: 15_000 })
  await expect(alice.page.getByTestId('story-so-far').locator('li')).toHaveCount(2)
  await expect(alice.page.getByTestId('arrival')).toHaveText(
    'Change your choice here. Everything after it stays as you played it last time and plays out again from your new choice.',
  )
  await box.getByTestId('approaches').getByRole('button').nth(0).click()
  await expect(box.getByTestId('ways').getByRole('radio').nth(0)).toBeDisabled({ timeout: 15_000 })
  // The approach is stored on the server: a reload shows its ways again, never the other approaches.
  await alice.page.reload()
  await expect(box.getByTestId('ways').getByRole('radio')).toHaveCount(3, { timeout: 15_000 })
  await expect(box.getByTestId('approaches')).toHaveCount(0)
  await expect(box.getByTestId('ways').getByRole('radio').nth(0)).toBeDisabled()
  await expect(box.getByText('Your earlier choice')).toBeVisible()
  await expect(alice.page.getByTestId('arrival')).toBeVisible()
  await box.getByTestId('ways').getByRole('radio').nth(1).click()
  await box.getByRole('button', { name: 'Lock in' }).click()
  // The run finishes at the rewound decision: decision 4 is kept as played the first time.
  await expect(alice.page.getByTestId('lookback')).toBeVisible({ timeout: 15_000 })
  const rewoundRun = alice.page.url()

  // The look-back screen of the rewound run: what changed, what was kept, and how it compares, with no numbers.
  const rows = alice.page.getByTestId('lookback-row')
  await expect(rows).toHaveCount(DECISIONS)
  await expect(alice.page.getByText('Changed', { exact: true })).toHaveCount(1)
  await expect(rows.nth(2).getByText('Changed', { exact: true })).toBeVisible()
  await expect(alice.page.getByText('Same as last time', { exact: true })).toHaveCount(1)
  await expect(rows.nth(3).getByText('Same as last time', { exact: true })).toBeVisible()
  await expect(alice.page.getByTestId('compared')).toHaveCount(0)
  await expect(alice.page.locator('body')).not.toContainText(/\/ 100|biggest single fix/)
  await alice.page.getByRole('button', { name: 'Show my exact score' }).click()
  await expect(alice.page.getByTestId('debrief')).toBeVisible({ timeout: 15_000 })

  // Two different choices were tried at decision 3, so its reason is unlocked; decision 4 was only ever played one way.
  const demerits = alice.page.getByTestId('demerits').locator('li')
  await expect(demerits.nth(2).getByTestId('why')).toContainText('Why:', { timeout: 15_000 })
  await expect(demerits.nth(3).getByTestId('why')).toContainText('Reason locked')

  await alice.page.getByRole('link', { name: /Compare with the run you rewound/ }).click()
  await alice.page.waitForURL(/\/compare\//, { timeout: 15_000 })
  await expect(alice.page.getByTestId('decisions').locator('li')).toHaveCount(DECISIONS, { timeout: 15_000 })
  await expect(alice.page.getByTestId('decisions').locator('li').nth(2)).toContainText('Where you split')
  const all = await snapshot()
  expect(leaks(all, neverSent)).toEqual([])

  // Outcomes and reasons of ways Alice never picked in either run.
  const unpicked = starter.decisions.flatMap((d, i) =>
    d.approaches.flatMap((ap, a) =>
      ap.ways.flatMap((way, w) =>
        [firstPicks[i], secondPicks[i]].some(([pa, pw]) => pa === a && pw === w) ? [] : wayTexts(way, ['why', 'outcome']),
      ),
    ),
  )
  expect(leaks(all, unpicked)).toEqual([])
  // No data message carries the grading fields. The explain answer rightly carries "why"
  // (the reason for a picked way, checked above), so it is left out of this key search.
  const hiddenKeys = dataMessages(all)
    .filter((r) => !r.from.startsWith('http /api/actions/explain'))
    .filter((r) => /"(grade|why|outcome|raises|ifRaised|wayKeys)"\s*:/.test(withoutFinishedRuns(r.text)))
    .map((r) => r.from)
  expect(hiddenKeys).toEqual([])
  // The key search is not vacuous: data messages did arrive.
  expect(dataMessages(all).length).toBeGreaterThan(0)

  // 4. Bob sees the public starters but not Alice's runs.
  await bob.page.goto('/home')
  await expect(bob.page.getByTestId('scenario-card').filter({ hasText: starter.title })).toBeVisible({ timeout: 20_000 })
  await bob.page.goto(new URL(rewoundRun).pathname)
  await expect(bob.page.getByText('This run does not exist or belongs to someone else.')).toBeVisible({ timeout: 15_000 })
})
