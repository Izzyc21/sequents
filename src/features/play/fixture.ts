/**
 * A small scenario for unit tests that passes every check in engine.ts.
 * Not imported by the app.
 *
 * Grades of the three approaches at every decision: the right approach holds
 * best, slip, mistake; the other holds slip, mistake, blunder; the wrong one
 * holds mistake, blunder, blunder. Every text has the same length, so no
 * guessing rule beats random. One flag: the slip of the second approach at
 * decision 1 raises "promise"; at decision 3 the slip of the right approach
 * turns into a blunder when it was raised.
 */
import type { DraftWay, Grade, ScenarioDraft, WayAnswer } from './types'

export const MIX: Grade[][] = [
  ['best', 'slip', 'mistake'],
  ['slip', 'mistake', 'blunder'],
  ['mistake', 'blunder', 'blunder'],
]

export function fixture(id = 'fixture'): ScenarioDraft {
  const way = (d: number, a: number, w: number): DraftWay => ({
    text: `Option ${d}${a}${w} for this step`,
    grade: MIX[a][w],
    outcome: `Outcome ${d}${a}${w}.`,
    why: `Reason ${d}${a}${w}.`,
  })
  const decisions = [0, 1, 2, 3].map((d) => ({
    prompt: `Decision ${d + 1}: what now?`,
    approaches: [0, 1, 2].map((a) => ({ text: `Approach ${d}${a} plan`, ways: [0, 1, 2].map((w) => way(d, a, w)) })),
  }))
  decisions[0].approaches[1].ways[0].raises = ['promise']
  decisions[2].approaches[0].ways[1].ifRaised = {
    flag: 'promise',
    grade: 'blunder',
    outcome: 'The promise comes due.',
    why: 'You promised earlier.',
  }
  return {
    id,
    title: 'Fixture',
    situation: 'A test situation.',
    setting: 'A test setting.',
    decisions,
    flags: [{ id: 'promise', label: 'You promised Friday' }],
    endings: { good: 'Good.', ok: 'Ok.', bad: 'Bad.' },
  }
}

/** The choice (approach * 3 + way) at decision `d` whose way matches `test`; -1 if none. */
export function findChoice(wayKeys: WayAnswer[][][], d: number, test: (w: WayAnswer) => boolean): number {
  for (let a = 0; a < wayKeys[d].length; a++) {
    const w = wayKeys[d][a].findIndex(test)
    if (w >= 0) return a * wayKeys[d][a].length + w
  }
  return -1
}

/** The choice of a way with grade `grade` at every decision. */
export const choicesOf = (wayKeys: WayAnswer[][][], grade: Grade) =>
  wayKeys.map((_, d) => findChoice(wayKeys, d, (w) => w.grade === grade))
