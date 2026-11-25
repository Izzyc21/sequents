/**
 * Small devices and time: a router with labelled lights, a clock, a calendar.
 * A light's state is always written as a word beside its shape.
 */
import { AMBER, GREEN, INK, LINE, PAPER, RED, SKY, STEEL } from './palette'
import { boxStyle, Each, tiltStyle } from './primitives'

export type LightState = 'on' | 'blinking' | 'off' | 'amber' | 'red'

const LIGHT_FILL: Record<LightState, string> = { on: GREEN, blinking: GREEN, off: '#ffffff', amber: AMBER, red: RED }

export interface Light {
  label: string
  state: LightState
}

function LightDot({ state }: { state: LightState }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" fill={LIGHT_FILL[state]} stroke={INK} strokeWidth="2" strokeDasharray={state === 'blinking' ? '3 2' : undefined} />
      {state === 'off' ? <path d="M4 8 H12" stroke={INK} strokeWidth="2" /> : null}
    </svg>
  )
}

/** A router: a body, two aerials and a row of labelled lights. */
export function Router({ name, lights, tilt }: { name: string; lights: Light[]; tilt?: number }) {
  return (
    <div className="w-full max-w-[16rem]" style={tiltStyle(tilt)}>
      <svg className="ml-4" width="70" height="26" viewBox="0 0 70 26" aria-hidden="true" focusable="false">
        <path d="M8 26 L4 2 M62 26 L66 2" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="rounded-xl px-3 py-2" style={boxStyle(STEEL)}>
        <p className="m-0 text-xs font-extrabold">{name}</p>
        <ul className="m-0 mt-1 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-xs font-semibold">
          <Each items={lights} render={(l) => (
              <li className="flex items-center gap-1">
                <LightDot state={l.state} />
                <span>
                  {l.label}: {l.state}
                </span>
              </li>
            )} />
        </ul>
      </div>
    </div>
  )
}

/** Hand angles for a time written "H:MM", with or without AM or PM after it. */
function handAngles(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map((part) => Number.parseInt(part, 10))
  return { hour: ((h % 12) + m / 60) * 30, minute: m * 6 }
}

/** A wall clock face with the digital time written beside it. */
export function Clock({ time, label, tilt }: { time: string; label?: string; tilt?: number }) {
  const { hour, minute } = handAngles(time)
  return (
    <div className="inline-flex items-center gap-2" style={{ color: INK, ...tiltStyle(tilt) }}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <circle cx="32" cy="32" r="28" fill={PAPER} stroke={INK} strokeWidth={LINE} />
        <path d="M32 7 V12 M57 32 H52 M32 57 V52 M7 32 H12" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M32 32 V18" stroke={INK} strokeWidth="4" strokeLinecap="round" transform={`rotate(${hour} 32 32)`} />
        <path d="M32 32 V11" stroke={INK} strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${minute} 32 32)`} />
        <circle cx="32" cy="32" r="3" fill={INK} />
      </svg>
      <span className="text-sm font-extrabold">
        {label ? `${label} ` : ''}
        {time}
      </span>
    </div>
  )
}

/** A tear-off calendar page: month, day number and weekday, plus an optional note line. */
export function Calendar({
  month,
  day,
  weekday,
  note,
  tilt = -1,
}: {
  month: string
  day: string
  weekday: string
  note?: string
  tilt?: number
}) {
  return (
    <div className="w-32 text-center" style={{ ...boxStyle(PAPER), ...tiltStyle(tilt) }}>
      <p className="m-0 py-0.5 text-xs font-extrabold uppercase" style={{ background: SKY, borderBottom: `${LINE}px solid ${INK}` }}>
        {month}
      </p>
      <p className="m-0 text-3xl font-extrabold leading-tight">{day}</p>
      <p className="m-0 text-xs font-semibold">{weekday}</p>
      {note ? <p className="m-0 border-t-2 px-1 py-0.5 text-xs" style={{ borderColor: INK }}>{note}</p> : null}
    </div>
  )
}
