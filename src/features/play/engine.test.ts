import { describe, expect, it } from 'vitest'
import { STARTERS } from '../../seeds/starters'
import {
  applyDelta,
  behaviourProblems,
  calibrateDraft,
  checkScenario,
  countEndings,
  endingFor,
  repairDraft,
  shuffleOptions,
  splitDraft,
  turningPoint,
} from './engine'
import type { ScenarioDraft } from './types'

describe('meters and endings', () => {
  it('clamps meters to 0-100', () => {
    expect(applyDelta([95, 5, 50], [10, -10, 0])).toEqual([100, 0, 50])
  })

  it('decides the ending from the final meters', () => {
    expect(endingFor([70, 70, 70])).toBe('good')
    expect(endingFor([90, 90, 25])).toBe('ok') // high average, but one meter under 30
    expect(endingFor([50, 50, 50])).toBe('ok')
    expect(endingFor([80, 80, 15])).toBe('bad') // one meter at 15 or below
    expect(endingFor([39, 39, 39])).toBe('bad')
  })

  it('finds the decision that moved the meters most', () => {
    const history = [
      [50, 50, 50],
      [52, 50, 50],
      [30, 40, 50],
      [31, 40, 50],
    ]
    expect(turningPoint(history)).toBe(1)
  })
})

describe('the six starters', () => {
  it('has six with unique ids', () => {
    expect(STARTERS).toHaveLength(6)
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(6)
  })

  for (const starter of STARTERS) {
    it(`${starter.id} passes every scenario rule`, () => {
      expect(checkScenario(starter)).toEqual([])
    })
  }
})

describe('checkScenario', () => {
  const base = STARTERS[0]
  const clone = (): ScenarioDraft => JSON.parse(JSON.stringify(base))

  it('refuses a scene without exactly one best, ok and trap', () => {
    const d = clone()
    d.scenes[2].options[0].kind = 'best'
    d.scenes[2].options[1].kind = 'best'
    expect(checkScenario(d).join()).toMatch(/scene 3 needs one best, one ok and one trap/)
  })

  it('refuses meter changes outside -25..25', () => {
    const d = clone()
    d.scenes[0].options[0].delta = [40, 0, 0]
    expect(checkScenario(d).join()).toMatch(/scene 1 option 1 needs 3 whole-number changes/)
  })

  it('refuses a scenario where every path ends the same way', () => {
    const d = clone()
    for (const scene of d.scenes) for (const o of scene.options) o.delta = o.kind === 'best' ? [2, 1, 0] : o.kind === 'ok' ? [1, 0, 0] : [0, 0, 0]
    const problems = checkScenario(d).join()
    expect(problems).toMatch(/picking every best option ends ok/)
    expect(problems).toMatch(/paths end good/)
  })

  it('does not throw on garbage', () => {
    expect(checkScenario({} as ScenarioDraft).length).toBeGreaterThan(0)
    expect(checkScenario(null as unknown as ScenarioDraft).length).toBeGreaterThan(0)
  })
})

describe('splitDraft', () => {
  it('keeps the hidden half out of the readable half', () => {
    const { scenario, answers } = splitDraft(STARTERS[0])
    const readable = JSON.stringify(scenario)
    const why = STARTERS[0].scenes[0].options[0].why
    expect(readable).not.toContain(why)
    expect(readable).not.toContain('"kind"')
    expect(readable).not.toContain('"delta"')
    expect(answers.effects[0][0].why).toBe(why)
    expect(scenario.scenes[0].options).toHaveLength(3)
  })
})

describe('repairDraft and shuffleOptions', () => {
  it('rounds and clamps numbers and trims text', () => {
    const d: ScenarioDraft = JSON.parse(JSON.stringify(STARTERS[0]))
    d.title = '  Spaced  '
    d.scenes[0].options[0].delta = [30.4, -2.6, 0]
    const r = repairDraft(d)
    expect(r.title).toBe('Spaced')
    expect(r.scenes[0].options[0].delta).toEqual([25, -3, 0])
  })

  it('moves options without changing what any option does', () => {
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const shuffled = shuffleOptions(STARTERS[1], random)
    expect(checkScenario(shuffled)).toEqual([])
    const before = countEndings(STARTERS[1].meters.map((m) => m.start), splitDraft(STARTERS[1]).answers.effects)
    const after = countEndings(shuffled.meters.map((m) => m.start), splitDraft(shuffled).answers.effects)
    expect(after).toEqual(before)
  })
})

describe('calibrateDraft', () => {
  const copy = (d: ScenarioDraft): ScenarioDraft => JSON.parse(JSON.stringify(d))
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const randomInt = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1))

  it('returns a draft whose numbers already pass unchanged', () => {
    expect(calibrateDraft(STARTERS[0])).toBe(STARTERS[0])
  })

  it('returns null for a draft with shape problems', () => {
    const d = copy(STARTERS[0])
    d.scenes.pop()
    expect(calibrateDraft(d)).toBeNull()
  })

  it('makes a draft with all-zero numbers playable', () => {
    const d = copy(STARTERS[0])
    d.scenes.forEach((scene) => scene.options.forEach((o) => (o.delta = [0, 0, 0])))
    expect(behaviourProblems(d)).not.toEqual([])
    const tuned = calibrateDraft(d)!
    expect(checkScenario(tuned)).toEqual([])
  })

  it('makes every draft with random numbers playable, changing only numbers', () => {
    for (let n = 0; n < 300; n++) {
      const d = copy(STARTERS[n % STARTERS.length])
      d.meters.forEach((m) => (m.start = randomInt(30, 70)))
      d.scenes.forEach((scene) => scene.options.forEach((o) => (o.delta = [0, 0, 0].map(() => randomInt(-25, 25)))))
      const tuned = calibrateDraft(d)
      expect(tuned, `draft ${n}`).not.toBeNull()
      expect(checkScenario(tuned!), `draft ${n}`).toEqual([])
      const text = (x: ScenarioDraft) =>
        JSON.stringify({ ...x, meters: x.meters.map((m) => m.name), scenes: x.scenes.map((s) => [s.prompt, s.options.map((o) => [o.text, o.kind, o.outcome, o.why])]) })
      expect(text(tuned!)).toBe(text(d))
    }
  })

  // An ok pick must total a little above zero, so an ok option the writer made
  // negative overall has to change direction somewhere; best and trap need not.
  it("keeps each best and trap option's direction when a rescale is enough", () => {
    const d = copy(STARTERS[0])
    // Halve every change: same pattern, too weak to reach the good ending.
    d.scenes.forEach((scene) => scene.options.forEach((o) => (o.delta = o.delta.map((v) => Math.trunc(v / 2)))))
    const tuned = calibrateDraft(d)!
    expect(checkScenario(tuned)).toEqual([])
    tuned.scenes.forEach((scene, s) =>
      scene.options.forEach((o, i) =>
        o.delta.forEach((v, k) => {
          const before = d.scenes[s].options[i].delta[k]
          if (before !== 0 && o.kind !== 'ok') expect(Math.sign(v) === Math.sign(before) || v === 0, `scene ${s} option ${i} meter ${k}`).toBe(true)
        }),
      ),
    )
  })
})
