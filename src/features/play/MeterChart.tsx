/**
 * One meter over a whole run, for two runs at once: a solid line for this
 * run and a dashed line for the run it was rewound from. x is the decision
 * (0 = start, 5 = after the last pick); y is the meter value, 0-100.
 */
const W = 300
const H = 120
const PAD = 8

function points(series: number[]): string {
  const step = (W - PAD * 2) / Math.max(1, series.length - 1)
  return series.map((v, i) => `${PAD + i * step},${PAD + (H - PAD * 2) * (1 - v / 100)}`).join(' ')
}

export function MeterChart({ name, mine, theirs, splitAt }: { name: string; mine: number[]; theirs: number[]; splitAt: number }) {
  const step = (W - PAD * 2) / Math.max(1, mine.length - 1)
  const splitX = PAD + (splitAt + 1) * step
  return (
    <figure className="rounded-lg border border-border bg-card p-3">
      <figcaption className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{name}</span>
        <span className="tabular-nums text-muted-foreground">
          {theirs[theirs.length - 1]} → {mine[mine.length - 1]}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full"
        role="img"
        aria-label={`${name}: earlier run ${theirs.join(', ')}; this run ${mine.join(', ')}`}
      >
        <line x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} className="stroke-border" strokeDasharray="2 4" />
        <line x1={splitX} x2={splitX} y1={PAD} y2={H - PAD} className="stroke-muted-foreground/40" />
        <polyline points={points(theirs)} fill="none" className="stroke-muted-foreground" strokeWidth={2} strokeDasharray="5 4" />
        <polyline points={points(mine)} fill="none" className="stroke-primary" strokeWidth={2.5} />
      </svg>
    </figure>
  )
}
