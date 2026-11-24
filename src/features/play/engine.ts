/**
 * The game rules, as plain functions with no I/O, so the same code runs in the
 * worker (actions) and in unit tests.
 *
 * Meters run 0-100 and higher is always better. Each pick adds its delta to
 * the meters, clamped to 0-100. After five picks the final meters decide the
 * ending (`endingFor`).
 */
import {
  METERS,
  OPTIONS,
  SCENES,
  type Effect,
  type Ending,
  type OptionKind,
  type PublicScenario,
  type ScenarioAnswers,
  type ScenarioDraft,
} from './types'

export const METER_MIN = 0
export const METER_MAX = 100
export const DELTA_LIMIT = 25
export const START_MIN = 30
export const START_MAX = 70
/** Of the 3^5 = 243 possible paths, each ending must be reachable by at least this many. */
export const MIN_PATHS_PER_ENDING = 5

/** Text limits checked on every scenario, starters and generated alike. */
export const LIMITS = {
  title: 80,
  situation: 400,
  setting: 600,
  meterName: 24,
  prompt: 300,
  optionText: 140,
  outcome: 400,
  why: 300,
  ending: 600,
} as const

export function clampMeter(value: number): number {
  return Math.max(METER_MIN, Math.min(METER_MAX, value))
}

export function applyDelta(meters: number[], delta: number[]): number[] {
  return meters.map((value, i) => clampMeter(value + (delta[i] ?? 0)))
}

/**
 * bad: any meter at 15 or below, or the average under 40.
 * good: average 65 or more with no meter under 30.
 * ok: everything in between.
 */
export function endingFor(meters: number[]): Ending {
  const mean = meters.reduce((sum, v) => sum + v, 0) / meters.length
  if (meters.some((v) => v <= 15) || mean < 40) return 'bad'
  if (mean >= 65 && !meters.some((v) => v < 30)) return 'good'
  return 'ok'
}

/** Final meters after picking `path[i]` at each decision i. */
export function playPath(starts: number[], effects: Effect[][], path: number[]): number[] {
  return path.reduce((meters, option, scene) => applyDelta(meters, effects[scene][option].delta), starts)
}

/** How many of the 243 possible paths end good, ok and bad. */
export function countEndings(starts: number[], effects: Effect[][]): Record<Ending, number> {
  const counts: Record<Ending, number> = { good: 0, ok: 0, bad: 0 }
  const total = OPTIONS ** SCENES
  for (let n = 0; n < total; n++) {
    const path: number[] = []
    let rest = n
    for (let i = 0; i < SCENES; i++) {
      path.push(rest % OPTIONS)
      rest = Math.floor(rest / OPTIONS)
    }
    counts[endingFor(playPath(starts, effects, path))]++
  }
  return counts
}

