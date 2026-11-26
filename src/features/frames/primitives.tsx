/**
 * Base pieces: panel, characters, sticky note, speech bubble, thought bubbles.
 * Colours come from palette.ts; every word is HTML text and decorative
 * drawings carry aria-hidden="true".
 */
import { Children, type CSSProperties, type ReactNode } from 'react'
import { FILLS, INK, LINE, PAPER, SHADOW, type Fill } from './palette'

/**
 * Renders one node per item, with React-assigned identities. It walks the
 * positions rather than the items, so an item that is itself a list stays one item.
 */
export function Each<T>({ items, render }: { items: T[]; render: (item: T, index: number) => ReactNode }) {
  return <>{Children.map(items.map((_, i) => i), (i: number) => render(items[i], i))}</>
}

/**
 * Wraps one picture: a spoken-out description for screen readers, then the
 * picture itself. The description carries every drawn word, so screen readers
 * skip the drawing and nothing is read out twice.
 */
export function Scene({ description, children }: { description: string; children: ReactNode }) {
  return (
    <div>
      <p className="sr-only">{description}</p>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

/** Slight tilt shared by pieces; degrees, kept small. */
export function tiltStyle(tilt: number | undefined): CSSProperties | undefined {
  return tilt ? { transform: `rotate(${tilt}deg)` } : undefined
}

/** Outline, flat fill and offset shadow shared by boxed pieces. */
export function boxStyle(fill: string, extra?: CSSProperties): CSSProperties {
  return { background: fill, border: `${LINE}px solid ${INK}`, boxShadow: SHADOW, color: INK, ...extra }
}

/** The border of one picture, with an optional strip of caption text under it. */
export function Panel({
  children,
  caption,
  fill = 'cream',
  tilt,
}: {
  children: ReactNode
  caption?: ReactNode
  fill?: Fill
  tilt?: number
}) {
  return (
    <div
      className="mx-auto w-full max-w-xl rounded-2xl p-3 text-left text-[15px] leading-snug"
      style={{ ...boxStyle(FILLS[fill]), ...tiltStyle(tilt) }}
    >
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
      {caption ? (
        <p
          className="mt-3 rounded-lg px-2 py-1 text-sm font-semibold"
          style={{ background: PAPER, border: `2px solid ${INK}` }}
        >
          {caption}
        </p>
      ) : null}
    </div>
  )
}

export type Mood = 'calm' | 'worried' | 'happy' | 'surprised' | 'tired' | 'focused'

const MOOD_WORDS: Record<Mood, string> = {
  calm: 'looks calm',
  worried: 'looks worried',
  happy: 'looks pleased',
  surprised: 'looks surprised',
  tired: 'looks tired',
  focused: 'is concentrating',
}

function Brows({ mood }: { mood: Mood }) {
  const common = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' }
  if (mood === 'worried') return <path d="M14 20 L24 16 M36 16 L46 20" {...common} />
  if (mood === 'surprised') return <path d="M14 14 Q19 9 24 14 M36 14 Q41 9 46 14" {...common} />
  if (mood === 'focused') return <path d="M14 17 L24 19 M36 19 L46 17" {...common} />
  if (mood === 'tired') return <path d="M14 18 L24 18 M36 18 L46 18" {...common} />
  return <path d="M14 17 Q19 14 24 17 M36 17 Q41 14 46 17" {...common} />
}

function Mouth({ mood }: { mood: Mood }) {
  const common = { stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' }
  if (mood === 'happy') return <path d="M20 40 Q30 50 40 40" {...common} />
  if (mood === 'worried') return <path d="M21 44 Q30 37 39 44" {...common} />
  if (mood === 'surprised') return <ellipse cx="30" cy="42" rx="4" ry="5" fill={INK} />
  if (mood === 'tired') return <path d="M22 42 Q27 45 30 42 Q33 39 38 42" {...common} />
  if (mood === 'focused') return <path d="M24 42 L36 42" {...common} />
  return <path d="M23 41 Q30 45 37 41" {...common} />
}

/** A round-faced character. The name and the mood are written out as text. */
export function Character({
  name,
  mood = 'calm',
  skin = '#f6c9a0',
  shirt = '#8fb8e8',
  size = 64,
  tilt,
}: {
  name: string
  mood?: Mood
  skin?: string
  shirt?: string
  size?: number
  tilt?: number
}) {
  return (
    <figure className="m-0 inline-flex flex-col items-center" style={{ color: INK, ...tiltStyle(tilt) }}>
      <svg width={size} height={size * 1.1} viewBox="0 0 60 66" aria-hidden="true" focusable="false">
        <path d="M6 66 Q6 50 30 50 Q54 50 54 66 Z" fill={shirt} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="30" cy="28" r="22" fill={skin} stroke={INK} strokeWidth="3" />
        <path d="M9 24 Q12 4 31 5 Q50 5 51 24 Q40 14 30 15 Q18 14 9 24 Z" fill={INK} />
        <Brows mood={mood} />
        <circle cx="19" cy="27" r="2.6" fill={INK} />
        <circle cx="41" cy="27" r="2.6" fill={INK} />
        <Mouth mood={mood} />
        {mood === 'tired' ? <path d="M13 33 Q19 36 25 33 M35 33 Q41 36 47 33" stroke={INK} strokeWidth="1.5" fill="none" /> : null}
      </svg>
      <figcaption className="text-xs font-semibold">
        {name}
        <span className="sr-only">, {MOOD_WORDS[mood]}</span>
      </figcaption>
    </figure>
  )
}

/** A sticky note with a folded corner. */
export function StickyNote({
  children,
  fill = 'butter',
  tilt = -2,
}: {
  children: ReactNode
  fill?: Fill
  tilt?: number
}) {
  return (
    <div
      className="relative max-w-[16rem] break-words px-3 pb-3 pt-4 text-sm font-semibold"
      style={{ ...boxStyle(FILLS[fill], { boxShadow: `2px 3px 0 ${INK}` }), ...tiltStyle(tilt) }}
    >
      <svg className="absolute -top-2 left-1/2 -ml-4" width="32" height="14" viewBox="0 0 32 14" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="28" height="10" rx="2" fill="#ffffffaa" stroke={INK} strokeWidth="2" />
      </svg>
      {children}
    </div>
  )
}

/** A speech bubble; the speaker is written before the words. */
export function SpeechBubble({
  speaker,
  children,
  side = 'left',
  fill = 'cream',
}: {
  speaker: string
  children: ReactNode
  side?: 'left' | 'right'
  fill?: Fill
}) {
  const right = side === 'right'
  return (
    <div className={`flex ${right ? 'justify-end' : 'justify-start'}`}>
      <div
        className="relative max-w-[85%] break-words rounded-2xl px-3 py-2 text-sm"
        style={boxStyle(FILLS[fill] === FILLS.cream ? PAPER : FILLS[fill], { boxShadow: `2px 2px 0 ${INK}` })}
      >
        <p className="m-0 text-xs font-bold">{speaker}</p>
        <div>{children}</div>
      </div>
    </div>
  )
}

/** One person's unspoken view: who thinks it, then the words. */
export type Thought = [thinker: string, text: string]

/**
 * What the people in a picture think but do not say. Set apart from speech:
 * dashed outline, italic words, a trail of small circles, and "<name> thinks"
 * written before the words.
 */
export function Thoughts({ items }: { items: Thought[] }) {
  return (
    <div role="group" aria-label="Thoughts" className="flex flex-wrap items-start gap-x-3 gap-y-5 pb-3">
      <Each
        items={items}
        render={([thinker, text]) => (
          <div
            className="relative min-w-[11rem] flex-1 break-words rounded-[1.75rem] px-3 py-2 text-sm"
            style={{ background: PAPER, border: `2px dashed ${INK}`, color: INK }}
          >
            <p className="m-0 text-xs font-bold" data-thinker="">{thinker} thinks</p>
            <p className="m-0 italic" data-thought="">{text}</p>
          </div>
        )}
      />
    </div>
  )
}

/** The words of a row of thoughts, for a picture's screen-reader description. */
export function thoughtWords(items: Thought[]): string {
  return items.map(([who, text]) => `${who} thinks: "${text}"`).join(' ')
}
