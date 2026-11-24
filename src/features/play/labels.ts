/** Display words and badge colours for endings and pick kinds. */
import type { Ending, OptionKind } from './types'

export const ENDING_LABEL: Record<Ending, string> = { good: 'Good ending', ok: 'Mixed ending', bad: 'Bad ending' }
export const ENDING_BADGE: Record<Ending, 'success' | 'warning' | 'destructive'> = {
  good: 'success',
  ok: 'warning',
  bad: 'destructive',
}

export const KIND_LABEL: Record<OptionKind, string> = { best: 'Best', ok: 'Okay', trap: 'Trap' }
export const KIND_BADGE: Record<OptionKind, 'success' | 'warning' | 'destructive'> = {
  best: 'success',
  ok: 'warning',
  trap: 'destructive',
}
