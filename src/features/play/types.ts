/**
 * Shapes shared by the worker (actions, seeds) and the pages.
 *
 * A scenario has two halves:
 * - the readable half (`PublicScenario`): title, setting, meter names, the five
 *   prompts and the option texts. Stored in `scenarios`, copied into each run.
 * - the hidden half (`ScenarioAnswers`): what each option does to the meters,
 *   its outcome text, whether it was the best/ok/trap pick and why, plus the
 *   three ending texts. Stored in `scenario_answers`, which no client role can
 *   read; only server actions open it.
 *
 * `ScenarioDraft` is both halves together: the format starters are written in
 * and the format the AI generator returns. `splitDraft` (engine.ts) separates them.
 */

export const SCENES = 5
export const OPTIONS = 3
export const METERS = 3

export type OptionKind = 'best' | 'ok' | 'trap'
export type Ending = 'good' | 'ok' | 'bad'

export interface Meter {
  name: string
  start: number
}

export interface DraftOption {
  text: string
  kind: OptionKind
  /** Change to each meter, in meter order. */
  delta: number[]
  outcome: string
  why: string
}

export interface DraftScene {
  prompt: string
  options: DraftOption[]
}

export interface ScenarioDraft {
  id?: string
  title: string
  situation: string
  setting: string
  meters: Meter[]
  scenes: DraftScene[]
  endings: Record<Ending, string>
}

/** Readable half of a scenario. */
export interface PublicScene {
  prompt: string
  options: string[]
}

export interface PublicScenario {
  title: string
  situation: string
  setting: string
  meters: Meter[]
  scenes: PublicScene[]
}

export type Visibility = 'private' | 'public'

/** A row of the `scenarios` collection. */
export interface ScenarioRow extends PublicScenario {
  visibility: Visibility
  starter: boolean
  /** Who wrote it; '' for starters. Ownership for 'own' and 'published' rules. */
  authorId: string
  /** Starters only: bumped when starter text changes so the seed rewrites them. */
  seedVersion: number
}

/** What one option does, as stored in `scenario_answers`. */
export interface Effect {
  delta: number[]
  outcome: string
  kind: OptionKind
  why: string
}

/** A row of the `scenario_answers` collection (recordId = the scenario's recordId). */
export interface ScenarioAnswers {
  scenarioId: string
  /** effects[scene][option] */
  effects: Effect[][]
  endings: Record<Ending, string>
}

export interface DebriefItem {
  kind: OptionKind
  why: string
}

export type RunStatus = 'playing' | 'done'

/** A row of the `runs` collection: one play-through by one player. */
export interface RunRow {
  scenarioId: string
  playerId: string
  /** The run this one was rewound from; '' for a first run. */
  parentRunId: string
  /** The decision (0-4) where this run splits from its parent; -1 for a first run. */
  branchAt: number
  /** The readable half as it was when the run started, so later edits never change it. */
  snapshot: PublicScenario
  /** Option index picked at each decision so far. */
  choices: number[]
  /** Meter values: index 0 is the start, index i+1 is after decision i. */
  meterHistory: number[][]
  /** Outcome text of each decision so far. */
  outcomes: string[]
  status: RunStatus
  ending: Ending | ''
  endingText: string
  /** Filled when the run ends: what each pick was and why. */
  debrief: DebriefItem[]
}
