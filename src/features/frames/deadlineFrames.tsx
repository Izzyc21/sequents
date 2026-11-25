/**
 * Pictures for the "no internet before the essay is due" scenario: one
 * setting picture and one per decision, for a single version. Each picture
 * also shows what the people around you think.
 *
 * Every drawn word comes from DEADLINE_TEXT, and the screen-reader description
 * of each picture is built from the same constants.
 */
import { Browser, Clock, ConsoleCard, Each, Laptop, Panel, Phone, Router, Scene, SpeechBubble, StatTile, StickyNote, Thoughts, Toast, Tray, thoughtWords, type Light, type Thought } from './kit'
import { BLUE, INK, PAPER, SKY, SLATE, STEEL } from './palette'
import type { FrameSet, FrameSpec } from './types'

const LIGHTS: Light[] = [
  { label: 'Power', state: 'on' },
  { label: 'Wi-Fi', state: 'on' },
  { label: 'WAN', state: 'on' },
  { label: 'WPS', state: 'amber' },
]

/** The words every picture of this scenario draws. */
export const DEADLINE_TEXT = {
  setting: {
    caption: 'Today, 10:58 PM. Your desk.',
    essay: 'Essay draft, saved',
    tray: [{ label: 'Wi-Fi', detail: 'connected, no internet' }, { label: 'Restart pending' }],
    time: '10:58 PM',
    phone: { time: '10:58', battery: '21%', app: 'Mobile network', text: 'Full signal' },
    router: 'Home router',
    sticky: 'Essay due 12:00 AM',
    thoughts: [['Roommate', 'Unplug the router for thirty seconds. Works every time.']] as Thought[],
  },
  d1: {
    caption: 'Today, 10:58 PM. The laptop screen, the phone and the cable.',
    toastApp: 'Windows Update',
    toastTitle: 'Restart required',
    toastBody: 'A USB network driver update was installed at 10:31 PM. Restart to finish.',
    buttons: ['Restart now', 'Later'],
    flyoutTitle: 'Wi-Fi',
    flyout: [{ label: 'Status', value: 'Connected, secured' }],
    cable: 'USB cable',
    thoughts: [
      ['Roommate', 'Just run the Windows troubleshooter. It fixed mine last month.'],
      ['Classmate', "Hotspot's the quickest. That's what I always do."],
    ] as Thought[],
  },
  d2: {
    caption: 'Today, 11:15 PM. The portal and the essay.',
    url: 'https://courses.northfield.example/submit',
    tab: 'Course portal: Submit',
    heading: 'Upload your essay',
    drop: 'Choose file',
    essay: 'Essay draft, saved',
    essayNote: '2 citations to format',
    wordCount: 'Word count: 1,480',
    tray: [{ label: 'Internet', detail: 'connected, dropped twice' }],
    time: '11:15 PM',
    thoughts: [
      ['Roommate', 'Just hand it in. Nobody loses marks over two citations.'],
      ['Classmate', 'Once those two are done, check every other reference too. Graders notice.'],
    ] as Thought[],
  },
  d3: {
    caption: 'Today, 11:42 PM. The portal.',
    url: 'https://courses.northfield.example/submit',
    tab: 'Course portal: Submit',
    status: 'Submitting…',
    classmate: ['Classmate', 'mine is stuck too'],
    time: '11:42 PM',
    thoughts: [
      ['Classmate', "Send the instructor a link to it in your drive. It's quicker than attaching."],
      ['Roommate', 'Ask the instructor first. Emailing it without asking looks like an excuse.'],
    ] as Thought[],
  },
  d4: {
    caption: 'Today, 11:55 PM. The portal after the upload.',
    url: 'https://courses.northfield.example/submit',
    tab: 'Course portal: Submit',
    file: 'essay-final.docx, 100% uploaded',
    status: 'Status: Draft, not submitted',
    button: 'Submit',
    saved: 'Last saved 11:54 PM',
    time: '11:55 PM',
    thoughts: [
      ['Roommate', "It hit 100%. You're done, shut it and relax."],
      ['Classmate', "I'll email the instructor that I uploaded it, just in case."],
    ] as Thought[],
  },
}

const T = DEADLINE_TEXT

const trayWords = (items: { label: string; detail?: string }[]) => items.map((i) => (i.detail ? `${i.label}: ${i.detail}` : i.label)).join('; ')
const lightWords = LIGHTS.map((l) => `${l.label}: ${l.state}`).join(', ')

function EssayWindow({ title, note }: { title: string; note?: string }) {
  return (
    <div className="min-w-0 p-3 text-sm">
      <p className="m-0 font-extrabold">{title}</p>
      {note ? <StatTile>{note}</StatTile> : null}
    </div>
  )
}

