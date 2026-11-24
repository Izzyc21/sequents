/** Display words and badge colours for endings and grades. */
import { type Ending, type Grade, GRADE_POINTS } from './types'

export const ENDING_LABEL: Record<Ending, string> = { good: 'Good ending', ok: 'Mixed ending', bad: 'Bad ending' }
export const ENDING_BADGE: Record<Ending, 'success' | 'warning' | 'destructive'> = {
  good: 'success',
  ok: 'warning',
  bad: 'destructive',
}

export const GRADE_LABEL: Record<Grade, string> = { best: 'Best', slip: 'Slip', mistake: 'Mistake', blunder: 'Blunder' }
export const GRADE_BADGE: Record<Grade, 'success' | 'info' | 'warning' | 'destructive'> = {
  best: 'success',
  slip: 'info',
  mistake: 'warning',
  blunder: 'destructive',
}

/** "Slip, −5" or "Best, no points lost". */
export function gradeLine(grade: Grade): string {
  const points = GRADE_POINTS[grade]
  return points === 0 ? `${GRADE_LABEL[grade]}, no points lost` : `${GRADE_LABEL[grade]}, −${points}`
}

/** "100 − 0 − 5 − 12 − 20 = 63": the score as the sum it is. */
export function scoreSum(points: number[], score: number): string {
  return `100 ${points.map((p) => `− ${p}`).join(' ')} = ${score}`
}

/** The text of a choice: "approach → way". */
export function choiceText(decision: { approaches: { text: string; ways: string[] }[] }, choice: number): string {
  const approach = decision.approaches[Math.floor(choice / 3)]
  return approach ? `${approach.text} → ${approach.ways[choice % 3]}` : ''
}
