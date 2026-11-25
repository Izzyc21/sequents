/**
 * Checks on the registered pictures of the two starters that have them: every
 * picture draws, the two password-notice versions differ only where the
 * details differ, a run's pictures follow its answers id, descriptions are
 * neutral and say what the picture says, and the picture times and names
 * agree with the readable text.
 *
 * Lives at the root, like the hygiene scan, because it imports the starters.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEADLINE_TEXT } from './src/features/frames/deadlineFrames'
import { framesFor } from './src/features/frames'
import { NOTICE_TEXT } from './src/features/frames/noticeFrames'
import { FRAMES } from './src/features/frames/registry'
import type { FrameSet, FrameSpec } from './src/features/frames/types'
import type { ScenarioDraft } from './src/features/play/types'
import { STARTERS } from './src/seeds/starters'
import { STARTER_VARIANTS } from './src/seeds/variants'

const SLOTS = ['setting', 'd1', 'd2', 'd3', 'd4'] as const
type Slot = (typeof SLOTS)[number]

const specsOf = (set: FrameSet): Record<Slot, FrameSpec | null> => ({
  setting: set.setting,
  d1: set.decisions[0],
  d2: set.decisions[1],
  d3: set.decisions[2],
  d4: set.decisions[3],
})
const markup = (spec: FrameSpec) => renderToStaticMarkup(<figure aria-label={spec.title}>{spec.render()}</figure>)
const SR = /<p class="sr-only">([\s\S]*?)<\/p>/
const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#x27;', "'")
const description = (spec: FrameSpec) => decode(SR.exec(markup(spec))?.[1] ?? '')
/** Words a sighted reader sees: everything except the screen-reader paragraph. */
const visible = (spec: FrameSpec) => decode(markup(spec).replace(SR, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
const flat = (s: string) => s.replace(/\s+/g, ' ')

const v0 = framesFor('starter-phishing@v5')!
const v1 = framesFor('starter-phishing@v5.1')!
const wifi = framesFor('starter-wifi-deadline@v5')!

const ALL: [string, FrameSet][] = [
  ['password notice, version 0', v0],
  ['password notice, version 1', v1],
  ['wifi deadline', wifi],
]

describe('registered pictures', () => {
  it('registers both starters from seed version 5', () => {
    expect(FRAMES['starter-phishing'][0].fromVersion).toBe(5)
    expect(FRAMES['starter-phishing'][0].variants).toHaveLength(1)
    expect(FRAMES['starter-wifi-deadline'][0].fromVersion).toBe(5)
  })

  it.each(ALL)('%s: a setting picture and four decision pictures all draw', (_name, set) => {
    const specs = specsOf(set)
    for (const slot of SLOTS) {
      const spec = specs[slot]
      expect(spec, slot).not.toBeNull()
      const out = markup(spec!)
      expect(out.length).toBeGreaterThan(500)
      expect(out).not.toMatch(/<img\b/)
      for (const tag of out.match(/<svg\b[^>]*>/g) ?? []) expect(tag).toContain('aria-hidden="true"')
      expect(SR.test(out), `${slot} has a description`).toBe(true)
      expect(spec!.title).toMatch(/^Picture: /)
    }
  })
})

describe('password notice versions', () => {
  const a = specsOf(v0)
  const b = specsOf(v1)

  it.each(['setting', 'd2', 'd4'] as const)('%s is the same in both versions', (slot) => {
    expect(markup(a[slot]!)).toBe(markup(b[slot]!))
  })

  it.each(['d1', 'd3'] as const)('%s differs between the versions', (slot) => {
    expect(markup(a[slot]!)).not.toBe(markup(b[slot]!))
    expect(a[slot]!.title).toBe(b[slot]!.title)
  })

  it('shows the sign-in page address, log row and phone line that differ at decision 1', () => {
    const [x, y] = [visible(a.d1!), visible(b.d1!)]
    expect(x).toContain('https://login.microsoftonline.com.hf-secure-id.example/common/oauth2')
    expect(x).toContain('Amsterdam')
    expect(x).not.toContain('Location: New York')
    expect(y).toContain('https://login.microsoftonline.com/harlowfinch.example/oauth2/authorize')
    expect(y).toContain('Location: New York')
    expect(y).not.toContain('Amsterdam')
    expect(y).not.toContain('hf-secure-id')
  })

  it('shows the link domain, change calendar and inbox row that differ at decision 3', () => {
    const [x, y] = [visible(a.d3!), visible(b.d3!)]
    expect(x).toContain('hf-secure-id.example')
    expect(x).toContain('Newly registered (3 days old)')
    expect(x).toContain('Nothing booked')
    expect(x).not.toContain('Password change, all staff')
    expect(x).toContain('Printer on floor 2 back in service')
    expect(x).not.toContain('Password change planned')
    expect(y).toContain('login.microsoftonline.com')
    expect(y).toContain('Sign-in services (Microsoft)')
    expect(y).toContain('Password change, all staff (Sam)')
    expect(y).not.toContain('Nothing booked')
    expect(y).toContain('Password change planned this week')
    expect(y).not.toContain('Printer on floor 2')
    expect(y).not.toContain('hf-secure-id')
  })

  it('keeps the setting free of any sign of which version it is', () => {
    const out = visible(a.setting!)
    expect(out).toContain('https://go.harlowfinch.example/r/7Fq2')
    expect(out).not.toMatch(/microsoftonline|hf-secure|Amsterdam|Newly registered|Nothing booked|all staff/)
  })
})

describe('a run gets the pictures of its answers id', () => {
  it('gives version 0 runs the version 0 pictures and version 1 runs the version 1 pictures', () => {
    const at = (id: string) => markup(specsOf(framesFor(id)!).d1!)
    expect(at('starter-phishing@v5')).toBe(markup(specsOf(v0).d1!))
    expect(at('starter-phishing@v5.1')).toBe(markup(specsOf(v1).d1!))
    expect(at('starter-phishing@v5')).not.toBe(at('starter-phishing@v5.1'))
  })

  it('pairs each picture version with the answers seeded under the same number', () => {
    // Answers "<id>@v5" come from the starter itself and "<id>@v5.1" from its first registered variant.
    const main = STARTERS.find((s) => s.id === 'starter-phishing')!
    const hidden = STARTER_VARIANTS['starter-phishing'][0]
    expect(main.endings.ok).toMatch(/^The email was an attack/)
    expect(hidden.endings.ok).toMatch(/^The notice was real/)
    expect(visible(specsOf(framesFor('starter-phishing@v5')!).d1!)).toContain('hf-secure-id')
    expect(visible(specsOf(framesFor('starter-phishing@v5.1')!).d1!)).not.toContain('hf-secure-id')
  })

  it('keeps them for runs seeded under a later version, and gives none to older runs', () => {
    expect(markup(specsOf(framesFor('starter-phishing@v6.1')!).d3!)).toBe(markup(specsOf(v1).d3!))
    expect(markup(specsOf(framesFor('starter-phishing@v7')!).d3!)).toBe(markup(specsOf(v0).d3!))
    expect(framesFor('starter-phishing@v4')).toBeNull()
    expect(framesFor('starter-phishing@v4.1')).toBeNull()
    expect(framesFor('starter-wifi-deadline@v4')).toBeNull()
    expect(framesFor('starter-wifi-deadline@v5')).not.toBeNull()
  })

  it('gives scenarios with no pictures none', () => {
    expect(framesFor('starter-raise@v5')).toBeNull()
  })
})

describe('descriptions and visible words', () => {
  const GIVEAWAY = /\b(suspicious|fake|real|lure|scam|phishing|attacker|breach|overseas|genuine|legitimate|best|correct|wrong|blunder|mistake|slip|grade|score)\b/i

  it.each(ALL)('%s: titles, descriptions and visible words use neutral wording', (_name, set) => {
    const specs = specsOf(set)
    for (const slot of SLOTS) {
      const spec = specs[slot]!
      for (const text of [spec.title, description(spec), visible(spec)]) expect(text.match(GIVEAWAY)?.[0] ?? null, `${slot}: ${text.slice(0, 60)}`).toBeNull()
    }
  })

  /** A word is a string, or a description form plus the separate pieces a picture draws (cells, label and value). */
  type Word = string | [string, string[]]
  const pair = (r: { label: string; value: string }): Word => [`${r.label}: ${r.value}`, [r.label, r.value]]
  const line = (r: { time: string; from: string; subject: string }): Word => [`${r.time}, ${r.from}: ${r.subject}`, [r.time, r.from, r.subject]]
  const cells = (row: string[]): Word => [row.join(', '), row]
  const thought = ([who, text]: [string, string]): Word => [`${who} thinks: "${text}"`, [`${who} thinks`, text]]
  const inDescription = (spec: FrameSpec, words: Word[]) => words.forEach((w) => expect(flat(description(spec)), String(w)).toContain(typeof w === 'string' ? w : w[0]))
  const inPicture = (spec: FrameSpec, words: Word[]) => words.flatMap((w) => (typeof w === 'string' ? [w] : w[1])).forEach((w) => expect(flat(visible(spec)), w).toContain(w))

  const noticeWords = (v: 0 | 1): Record<Slot, Word[]> => {
    const e = NOTICE_TEXT.email
    const d1 = NOTICE_TEXT.d1
    const d3 = NOTICE_TEXT.d3
    const d4 = NOTICE_TEXT.d4
    const d2 = NOTICE_TEXT.d2
    return {
      setting: [e.fromName, e.fromAddress, e.to, e.date, e.subject, e.linkLabel, e.linkUrl, e.dana, ...e.body],
      d1: [d1.tab, d1.byVersion[v].url, d1.payroll, d1.sticky, d1.byVersion[v].prompt, ...d1.page, ...d1.byVersion[v].rows.map(cells)],
      d2: [d2.manager[1], d2.hallway[1], d2.sam[1], d2.sam[2], d2.sticky, d2.cardTitle, ...d2.places.map(pair), ...d2.thoughts.map(thought)],
      d3: [
        ...d3.byVersion[v].filter.map(pair),
        ...d3.byVersion[v].policy.map(pair),
        ...d3.tiles,
        pair(d3.sender),
        line(d3.byVersion[v].lastRow),
        ...d3.commonRows.map(line),
      ],
      d4: [...d4.chat.map(([, text]) => text), d4.manager[1], d4.logsTitle, ...d4.logs.map(pair), ...d4.thoughts.map(thought)],
    }
  }

  it.each([0, 1] as const)('password notice version %i: description and picture state the same words', (v) => {
    const specs = specsOf(framesFor(v === 0 ? 'starter-phishing@v5' : 'starter-phishing@v5.1')!)
    const words = noticeWords(v)
    for (const slot of SLOTS) {
      inDescription(specs[slot]!, words[slot])
      inPicture(specs[slot]!, words[slot])
    }
  })

  it('wifi deadline: description and picture state the same words', () => {
    const t = DEADLINE_TEXT
    const specs = specsOf(wifi)
    const words: Record<Slot, Word[]> = {
      setting: [t.setting.essay, 'connected, no internet', 'Restart pending', t.setting.time, t.setting.phone.battery, t.setting.phone.text, t.setting.router, t.setting.sticky, 'WPS: amber'],
      d1: [t.d1.toastApp, t.d1.toastTitle, t.d1.toastBody, ...t.d1.buttons, 'Connected, secured', t.d1.cable, 'Restart pending'],
      d2: [t.d2.url, t.d2.heading, t.d2.drop, t.d2.essayNote, t.d2.wordCount, 'connected, dropped twice', t.d2.time],
      d3: [t.d3.url, t.d3.status, t.d3.classmate[1], t.d3.time],
      d4: [t.d4.url, t.d4.file, t.d4.status, t.d4.button, t.d4.saved, t.d4.time],
    }
    for (const slot of SLOTS) {
      inDescription(specs[slot]!, words[slot])
      inPicture(specs[slot]!, words[slot])
    }
  })
})

describe('what the people in the pictures think', () => {
  /** Each drawn thought bubble as [thinker, words], read from the markup. */
  const thoughtsOf = (spec: FrameSpec) =>
    [...markup(spec).matchAll(/<p [^>]*data-thinker=""[^>]*>([^<]*?) thinks<\/p><p [^>]*data-thought=""[^>]*>([^<]*)<\/p>/g)].map((m) => [decode(m[1]), decode(m[2])])
  const thinkers = (spec: FrameSpec) => thoughtsOf(spec).map(([who]) => who)

  /** Only where the people around you add something the screens do not show. */
  const WITH_THOUGHTS: Record<string, Slot[]> = {
    'password notice, version 0': ['d2', 'd4'],
    'password notice, version 1': ['d2', 'd4'],
    'wifi deadline': [],
  }

  it.each(ALL)('%s: thoughts appear only where they add context, and then from two people', (name, set) => {
    const specs = specsOf(set)
    const expected = WITH_THOUGHTS[name]
    expect(expected, name).toBeDefined()
    for (const slot of SLOTS) {
      if (expected.includes(slot)) expect(new Set(thinkers(specs[slot]!)).size, slot).toBe(2)
      else expect(thinkers(specs[slot]!), slot).toEqual([])
    }
  })

  it('gives both password notice versions the same thoughts at every picture', () => {
    const a = specsOf(v0)
    const b = specsOf(v1)
    for (const slot of SLOTS) expect(thoughtsOf(a[slot]!), slot).toEqual(thoughtsOf(b[slot]!))
  })

  /** Every run of three words in a text, lowercased, punctuation dropped. */
  const triples = (s: string) => {
    const w = s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)
    return w.slice(2).map((_, i) => w.slice(i, i + 3).join(' '))
  }
  const SCENARIOS: [string, FrameSet[]][] = [
    ['starter-phishing', [v0, v1]],
    ['starter-wifi-deadline', [wifi]],
  ]

  it.each(SCENARIOS)('%s: no thought repeats three words in a row from any approach or way', (id, sets) => {
    const drafts = [STARTERS.find((s) => s.id === id) as ScenarioDraft, ...(STARTER_VARIANTS[id] ?? [])]
    const optionText = drafts.flatMap((d) => d.decisions.flatMap((x) => x.approaches.flatMap((a) => [a.text, ...a.ways.map((w) => w.text)])))
    const taken = new Set(optionText.flatMap(triples))
    for (const set of sets) {
      const specs = specsOf(set)
      for (const slot of SLOTS) {
        for (const [who, words] of thoughtsOf(specs[slot]!)) expect(triples(words).filter((t) => taken.has(t)), `${slot} ${who}`).toEqual([])
      }
    }
  })

  it('keeps the thoughts out of the version-specific text', () => {
    for (const v of NOTICE_TEXT.d1.byVersion) expect(v).not.toHaveProperty('thoughts')
    for (const v of NOTICE_TEXT.d3.byVersion) expect(v).not.toHaveProperty('thoughts')
  })
})

describe('pictures agree with the readable text', () => {
  const text = (id: string) => {
    const d = STARTERS.find((s) => s.id === id) as ScenarioDraft
    return [d.title, d.situation, d.setting, ...d.decisions.map((x) => x.prompt)].join(' ')
  }

  it('password notice: sender name, subject and every time are in the readable text', () => {
    const r = text('starter-phishing')
    for (const w of ['IT Support', 'Your password expires today', '9:05', '9:20', '9:22', '9:40', '9:55', '10:30', '30 accounts', '1 PM', 'Dana']) expect(r, w).toContain(w)
    const e = NOTICE_TEXT
    expect(e.email.date).toContain('9:05')
    expect(e.d1.caption).toContain('9:22')
    expect(e.d2.caption).toContain('9:40')
    expect(e.d3.caption).toContain('9:55')
    expect(e.d4.caption).toContain('10:30')
    expect(e.d4.logs[0].value).toBe('30 accounts')
    expect(e.d2.places[2].value).toContain('1 PM')
    expect(e.email.dana).toMatch(/clicked it, typed my password and approved the prompt on my phone/)
    expect(r).toMatch(/clicked the link, entered her password on the page it opened and approved the phone prompt/)
  })

  it('wifi deadline: times, battery and wording are in the readable text', () => {
    const r = text('starter-wifi-deadline')
    for (const w of ['10:58 PM', '11:15 PM', '11:42', '11:55 PM', '21 percent', 'full cell service', 'Submitting…', 'midnight']) expect(r, w).toContain(w)
    const t = DEADLINE_TEXT
    expect(t.setting.caption).toContain('10:58 PM')
    expect(t.d2.caption).toContain('11:15 PM')
    expect(t.d3.caption).toContain('11:42 PM')
    expect(t.d4.caption).toContain('11:55 PM')
    expect(t.setting.phone.battery).toBe('21%')
    expect(t.setting.phone.text).toBe('Full signal')
    expect(t.d3.status).toBe('Submitting…')
    expect(t.setting.sticky).toBe('Essay due 12:00 AM')
  })
})