function settingSpec(): FrameSpec {
  const t = T.setting
  const description =
    `Your desk at 10:58 PM. A laptop shows an essay window titled "${t.essay}". Its taskbar reads ${trayWords(t.tray)}; the time is ${t.time}. ` +
    `Your phone shows ${t.phone.battery} battery, and a ${t.phone.app} line reads "${t.phone.text}". A router named "${t.router}" has these lights: ${lightWords}. ` +
    `A sticky note reads "${t.sticky}". A clock reads ${t.time}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: your desk at 10:58 PM',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="sky">
          <Laptop>
            <EssayWindow title={t.essay} />
            <Tray items={t.tray} time={t.time} />
          </Laptop>
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-6">
            <Phone time={t.phone.time} battery={t.phone.battery} notices={[{ app: t.phone.app, text: t.phone.text, time: t.time }]} />
            <Router name={t.router} lights={LIGHTS} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Clock time={t.time} />
            <StickyNote>{t.sticky}</StickyNote>
          </div>
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

function d1Spec(): FrameSpec {
  const t = T.d1
  const s = T.setting
  const description =
    `The laptop screen, the phone and the cable at 10:58 PM. A notice from ${t.toastApp} reads "${t.toastTitle}. ${t.toastBody}" with buttons "${t.buttons.join('" and "')}". ` +
    `The taskbar reads ${trayWords(s.tray)}. A Wi-Fi panel reads ${t.flyout.map((r) => `${r.label}: ${r.value}`).join('. ')}. ` +
    `The phone beside it shows ${s.phone.battery} battery. A ${t.cable} lies across the desk. The router lights: ${lightWords}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the laptop screen',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="butter">
          <Laptop>
            <div className="flex flex-col gap-2 p-3">
              <Toast
                app={t.toastApp}
                title={t.toastTitle}
                body={
                  <>
                    <p className="m-0">{t.toastBody}</p>
                    <p className="m-0 mt-1 flex gap-2 font-bold">
                      <Each items={t.buttons} render={(label) => <span className="rounded px-2" style={{ border: `2px solid ${INK}` }}>{label}</span>} />
                    </p>
                  </>
                }
              />
              <ConsoleCard title={t.flyoutTitle} rows={t.flyout} />
            </div>
            <Tray items={s.tray} time={s.time} />
          </Laptop>
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-6">
            <Phone time={s.phone.time} battery={s.phone.battery} notices={[{ app: s.phone.app, text: s.phone.text, time: s.time }]} />
            <div className="flex flex-col items-center gap-1">
              <svg width="120" height="34" viewBox="0 0 120 34" aria-hidden="true" focusable="false">
                <path d="M4 20 Q30 4 56 20 T112 14" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
                <rect x="104" y="6" width="14" height="16" rx="3" fill={STEEL} stroke={INK} strokeWidth="3" />
              </svg>
              <span className="text-xs font-bold">{t.cable}</span>
            </div>
            <Router name={s.router} lights={LIGHTS} />
          </div>
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

function d2Spec(): FrameSpec {
  const t = T.d2
  const description =
    `The portal and the essay at 11:15 PM. A browser tab titled "${t.tab}" at the address ${t.url} shows the heading "${t.heading}" and a drop zone "${t.drop}". ` +
    `Beside it, an essay window titled "${t.essay}" shows "${t.essayNote}" and "${t.wordCount}". The taskbar reads ${trayWords(t.tray)}; the time is ${t.time}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the portal and the essay',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="mint">
          <Browser url={t.url} title={t.tab} secure>
            <p className="m-0 text-base font-extrabold">{t.heading}</p>
            <p className="m-0 mt-2 w-fit rounded-md px-3 py-2 font-bold" style={{ border: `2px dashed ${INK}` }}>{t.drop}</p>
          </Browser>
          <Laptop>
            <EssayWindow title={t.essay} note={t.essayNote} />
            <p className="m-0 px-3 pb-2 text-xs font-semibold">{t.wordCount}</p>
            <Tray items={t.tray} time={t.time} />
          </Laptop>
          <Clock time={t.time} />
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

function d3Spec(): FrameSpec {
  const t = T.d3
  const description =
    `The portal at 11:42 PM. A browser tab titled "${t.tab}" at the address ${t.url} shows "${t.status}" and a progress bar. ` +
    `A classmate chat window shows ${t.classmate[0]}: "${t.classmate[1]}". A clock reads ${t.time}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the portal at 11:42 PM',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="lavender">
          <Browser url={t.url} title={t.tab} secure>
            <p className="m-0 text-base font-extrabold">{t.status}</p>
            <div className="mt-2 h-4 w-full rounded-full" style={{ border: `2px solid ${INK}`, background: PAPER }} aria-hidden="true">
              <div className="h-full w-[35%] rounded-full" style={{ background: BLUE }} />
            </div>
          </Browser>
          <SpeechBubble speaker={t.classmate[0]} side="right">
            {t.classmate[1]}
          </SpeechBubble>
          <Clock time={t.time} />
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

function d4Spec(): FrameSpec {
  const t = T.d4
  const description =
    `The portal after the upload at 11:55 PM. A browser tab titled "${t.tab}" at the address ${t.url} shows a file row "${t.file}", ` +
    `a smaller line "${t.status}", a button "${t.button}" and the line "${t.saved}". A clock reads ${t.time}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the portal after the upload',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="peach">
          <Browser url={t.url} title={t.tab} secure>
            <p className="m-0 font-extrabold">{t.file}</p>
            <p className="m-0 text-xs" style={{ color: SLATE }}>{t.status}</p>
            <p className="m-0 mt-2 w-fit rounded-md px-4 py-1 font-bold" style={{ border: `2px solid ${INK}`, background: SKY }}>{t.button}</p>
            <p className="m-0 mt-2 text-xs font-semibold">{t.saved}</p>
          </Browser>
          <Clock time={t.time} />
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

/** The pictures of the scenario. */
export function deadlineFrames(): FrameSet {
  return { setting: settingSpec(), decisions: [d1Spec(), d2Spec(), d3Spec(), d4Spec()] }
}
