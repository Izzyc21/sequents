import { describe, expect, it } from 'vitest'
import { analyse, bestLine, checkScenario, PATHS, scoreRun, wayKeysOf } from '../features/play/engine'
import { CHOICES, DECISIONS, type ScenarioDraft } from '../features/play/types'
import { STARTERS } from './starters'
import { STARTER_VARIANTS } from './variants'

/** Everything a player can read: no grades, outcomes, reasons, flags or endings. */
const readable = (d: ScenarioDraft) => ({
  title: d.title,
  situation: d.situation,
  setting: d.setting,
  decisions: d.decisions.map((dec) => ({
    prompt: dec.prompt,
    approaches: dec.approaches.map((a) => ({ text: a.text, ways: a.ways.map((w) => w.text) })),
  })),
})

const versioned = Object.entries(STARTER_VARIANTS).flatMap(([id, drafts]) => drafts.map((d, i) => [`${id} version ${i + 1}`, id, d] as const))

describe('starter hidden versions', () => {
  it('only name starters that exist', () => {
    const ids = STARTERS.map((s) => s.id)
    for (const id of Object.keys(STARTER_VARIANTS)) expect(ids).toContain(id)
  })

  it.each(versioned)('%s has the same readable half as its main draft', (_name, id, variant) => {
    const main = STARTERS.find((s) => s.id === id)!
    expect(readable(variant)).toEqual(readable(main))
  })

  it.each(versioned)('%s passes every check', (_name, _id, variant) => {
    expect(checkScenario(variant)).toEqual([])
  })

  it.each(versioned)('%s differs from its main draft in the hidden half', (_name, id, variant) => {
    const main = STARTERS.find((s) => s.id === id)!
    expect(variant.endings).not.toEqual(main.endings)
    expect(variant.flags).not.toEqual(main.flags)
  })
})

describe('starter text', () => {
  it('has no word that names the answer in a title, situation or setting', () => {
    const banned = /\b(fake|scam|suspicious|breach|angry|furious|goes silent|gone silent)\b/i
    for (const d of [...STARTERS, ...Object.values(STARTER_VARIANTS).flat()]) {
      expect(`${d.title} ${d.situation} ${d.setting}`).not.toMatch(banned)
    }
  })
})

describe('phishing across its two versions', () => {
  const [v0, v1] = [STARTERS.find((s) => s.id === 'starter-phishing')!, STARTER_VARIANTS['starter-phishing'][0]]
  const keys = [wayKeysOf(v0), wayKeysOf(v1)]

  it('lets no path score 90 or more in both versions', () => {
    let both = 0
    for (let n = 0; n < PATHS; n++) {
      const path = Array.from({ length: DECISIONS }, (_, d) => Math.floor(n / CHOICES ** d) % CHOICES)
      if (scoreRun(keys[0], path).score >= 90 && scoreRun(keys[1], path).score >= 90) both++
    }
    expect(both).toBe(0)
  })

  it("scores each version's best line at 80 or less in the other version", () => {
    expect(scoreRun(keys[0], bestLine(v0)).score).toBe(100)
    expect(scoreRun(keys[1], bestLine(v1)).score).toBe(100)
    expect(scoreRun(keys[1], bestLine(v0)).score).toBeLessThanOrEqual(80)
    expect(scoreRun(keys[0], bestLine(v1)).score).toBeLessThanOrEqual(80)
  })

  it('keeps both versions playable by the same behaviour limits', () => {
    for (const k of keys) expect(analyse(k).endings.good).toBeGreaterThan(0)
  })
})
