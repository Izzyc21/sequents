/**
 * Shapes shared by the worker (actions, seeds) and the pages.
 *
 * A scenario is 4 decisions. Each decision offers 3 approaches (what you do)
 * and each approach 3 ways (exactly how, when or with what), so a decision
 * has 9 end choices. Each way has a hidden grade that costs points; a run
 * starts at 100 and loses the points of each way picked.
 *
 * A scenario has two halves:
 * - the readable half (`PublicScenario`): title, setting, the prompts and the
 *   approach and way texts. Stored in `scenarios`, copied into each run.
 * - the hidden half (`ScenarioAnswers`): each way's grade, outcome and why,
 *   the flags (delayed consequences) and the three ending texts. Stored in
 *   `scenario_answers`, which no browser role can read; only server actions
 *   open it.
 *
 * `ScenarioDraft` is both halves together: the format starters are written in
 * and the format generated scenarios are mapped into. `splitDraft` (engine.ts)
 * separates them.
 */

export const DECISIONS = 4
export const APPROACHES = 3
export const WAYS = 3
/** End choices per decision. A choice is stored as one number: approach * WAYS + way. */
export const CHOICES = APPROACHES * WAYS

/** Rows written in this shape carry `format: 2`; rows from the first version have none. */
export const FORMAT = 2

export type Grade = 'best' | 'slip' | 'mistake' | 'blunder'
export type Ending = 'good' | 'ok' | 'bad'

/** Points a way of each grade costs. */
export const GRADE_POINTS: Record<Grade, number> = { best: 0, slip: 5, mistake: 12, blunder: 20 }

/** Score bands for the ending: at or above `good` is good, at or above `ok` is ok, else bad. */
export const BANDS = { good: 90, ok: 70 }

/**
 * A delayed consequence. A way can raise it; a way at a later decision can
 * then play worse than it normally would (`ifRaised`).
 */
export interface Flag {
  /** Lowercase letters, digits and dashes, starting with a letter, at most 24 characters. */
  id: string
  /** Shown in the debrief once unlocked, e.g. "You promised the client Friday". */
  label: string
}

/** How a way plays when a flag was raised at an earlier decision. Its grade is always worse than the way's own. */
export interface Override {
  flag: string
  grade: Grade
  outcome: string
  why: string
}

/** The hidden half of one way. */
export interface WayAnswer {
  grade: Grade
  /** What happens right after; shown as soon as the way is locked in. */
  outcome: string
  /** Why it cost points or was best; shown in the debrief once unlocked. */
  why: string
  /** Flags this way raises, applied after it is scored. */
  raises?: string[]
  ifRaised?: Override
}

export interface DraftWay extends WayAnswer {
  text: string
}

export interface DraftApproach {
  text: string
  ways: DraftWay[]
}

export interface DraftDecision {
  prompt: string
  approaches: DraftApproach[]
}

export interface ScenarioDraft {
  id?: string
  title: string
  situation: string
  setting: string
  decisions: DraftDecision[]
  flags: Flag[]
  endings: Record<Ending, string>
}

/** Readable half of one decision. */
export interface PublicDecision {
  prompt: string
  approaches: { text: string; ways: string[] }[]
}

export interface PublicScenario {
  title: string
  situation: string
  setting: string
  decisions: PublicDecision[]
  /** Mean score over every possible path: what picking at random scores on average. */
  guessAverage: number
}

export type Visibility = 'private' | 'public'

/** A row of the `scenarios` collection. */
export interface ScenarioRow extends PublicScenario {
  format: number
  visibility: Visibility
  starter: boolean
  /** Who wrote it; '' for starters. Ownership for 'own' and 'published' rules. */
  authorId: string
  /** Starters only: bumped when starter text changes so the seed rewrites them. */
  seedVersion: number
  /**
   * recordId of the `scenario_answers` row that goes with this readable text.
   * A starter gets a new answers row per seed version, so a run started on the
   * old text keeps playing against the old answers.
   */
  answersId: string
  /** Set when the app owner took it down; the author can no longer publish it. */
  takenDown?: boolean
}

/** A row of the `scenario_answers` collection (recordId = the scenario's `answersId`). */
export interface ScenarioAnswers {
  scenarioId: string
  format: number
  /** wayKeys[decision][approach][way] */
  wayKeys: WayAnswer[][][]
  flags: Flag[]
  endings: Record<Ending, string>
}

/** How one locked-in choice was scored. Holds no reason text: reasons unlock separately (explain action). */
export interface StepResult {
  grade: Grade
  points: number
  /** The way's own grade; differs from `grade` only when a flag changed it. */
  base: Grade
  /** Decision whose pick raised the flag that changed this grade; -1 if none. */
  causedBy: number
}

/** The one changed choice that would have gained the most points; decision -1 when none gains. */
export interface Fix {
  decision: number
  gain: number
}

export type RunStatus = 'playing' | 'done'

/** A row of the `runs` collection: one play-through by one player. */
export interface RunRow {
  format: number
  scenarioId: string
  playerId: string
  /** The run this one was rewound from; '' for a first run. */
  parentRunId: string
  /** The decision (0-3) where this run splits from its parent; -1 for a first run. */
  branchAt: number
  /** The readable half as it was when the run started, so later edits never change it. */
  snapshot: PublicScenario
  /** The answers row that matches the snapshot (copied from the scenario at start). */
  answersId: string
  /** The choice locked in at each decision so far, each approach * WAYS + way. */
  choices: number[]
  /** Outcome text of each decision so far. */
  outcomes: string[]
  /**
   * The approach (0-2) committed to at the next decision, set by the commit
   * action before its ways can be locked in; -1 when none yet. Missing on
   * rows written before it existed, which reads as -1.
   */
  approach?: number
  /**
   * The decision `approach` was committed at. A commit counts only while this
   * equals the next decision (choices.length), so a delayed commit sent for
   * one decision can never bind a later one. Missing reads as -1.
   */
  approachAt?: number
  status: RunStatus
  /** The fields below are filled when the run ends. */
  score: number
  steps: StepResult[]
  fix: Fix
  /** Percent of all possible paths that score lower than this run. */
  beats: number
  ending: Ending | ''
  endingText: string
}

/**
 * The approach (0-2) the run is committed to at its next decision, or -1.
 * A commit stored for an earlier decision does not count (see approachAt).
 */
export const committedApproach = (run: Pick<RunRow, 'approach' | 'approachAt' | 'choices'>): number =>
  (run.approachAt ?? -1) === run.choices.length ? (run.approach ?? -1) : -1
