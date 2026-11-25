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
  gainsByDecision,
  flagProblems,
  fromChoice,
  giveawayProblems,
  HEURISTICS,
  hintFor,
  HINT_NOWHERE,
  NO_SINGLE_FIX,
  LENGTH_RULES,
  longestBestCount,
  mixProblems,
  PATHS,
  repairDraft,
  replay,
  sameWords,
  scoreRun,
  seededRandom,
  shapeProblems,
  shuffleDraft,
  splitDraft,
  toChoice,
  tunnelCounts,
  wayKeysOf,
  WRONG_CUE_PATTERN,
} from './engine'
import { fixture, MIX } from './fixture'
import { CHOICES, DECISIONS, type DraftWay, type Grade, type ScenarioDraft, type WayAnswer } from './types'

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

describe('gainsByDecision', () => {
  /** The earlier whole-path search bestSingleFix used before it was built on gainsByDecision. */
  function searchFix(keys: WayAnswer[][][], choices: number[]) {
    const base = scoreRun(keys, choices).score
    let fix = { decision: -1, gain: 0 }
    for (let d = 0; d < choices.length; d++) {
      for (let ch = 0; ch < CHOICES; ch++) {
        if (ch === choices[d]) continue
        const changed = [...choices]
        changed[d] = ch
        const gain = scoreRun(keys, changed).score - base
        if (gain > fix.gain) fix = { decision: d, gain }
      }
    }
    return fix
  }

  it('gives the best gain per decision, 0 where nothing helps', () => {
    const keys = wayKeysOf(fixture())
    expect(gainsByDecision(keys, [RAISE, BEST, HIT, BEST])).toEqual([20, 0, 20, 0])
    expect(gainsByDecision(keys, [BEST, BEST, BEST, BEST])).toEqual([0, 0, 0, 0])
    expect(gainsByDecision(keys, [c(0, 2), BEST, c(0, 1), BEST])).toEqual([12, 0, 5, 0])
  })

  it('agrees with the whole-path search on many random choice lists', () => {
    const random = seededRandom('gains-vs-search')
    const pick = () => Math.floor(random() * CHOICES)
    for (const keys of [wayKeysOf(fixture()), wayKeysOf(STARTERS[0]), wayKeysOf(STARTERS[4])]) {
      for (let i = 0; i < 60; i++) {
        const choices = [pick(), pick(), pick(), pick()]
        expect(bestSingleFix(keys, choices)).toEqual(searchFix(keys, choices))
        const gains = gainsByDecision(keys, choices)
        expect(gains).toHaveLength(DECISIONS)
        const max = Math.max(...gains)
        expect(bestSingleFix(keys, choices)).toEqual({ decision: max > 0 ? gains.indexOf(max) : -1, gain: max })
      }
    }
  })
})

describe('tunnelCounts', () => {
  /** Counts good endings by decoding every path number, without sharing code with tunnelCounts. */
  function brute(keys: WayAnswer[][][], choices: number[]) {
    const counts = [0, 0, 0, 0, 0]
    for (let n = 0; n < PATHS; n++) {
      const path = [0, 1, 2, 3].map((d) => Math.floor(n / CHOICES ** d) % CHOICES)
      if (scoreRun(keys, path).score < 90) continue
      for (let k = 0; k <= DECISIONS; k++) if (path.slice(0, k).every((ch, d) => ch === choices[d])) counts[k]++
    }
    return counts
  }

  it('matches a brute-force count, starts at every good path and ends at 0 or 1', () => {
    const random = seededRandom('tunnel')
    const pick = () => Math.floor(random() * CHOICES)
    for (const keys of [wayKeysOf(fixture()), wayKeysOf(STARTERS[1])]) {
      const good = analyse(keys).endings.good
      for (let i = 0; i < 8; i++) {
        const choices = i === 0 ? [BEST, BEST, BEST, BEST] : [pick(), pick(), pick(), pick()]
        const tunnel = tunnelCounts(keys, choices)
        expect(tunnel).toHaveLength(DECISIONS + 1)
        expect(tunnel[0]).toBe(good)
        expect(tunnel[4]).toBe(scoreRun(keys, choices).ending === 'good' ? 1 : 0)
        for (let k = 1; k <= DECISIONS; k++) expect(tunnel[k]).toBeLessThanOrEqual(tunnel[k - 1])
        expect(tunnel).toEqual(brute(keys, choices))
      }
    }
  })

  it('shrinks to nothing along a path that has lost every good ending', () => {
    const keys = wayKeysOf(fixture())
    expect(tunnelCounts(keys, [c(1, 2), c(1, 2), c(1, 2), c(1, 2)]).slice(1)).toEqual([expect.any(Number), 0, 0, 0])
  })
})

