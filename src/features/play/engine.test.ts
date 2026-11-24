import { describe, expect, it } from 'vitest'
import { STARTERS } from '../../seeds/starters'
import {
  analyse,
  beatsShare,
  behaviourProblems,
  bestLine,
  bestSingleFix,
  checkScenario,
  echoes,
  endingFor,
  expectedScore,
  flagProblems,
  fromChoice,
  giveawayProblems,
  mixProblems,
  PATHS,
  repairDraft,
  replay,
  scoreRun,
  seededRandom,
  shapeProblems,
  shuffleDraft,
  splitDraft,
  toChoice,
  wayKeysOf,
} from './engine'
import { fixture, MIX } from './fixture'
import type { DraftWay, Grade, ScenarioDraft } from './types'

const c = toChoice
/** Choice of the fixture's best way at any decision. */
const BEST = c(0, 0)
const RAISE = c(1, 0) // decision 0 slip that raises the flag
const HIT = c(0, 1) // decision 2 slip that reacts to the flag

describe('scoring', () => {
  it('maps a score to its band', () => {
    expect(endingFor(100)).toBe('good')
    expect(endingFor(90)).toBe('good')
    expect(endingFor(89)).toBe('ok')
    expect(endingFor(70)).toBe('ok')
    expect(endingFor(69)).toBe('bad')
    expect(endingFor(20)).toBe('bad')
  })

  it('stores a choice as one number', () => {
    for (let a = 0; a < 3; a++) for (let w = 0; w < 3; w++) expect(fromChoice(c(a, w))).toEqual({ approach: a, way: w })
  })

  it('subtracts the points of each grade from 100', () => {
    const keys = wayKeysOf(fixture())
    const run = scoreRun(keys, [BEST, c(0, 1), c(1, 1), c(2, 2)])
    expect(run.steps.map((s) => s.points)).toEqual([0, 5, 12, 20])
    expect(run.score).toBe(63)
    expect(run.ending).toBe('bad')
  })

  it('applies a raised flag at a later decision and names the decision that raised it', () => {
    const keys = wayKeysOf(fixture())
    const raised = replay(keys, [RAISE, BEST, HIT, BEST])
    expect(raised[2]).toMatchObject({ grade: 'blunder', base: 'slip', points: 20, causedBy: 0, flag: 'promise' })
    expect(raised[2].outcome).toBe('The promise comes due.')
    // The same pick without the earlier raise plays as its own grade.
    const clean = replay(keys, [BEST, BEST, HIT, BEST])
    expect(clean[2]).toMatchObject({ grade: 'slip', points: 5, causedBy: -1, flag: '' })
  })

  it('checks a flag against earlier decisions only', () => {
    const draft = fixture()
    const w = draft.decisions[2].approaches[0].ways[1]
    w.raises = ['promise'] // the reacting way also raises the flag itself
    const steps = replay(wayKeysOf(draft), [BEST, BEST, HIT, BEST])
    expect(steps[2].grade).toBe('slip')
  })

  it('finds the biggest single fix, rescoring later decisions', () => {
    const keys = wayKeysOf(fixture())
    // Raise at decision 1 (slip, 5) and get hit at decision 3 (blunder, 20): score 75.
    const choices = [RAISE, BEST, HIT, BEST]
    expect(scoreRun(keys, choices).score).toBe(75)
    // Changing decision 1 to the best way gains 5 and avoids the flag (+15): 20.
    // Changing decision 3 to the best way also gains 20. Ties go to the earliest.
    expect(bestSingleFix(keys, choices)).toEqual({ decision: 0, gain: 20 })
    expect(bestSingleFix(keys, [BEST, BEST, BEST, BEST])).toEqual({ decision: -1, gain: 0 })
  })

  it('counts every path and the share a score beats', () => {
    const { scoreCounts, endings, guessAverage } = analyse(wayKeysOf(fixture()))
    expect(scoreCounts.reduce((a, b) => a + b, 0)).toBe(PATHS)
    expect(endings.good + endings.ok + endings.bad).toBe(PATHS)
    expect(beatsShare(scoreCounts, 100)).toBe(99)
    expect(beatsShare(scoreCounts, 0)).toBe(0)
    expect(expectedScore(wayKeysOf(fixture()), () => [0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(guessAverage)
  })
})

describe('checkScenario', () => {
  it('accepts the fixture', () => {
    expect(checkScenario(fixture())).toEqual([])
  })

  it('refuses wrong counts, unknown flags and an override that is not worse', () => {
    const draft = fixture()
    draft.decisions[1].approaches[2].ways.pop()
    draft.decisions[0].approaches[0].ways[1].raises = ['nope']
    draft.decisions[2].approaches[0].ways[1].ifRaised!.grade = 'slip'
    const problems = shapeProblems(draft)
    expect(problems).toContain('decision 2 approach 3 needs exactly 3 ways')
    expect(problems).toContain('decision 1 approach 1 way 2 raises a flag that does not exist')
    expect(problems).toContain('decision 3 approach 1 way 2 flag reaction must be graded worse than the way itself')
  })

  it('refuses bad flag ids and too many flags', () => {
    const draft = fixture()
    draft.flags = [{ id: 'Bad Id', label: 'x' }]
    expect(shapeProblems(draft)).toContain('flag 1 id must be lowercase letters, digits or dashes')
    draft.flags = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id }))
    expect(shapeProblems(draft)).toEqual(['needs 1 to 3 flags'])
  })

  it('makes the wrong plan cost more than an imprecise way', () => {
    const twoBest = fixture()
    twoBest.decisions[0].approaches[1].ways[1].grade = 'best'
    expect(mixProblems(twoBest)).toContain('decision 1 needs exactly one best way')

    const noSlip = fixture()
    noSlip.decisions[1].approaches[0].ways[1].grade = 'mistake'
    expect(mixProblems(noSlip)).toContain('decision 2: the approach with the best way also needs a slip and a mistake or blunder')

    const cheapWrong = fixture()
    cheapWrong.decisions[2].approaches[2].ways[0].grade = 'slip'
    expect(mixProblems(cheapWrong)).toContain('decision 3: the two other approaches may hold at most one slip between them')

    const noBlunder = fixture()
    for (const a of noBlunder.decisions[3].approaches) for (const w of a.ways) if (w.grade === 'blunder') w.grade = 'mistake'
    expect(mixProblems(noBlunder)).toContain('decision 4 needs at least one blunder')
  })

  it('requires every flag to matter later and the best line to score 100', () => {
    const unused = fixture()
    delete unused.decisions[2].approaches[0].ways[1].ifRaised
    expect(flagProblems(unused)).toContain('flag "promise" must be raised at one decision and change a way at a later one')

    const tooEarly = fixture()
    tooEarly.decisions[0].approaches[0].ways[2].ifRaised = { flag: 'promise', grade: 'blunder', outcome: 'o', why: 'w' }
    expect(flagProblems(tooEarly)).toContain('decision 1: a way reacts to flag "promise", which no earlier decision raises')

    const hitsBest = fixture()
    hitsBest.decisions[0].approaches[0].ways[0].raises = ['promise']
    hitsBest.decisions[3].approaches[0].ways[0].ifRaised = { flag: 'promise', grade: 'slip', outcome: 'o', why: 'w' }
    expect(flagProblems(hitsBest)).toContain('taking the best way at every decision scores 95, not 100')
  })

  it('refuses surface giveaways', () => {
    const long = fixture()
    long.decisions[0].approaches[0].ways[0].text = 'A much, much longer option text that runs on and on'
    expect(giveawayProblems(long)).toContain('decision 1 approach 1: way texts differ too much in length')

    const cue = fixture()
    cue.decisions[1].approaches[0].ways[0].text = 'Calmly do 100 for this step'
    expect(giveawayProblems(cue)).toContain('decision 2: only the best way uses a sounds-right word')
    cue.decisions[1].approaches[0].ways[2].text = 'Politely do 102 for this step'
    expect(giveawayProblems(cue)).not.toContain('decision 2: only the best way uses a sounds-right word')

    const echo = fixture()
    echo.decisions[0].approaches[1].ways[1].why = 'Because option 010 for this step was safer.'
    expect(giveawayProblems(echo)).toContain('decision 1 approach 2 way 2: its why copies a sibling way\'s text')
  })

  it('refuses a scenario where always picking the longest option wins', () => {
    const draft = fixture()
    for (const decision of draft.decisions) {
      decision.approaches[0].text += ' (+ten more)'
      decision.approaches[0].ways[0].text += ' (+ten more)'
    }
    const problems = giveawayProblems(draft)
    expect(problems.some((p) => p.startsWith('picking always the longest averages 100'))).toBe(true)
  })

  it('refuses a scenario that random picking scores well on', () => {
    const lenient = fixture()
    for (const d of lenient.decisions) for (const a of d.approaches) for (const w of a.ways) if (w.grade !== 'best') w.grade = 'slip'
    const problems = behaviourProblems(lenient)
    expect(problems.some((p) => p.includes('of paths end bad'))).toBe(true)
    expect(problems.some((p) => p.startsWith('random picking averages'))).toBe(true)
  })

  it('finds runs of repeated words', () => {
    expect(echoes('it was the right thing to do', 'the right thing to do now')).toBe(true)
    expect(echoes('it was the right call', 'the right thing to do now')).toBe(false)
  })
})