/** The decision whose pick moved the meters the most (sum of absolute changes). */
export function turningPoint(meterHistory: number[][]): number {
  let best = 0
  let bestSwing = -1
  for (let i = 0; i + 1 < meterHistory.length; i++) {
    const swing = meterHistory[i + 1].reduce((sum, v, k) => sum + Math.abs(v - meterHistory[i][k]), 0)
    if (swing > bestSwing) {
      best = i
      bestSwing = swing
    }
  }
  return best
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

function textProblem(label: string, value: unknown, max: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return `${label} is empty`
  if (value.length > max) return `${label} is longer than ${max} characters`
  return null
}

/**
 * Every rule a scenario must pass before it can be played. Returns the
 * problems found; an empty list means the scenario is playable.
 *
 * Beyond shape and limits, it checks that the choices matter: within each
 * decision the best option's deltas must sum higher than the ok option's,
 * and the ok option's higher than the trap's; picking the best option at
 * every decision must end good, the ok option at every decision ok, and the
 * trap at every decision bad; and across all 243 paths each ending must be
 * reached at least MIN_PATHS_PER_ENDING times. It does not promise that one
 * best pick on a mixed path always helps every meter.
 */
export function checkScenario(draft: ScenarioDraft): string[] {
  const problems: string[] = []
  const add = (p: string | null) => {
    if (p) problems.push(p)
  }

  add(textProblem('title', draft?.title, LIMITS.title))
  add(textProblem('situation', draft?.situation, LIMITS.situation))
  add(textProblem('setting', draft?.setting, LIMITS.setting))

  if (!Array.isArray(draft?.meters) || draft.meters.length !== METERS) {
    problems.push(`needs exactly ${METERS} meters`)
    return problems
  }
  draft.meters.forEach((m, i) => {
    add(textProblem(`meter ${i + 1} name`, m?.name, LIMITS.meterName))
    if (!Number.isInteger(m?.start) || m.start < START_MIN || m.start > START_MAX) {
      problems.push(`meter ${i + 1} must start between ${START_MIN} and ${START_MAX}`)
    }
  })

  if (!Array.isArray(draft.scenes) || draft.scenes.length !== SCENES) {
    problems.push(`needs exactly ${SCENES} scenes`)
    return problems
  }
  draft.scenes.forEach((scene, s) => {
    add(textProblem(`scene ${s + 1} prompt`, scene?.prompt, LIMITS.prompt))
    if (!Array.isArray(scene?.options) || scene.options.length !== OPTIONS) {
      problems.push(`scene ${s + 1} needs exactly ${OPTIONS} options`)
      return
    }
    scene.options.forEach((o, i) => {
      const where = `scene ${s + 1} option ${i + 1}`
      add(textProblem(`${where} text`, o?.text, LIMITS.optionText))
      add(textProblem(`${where} outcome`, o?.outcome, LIMITS.outcome))
      add(textProblem(`${where} why`, o?.why, LIMITS.why))
      const deltaOk =
        Array.isArray(o?.delta) &&
        o.delta.length === METERS &&
        o.delta.every((d) => Number.isInteger(d) && Math.abs(d) <= DELTA_LIMIT)
      if (!deltaOk) problems.push(`${where} needs ${METERS} whole-number changes between -${DELTA_LIMIT} and ${DELTA_LIMIT}`)
    })
    const kinds = scene.options.map((o) => o?.kind).sort().join(',')
    if (kinds !== 'best,ok,trap') {
      problems.push(`scene ${s + 1} needs one best, one ok and one trap option`)
    }
  })
  if (problems.length > 0) return problems

  // Shape is sound from here on: check that the picks behave as labelled.
  draft.scenes.forEach((scene, s) => {
    const total = (kind: OptionKind) => sum(scene.options.find((o) => o.kind === kind)!.delta)
    if (!(total('best') > total('ok') && total('ok') > total('trap'))) {
      problems.push(`scene ${s + 1}: the best option must help more than the ok one, and the ok one more than the trap`)
    }
  })

  const starts = draft.meters.map((m) => m.start)
  const effects = toEffects(draft)
  const pathOf = (kind: OptionKind) => draft.scenes.map((scene) => scene.options.findIndex((o) => o.kind === kind))
  const expected: Record<OptionKind, Ending> = { best: 'good', ok: 'ok', trap: 'bad' }
  for (const kind of ['best', 'ok', 'trap'] as const) {
    const got = endingFor(playPath(starts, effects, pathOf(kind)))
    if (got !== expected[kind]) problems.push(`picking every ${kind} option ends ${got}, not ${expected[kind]}`)
  }
  const counts = countEndings(starts, effects)
  for (const ending of ['good', 'ok', 'bad'] as const) {
    if (counts[ending] < MIN_PATHS_PER_ENDING) {
      problems.push(`only ${counts[ending]} of 243 paths end ${ending}; needs at least ${MIN_PATHS_PER_ENDING}`)
    }
  }
  for (const ending of ['good', 'ok', 'bad'] as const) {
    add(textProblem(`${ending} ending`, draft.endings?.[ending], LIMITS.ending))
  }
  return problems
}

function toEffects(draft: ScenarioDraft): Effect[][] {
  return draft.scenes.map((scene) =>
    scene.options.map((o) => ({ delta: o.delta, outcome: o.outcome, kind: o.kind, why: o.why })),
  )
}

/** Separates a draft into its readable half and its hidden half. */
export function splitDraft(draft: ScenarioDraft): {
  scenario: PublicScenario
  answers: Omit<ScenarioAnswers, 'scenarioId'>
} {
  return {
    scenario: {
      title: draft.title,
      situation: draft.situation,
      setting: draft.setting,
      meters: draft.meters.map((m) => ({ name: m.name, start: m.start })),
      scenes: draft.scenes.map((scene) => ({ prompt: scene.prompt, options: scene.options.map((o) => o.text) })),
    },
    answers: { effects: toEffects(draft), endings: { ...draft.endings } },
  }
}

/**
 * Fixes what is safe to fix in AI output before it is checked: rounds and
 * clamps the meter changes and starts, and trims every text. It never invents
 * missing parts; those still fail `checkScenario`.
 */
export function repairDraft(draft: ScenarioDraft): ScenarioDraft {
  const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v) as string
  const round = (v: unknown, lo: number, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : (v as number)
  return {
    ...draft,
    title: trim(draft.title),
    situation: trim(draft.situation),
    setting: trim(draft.setting),
    meters: (draft.meters ?? []).map((m) => ({ name: trim(m?.name), start: round(m?.start, START_MIN, START_MAX) })),
    scenes: (draft.scenes ?? []).map((scene) => ({
      prompt: trim(scene?.prompt),
      options: (scene?.options ?? []).map((o) => ({
        text: trim(o?.text),
        kind: o?.kind,
        delta: (o?.delta ?? []).map((d) => round(d, -DELTA_LIMIT, DELTA_LIMIT)),
        outcome: trim(o?.outcome),
        why: trim(o?.why),
      })),
    })),
    endings: {
      good: trim(draft.endings?.good),
      ok: trim(draft.endings?.ok),
      bad: trim(draft.endings?.bad),
    },
  }
}

/**
 * Shuffles the options inside each scene so the best pick is not always in
 * the same place. `random` returns a number in [0, 1); tests pass a fixed one.
 */
export function shuffleOptions(draft: ScenarioDraft, random: () => number = Math.random): ScenarioDraft {
  return {
    ...draft,
    scenes: draft.scenes.map((scene) => {
      const options = [...scene.options]
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[options[i], options[j]] = [options[j], options[i]]
      }
      return { ...scene, options }
    }),
  }
}