describe('hintFor', () => {
  const keys = wayKeysOf(fixture())
  /** The hint a player gets for `guess` (4 = nowhere) after finishing `choices`. */
  const hintOf = (choices: number[], guess: number, k = keys) => {
    const { steps, score } = scoreRun(k, choices)
    return hintFor(guess, score, steps, gainsByDecision(k, choices))
  }
  const MISTAKE = c(0, 2)
  const SLIP = c(0, 1)

  it('rule 1: a perfect run gets the same line for every guess, "none" included', () => {
    for (let d = 0; d <= HINT_NOWHERE; d++) expect(hintOf([BEST, BEST, BEST, BEST], d)).toBe(NO_SINGLE_FIX)
  })

  it('rule 2: "none" after losing points, when one change would help', () => {
    expect(hintOf([SLIP, BEST, BEST, BEST], HINT_NOWHERE)).toBe('One change would win points back. Look again.')
  })

  it('rule 3: no single change helps', () => {
    const flat = wayKeysOf(fixture())
    for (const decision of flat) for (const approach of decision) for (const way of approach) way.grade = 'slip'
    for (const decision of flat) for (const approach of decision) for (const way of approach) delete way.ifRaised
    const choices = [BEST, c(1, 1), c(2, 2), BEST]
    expect(scoreRun(flat, choices).score).toBe(80)
    // "None" reads exactly as on a perfect run, so it does not confirm the run lost points.
    expect(hintOf(choices, HINT_NOWHERE, flat)).toBe(NO_SINGLE_FIX)
    expect(hintOf(choices, 0, flat)).toBe('That one cost you, but changing it alone wins nothing back.')
  })

  it('rule 5: the guess is the one best place', () => {
    expect(hintOf([BEST, BEST, MISTAKE, BEST], 2)).toBe('Yes. Changing that one decision would win back more than changing any other.')
  })

  it('rule 6: the guess is one of several best places', () => {
    const blunders = [c(1, 2), c(1, 2), c(1, 2), c(1, 2)]
    for (let d = 0; d < 4; d++) expect(hintOf(blunders, d)).toBe('Yes. That is one of the best places to change.')
  })

  it('rule 7: the guessed step was set up by an earlier choice that is a best place', () => {
    const custom = wayKeysOf(fixture())
    // Decision 3 has no best way and no way worse than a mistake except the flagged one, so fixing decision 1 gains more.
    for (const approach of custom[2]) for (const way of approach) way.grade = 'mistake'
    custom[2][0][1].grade = 'slip'
    const choices = [RAISE, BEST, HIT, BEST]
    const gains = gainsByDecision(custom, choices)
    expect(gains).toEqual([20, 0, 8, 0])
    expect(hintOf(choices, 2, custom)).toBe('It went wrong there, but an earlier choice set it up.')
    // A guess at the decision that set it up is the best place itself.
    expect(hintOf(choices, 0, custom)).toBe('Yes. Changing that one decision would win back more than changing any other.')
  })

  it('rule 8: it cost points but is not the biggest fix; points to the nearest best place', () => {
    const later = [SLIP, BEST, MISTAKE, BEST]
    expect(hintOf(later, 0)).toBe('That one cost you, but it is not your biggest fix. Look later.')
    const earlier = [MISTAKE, BEST, SLIP, BEST]
    expect(hintOf(earlier, 2)).toBe('That one cost you, but it is not your biggest fix. Look earlier.')
  })

  it('rule 9: it cost nothing by itself; points to the nearest best place', () => {
    const choices = [BEST, BEST, MISTAKE, BEST]
    expect(hintOf(choices, 0)).toBe('That one cost nothing by itself. Look later.')
    expect(hintOf(choices, 3)).toBe('That one cost nothing by itself. Look earlier.')
  })

  it('rules 8 and 9: an equal distance to two best places goes to the earlier one', () => {
    expect(hintOf([MISTAKE, BEST, MISTAKE, BEST], 1)).toBe('That one cost nothing by itself. Look earlier.')
    expect(hintOf([MISTAKE, SLIP, MISTAKE, BEST], 1)).toBe('That one cost you, but it is not your biggest fix. Look earlier.')
  })

  it('never names an option or a grade', () => {
    const lines = [0, 1, 2, 3, 4].flatMap((g) => [hintOf([RAISE, BEST, HIT, BEST], g), hintOf([BEST, BEST, BEST, BEST], g)])
    for (const line of lines) expect(line).not.toMatch(/slip|mistake|blunder|best way|option/i)
  })
})