describe('drafts', () => {
  it('splits a draft so the readable half holds no answers', () => {
    const { scenario, answers } = splitDraft(fixture())
    expect(JSON.stringify(scenario)).not.toMatch(/"(grade|why|outcome|raises|ifRaised|wayKeys)"\s*:/)
    expect(scenario.guessAverage).toBe(analyse(answers.wayKeys).guessAverage)
    expect(answers.wayKeys[0][1][0].raises).toEqual(['promise'])
    expect(answers.format).toBe(2)
  })

  it('trims text without inventing parts', () => {
    const draft = fixture()
    draft.title = '  Fixture  '
    draft.decisions[0].approaches[0].ways[0].why = ' Reason. '
    const fixed = repairDraft(draft)
    expect(fixed.title).toBe('Fixture')
    expect(fixed.decisions[0].approaches[0].ways[0].why).toBe('Reason.')
    expect(fixed.decisions[0].approaches[1].ways[0].raises).toEqual(['promise'])
  })

  it('shuffles the same way for the same seed and keeps the scenario valid', () => {
    const a = shuffleDraft(fixture(), seededRandom('fixture@v2'))
    const b = shuffleDraft(fixture(), seededRandom('fixture@v2'))
    expect(a).toEqual(b)
    expect(checkScenario(a)).toEqual([])
    expect(scoreRun(wayKeysOf(a), bestLine(a)).score).toBe(100)
    expect(analyse(wayKeysOf(a)).guessAverage).toBe(analyse(wayKeysOf(fixture())).guessAverage)
  })
})

describe('starters', () => {
  it.each(STARTERS.map((s) => [s.id, s] as const))('%s passes every check', (_id, starter) => {
    expect(checkScenario(starter)).toEqual([])
  })
})
