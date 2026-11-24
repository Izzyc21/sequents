/**
 * The three meters as bars. `previous` (the values before the last pick)
 * adds a +n / -n next to each value so the player sees what the pick did.
 */
import { cn } from '@/components/ui'
import type { Meter } from './types'

export function MeterBars({ meters, values, previous }: { meters: Meter[]; values: number[]; previous?: number[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3" data-testid="meters">
      {meters.map((meter, i) => {
        const value = values[i]
        const change = previous ? value - previous[i] : 0
        const tone = value <= 15 ? 'bg-destructive' : value < 40 ? 'bg-warning' : value >= 65 ? 'bg-success' : 'bg-primary'
        return (
          <div key={meter.name}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">{meter.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {value}
                {change !== 0 && (
                  <span className={cn('ml-1 font-medium', change > 0 ? 'text-success' : 'text-destructive')}>
                    {change > 0 ? `+${change}` : change}
                  </span>
                )}
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-label={meter.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <div className={cn('h-full rounded-full transition-all duration-700', tone)} style={{ width: `${value}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