describe('checkScenario', () => {
  it('names as length rules only guessing rules that exist and go by length alone', () => {
    expect(LENGTH_RULES.length).toBe(3)
    for (const name of LENGTH_RULES) {
      const rule = HEURISTICS[name]
      expect(rule).toBeTypeOf('function')
      // Same lengths, different words: a length rule cannot tell them apart.
      expect(rule('aaaa', ['aaaa', 'bb', 'cccccc'])).toBe(rule('dddd', ['dddd', 'ee', 'ffffff']))
    }
    expect(LENGTH_RULES).not.toContain('prefer sounds-right words')
  })

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

  it('refuses a best way that is the longest of its approach in more than 2 decisions', () => {
    const message = 'the best way is the longest of its approach in 3 of 4 decisions, more than 2'
    const lengthen = (draft: ReturnType<typeof fixture>, d: number) => {
      draft.decisions[d].approaches[0].ways[0].text += 's'
    }
    const two = fixture()
    lengthen(two, 0)
    lengthen(two, 1)
    expect(longestBestCount(two)).toBe(2)
    expect(giveawayProblems(two)).not.toContain(message)

    const three = fixture()
    for (const d of [0, 1, 2]) lengthen(three, d)
    expect(longestBestCount(three)).toBe(3)
    expect(giveawayProblems(three)).toContain(message)

    // A tie with another way of the approach does not count as longest.
    three.decisions[2].approaches[0].ways[1].text += 's'
    expect(longestBestCount(three)).toBe(2)
    expect(giveawayProblems(three)).not.toContain(message)
  })

  it('treats a composed and a decomposed accent as the same letter', () => {
    expect(sameWords('Ask José today', 'Ask Jose\u0301 today')).toBe(true)
    expect(sameWords('Ask José today', 'Ask Jose today')).toBe(false)
  })

  it('refuses two options with the same words, across approaches too', () => {
    const same = fixture()
    // Case and punctuation do not make two texts different.
    same.decisions[0].approaches[2].ways[1].text = 'option 000, for this step!'
    expect(giveawayProblems(same)).toContain('decision 1: approach 1 way 1 and approach 3 way 2 have the same text')
    same.decisions[1].approaches[1].text = same.decisions[1].approaches[0].text
    expect(giveawayProblems(same)).toContain('decision 2: approach 1 and approach 2 have the same text')
  })

  it('refuses an option worded as a poor choice, but not words that name sound moves', () => {
    const rude = fixture()
    rude.decisions[2].approaches[1].ways[0].text = 'Loudly do 210 for this step'
    expect(giveawayProblems(rude)).toContain('decision 3 approach 2 way 1: uses a word that marks it as a poor choice ("loudly")')
    rude.decisions[2].approaches[2].text = 'Demand a refund at once'
    expect(giveawayProblems(rude)).toContain('decision 3 approach 3: uses a word that marks it as a poor choice ("demand")')
    rude.decisions[3].approaches[0].ways[2].text = 'Get even with 302 for this step'
    expect(giveawayProblems(rude)).toContain('decision 4 approach 1 way 3: uses a word that marks it as a poor choice ("get even")')

    const sound = fixture()
    sound.decisions[0].approaches[2].text = 'Refuse and insist on a demand letter'
    sound.decisions[0].approaches[1].text = 'Call the police and walk away now'
    sound.decisions[0].approaches[0].text = 'Ask a lawyer to check it immediately'
    expect(giveawayProblems(sound).filter((p) => p.includes('poor choice'))).toEqual([])
  })

  it('catches past forms of the cue words and lets only the named sound uses through', () => {
    const flagged = ['You lied about the date', 'Say you threatened to leave', 'Send it after you demanded it', 'Tell them you got even', 'Write a revenge letter', 'Print it on demand letterhead', 'Ask publicly at the meeting', 'Keep lying to the client']
    for (const text of flagged) expect(WRONG_CUE_PATTERN.test(text), text).toBe(true)
    const sound = ['Send a demand letter by mail', 'Send two demand-letters', 'Lie down and rest first', 'Lie low until Monday', 'Book a mock interview', "Say it's a shame it happened", 'Publicly thank the team', 'She lies down first', 'Keep lying low for a week', 'Publicly thanked the client', 'Start by publicly praising her work']
    for (const text of sound) expect(WRONG_CUE_PATTERN.test(text), text).toBe(false)
  })

  it('reads curly and straight apostrophes as the same, and keeps letters of other languages', () => {
    const same = fixture()
    same.decisions[0].approaches[0].ways[0].text = "Say it's done today"
    same.decisions[0].approaches[1].ways[0].text = 'Say it’s done today'
    expect(giveawayProblems(same)).toContain('decision 1: approach 1 way 1 and approach 2 way 1 have the same text')
    const names = fixture()
    names.decisions[0].approaches[0].ways[0].text = 'Ask José to sign today'
    names.decisions[0].approaches[1].ways[0].text = 'Ask Jos to sign today'
    expect(giveawayProblems(names).some((p) => p.includes('have the same text'))).toBe(false)
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
