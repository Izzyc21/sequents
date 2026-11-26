/**
 * Pictures for the "password expires today" scenario. Two versions
 * share one setting picture and the pictures of decisions 2 and 4; decisions
 * 1 and 3 differ in the details the pictures show (an address bar, a log row,
 * a phone line, a console card, a calendar card and one inbox row). The
 * pictures of decisions 2 and 4 also show what two of the people there think.
 *
 * Every drawn word comes from NOTICE_TEXT, and the screen-reader description
 * of each picture is built from the same constants, so the two cannot drift.
 */
import { Character, ConsoleCard, Each, InboxList, LogTable, Panel, Phone, Scene, SpeechBubble, StickyNote, Browser, Thoughts, thoughtWords, type Thought } from './kit'
import { ROSE } from './palette'
import { EmailArrived } from './settingEmail'
import type { FrameSet, FrameSpec } from './types'

export type NoticeVersion = 0 | 1

const LOG_COLUMNS = ['Time', 'User', 'City', 'App', 'Result']

/** The words every picture of this scenario draws. */
export const NOTICE_TEXT = {
  email: {
    fromName: 'IT Support',
    fromAddress: 'support@harlowfinch.exa',
    to: 'All staff',
    date: 'Today, 9:05 AM',
    subject: 'Your password expires today',
    body: ['Hello,', 'Your Harlow & Finch password expires at 5:00 PM today. Use the button below to keep your account active.', 'IT Support'],
    linkLabel: 'Keep my account active',
    linkUrl: 'https://go.harlowfinch.exa/r/7Fq2',
    caption: 'Today, 9:05 AM. The email as it arrived, and Dana at your desk at 9:20 AM.',
    dana: 'I clicked it, typed my password and approved the prompt on my phone.',
  },
  d1: {
    caption: "Today, 9:22 AM. Dana's laptop, her phone and the admin console.",
    tab: 'Sign in to your account',
    page: ['Sign in', 'Work email: dana.reyes@harlowfinch.exa', 'Password: ********'],
    sticky: 'Payroll due 12:00 PM',
    logTitle: 'Admin console: sign-in log',
    columns: LOG_COLUMNS,
    phoneTime: '9:22',
    phoneApp: 'Authenticator',
    phoneAt: '9:19 AM',
    byVersion: [
      {
        url: 'https://login.microsoftonline.com.hf-secure-id.exa/common/oauth2',
        rows: [
          ['9:19 AM', 'Dana Reyes', 'Amsterdam', 'Firefox on Linux', 'Success'],
          ['8:47 AM', 'Dana Reyes', 'New York', 'Edge on Windows', 'Success'],
          ['Mon 4:48 PM', 'Dana Reyes', 'Newark', 'Edge on Windows', 'Success'],
        ],
        prompt: 'Approve sign-in? Location: Amsterdam',
      },
      {
        url: 'https://login.microsoftonline.com/harlowfinch.exa/oauth2/authorize',
        rows: [
          ['9:19 AM', 'Dana Reyes', 'New York', 'Edge on Windows', 'Success'],
          ['8:47 AM', 'Dana Reyes', 'New York', 'Edge on Windows', 'Success'],
          ['Mon 4:48 PM', 'Dana Reyes', 'Newark', 'Edge on Windows', 'Success'],
        ],
        prompt: 'Approve sign-in? Location: New York',
      },
    ],
  },
  d2: {
    caption: 'Today, 9:40 AM. The hallway.',
    hallway: ['Staff in the hallway, to each other', 'Is that email okay?'],
    manager: ['Office manager, to you', 'People keep asking me about that email. What do I say to them?'],
    cardTitle: 'Where you could check',
    places: [
      { label: 'IT page', value: 'On the company intranet' },
      { label: 'IT change calendar', value: 'Shared, anyone can open it' },
      { label: 'Sam (IT lead)', value: 'On a flight, phone off until 1 PM' },
    ],
    thoughts: [
      ['Office manager', 'Last thing I want is everyone typing their password into that.'],
      ['Priya', "If this one is from IT and I ignore it, I'm locked out at 5."],
    ] as Thought[],
  },
  d3: {
    caption: 'Today, 9:55 AM. The web filter, the IT change calendar and your inbox.',
    filterTitle: "Web filter: where the email's button really leads",
    senderTitle: "Web filter: the email's sender address",
    sender: { label: 'harlowfinch.exa', value: 'Business' },
    policyTitle: 'IT change calendar: this week',
    inboxTitle: 'Your inbox',
    commonRows: [
      { time: '9:05 AM', from: 'IT Support', subject: 'Your password expires today', unread: true },
      { time: 'Tue', from: 'Facilities', subject: 'Printer moved to floor 2' },
    ],
    byVersion: [
      {
        filter: [
          { label: 'Site', value: 'hf-secure-id.exa' },
          { label: 'Kind of site', value: 'Newly registered (3 days old)' },
        ],
        policy: [{ label: 'Booked changes', value: 'None' }],
        lastRow: { time: 'Last Thu', from: 'IT Notices', subject: 'Office Wi-Fi reminder' },
      },
      {
        filter: [
          { label: 'Site', value: 'login.microsoftonline.com' },
          { label: 'Kind of site', value: 'Sign-in services (Microsoft)' },
        ],
        policy: [{ label: 'Today, 5:00 PM', value: 'Password change, all staff (Sam)' }],
        lastRow: { time: 'Last Thu', from: 'IT Notices', subject: 'Password change planned this week' },
      },
    ],
  },
  d4: {
    caption: 'Today, 10:30 AM. The office chat and the sign-in logs.',
    chatTitle: 'Office group chat',
    chat: [
      ['Priya', 'Is the password email okay to use?'],
      ['Marcus', 'Do I need to do anything before lunch?'],
      ['Lena', 'Dana, are you all right?'],
    ],
    manager: ['Office manager, to you', 'What should I say to people?'],
    logsTitle: 'Admin console: sign-in logs',
    logs: [{ label: 'Still to check', value: 'Sign-ins for all 30 accounts' }],
    thoughts: [
      ['Office manager', "If what I say now changes by noon, they'll stop listening to me."],
      ['Dana', "Please don't make me the example in front of everyone."],
    ] as Thought[],
  },
}

const T = NOTICE_TEXT

const rowWords = (row: string[]) => row.join(', ')
const pairWords = (rows: { label: string; value: string }[]) => rows.map((r) => `${r.label}: ${r.value}`).join('. ')

function settingSpec(): FrameSpec {
  const e = T.email
  const description =
    `An email in an inbox at 9:05 AM. From: ${e.fromName} <${e.fromAddress}>. To: ${e.to}. Date: ${e.date}. Subject: ${e.subject}. ` +
    `${e.body.join(' ')} A button reads "${e.linkLabel}". Link goes to: ${e.linkUrl}. Dana, at your desk, says: "${e.dana}"`
  return {
    title: 'Picture: the email in your inbox',
    render: () => (
      <Scene description={description}>
        <EmailArrived
          email={{ fromName: e.fromName, fromAddress: e.fromAddress, to: e.to, date: e.date, subject: e.subject, linkUrl: e.linkUrl, linkLabel: e.linkLabel, body: e.body, caption: e.caption }}
          aside={
            <>
              <div className="flex items-end justify-between gap-2">
                <SpeechBubble speaker="Dana">{e.dana}</SpeechBubble>
                <Character name="Dana" mood="worried" shirt={ROSE} />
              </div>
            </>
          }
        />
      </Scene>
    ),
  }
}

function d1Spec(v: NoticeVersion): FrameSpec {
  const t = T.d1
  const d = t.byVersion[v]
  const description =
    `Dana's laptop, her phone and the admin console at 9:22 AM. On the laptop, a browser tab titled "${t.tab}" shows a sign-in page. ` +
    `The address bar reads ${d.url}, with a padlock marked secure. The page reads: ${t.page.join('. ')}. ` +
    `The admin console sign-in log has the columns ${t.columns.join(', ')}. Its rows: ${d.rows.map(rowWords).join('; ')}. ` +
    `Dana's phone shows a notice from ${t.phoneApp} at ${t.phoneAt}: "${d.prompt}". A sticky note reads "${t.sticky}".`
  return {
    title: "Picture: Dana's laptop and the admin console",
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="cream">
          <Browser url={d.url} title={t.tab} secure>
            <div className="flex flex-col gap-1">
              <Each items={t.page} render={(line, i) => <p className={i === 0 ? 'm-0 text-base font-extrabold' : 'm-0'}>{line}</p>} />
            </div>
          </Browser>
          <LogTable title={t.logTitle} columns={t.columns} rows={d.rows} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Phone time={t.phoneTime} battery="80%" notices={[{ app: t.phoneApp, text: d.prompt, time: t.phoneAt }]} />
            <StickyNote>{t.sticky}</StickyNote>
          </div>
        </Panel>
      </Scene>
    ),
  }
}

function d2Spec(): FrameSpec {
  const t = T.d2
  const description =
    `The hallway at 9:40 AM. ${t.hallway[0]}: "${t.hallway[1]}" ${t.manager[0]}: "${t.manager[1]}" ` +
    `A card titled "${t.cardTitle}" lists: ${pairWords(t.places)}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the hallway',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="mint">
          <SpeechBubble speaker={t.hallway[0]}>{t.hallway[1]}</SpeechBubble>
          <SpeechBubble speaker={t.manager[0]}>{t.manager[1]}</SpeechBubble>
          <ConsoleCard title={t.cardTitle} rows={t.places} />
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

function d3Spec(v: NoticeVersion): FrameSpec {
  const t = T.d3
  const d = t.byVersion[v]
  const rows = [...t.commonRows, d.lastRow]
  const description =
    `The web filter, the IT change calendar and your inbox at 9:55 AM. ` +
    `Card "${t.filterTitle}": ${pairWords(d.filter)}. Card "${t.senderTitle}": ${pairWords([t.sender])}. ` +
    `Card "${t.policyTitle}": ${pairWords(d.policy)}. ${t.inboxTitle} list, newest first: ${rows.map((r) => `${r.time}, ${r.from}: ${r.subject}`).join('; ')}.`
  return {
    title: 'Picture: the web filter, the IT change calendar and your inbox',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="lavender">
          <ConsoleCard title={t.filterTitle} rows={d.filter} />
          <ConsoleCard title={t.senderTitle} rows={[t.sender]} />
          <ConsoleCard title={t.policyTitle} rows={d.policy} />
          <InboxList title={t.inboxTitle} rows={rows} />
        </Panel>
      </Scene>
    ),
  }
}

function d4Spec(): FrameSpec {
  const t = T.d4
  const description =
    `The office chat and the sign-in logs at 10:30 AM. ${t.chatTitle}: ${t.chat.map(([who, text]) => `${who}: "${text}"`).join(' ')} ` +
    `${t.manager[0]}: "${t.manager[1]}" A card titled "${t.logsTitle}" lists: ${pairWords(t.logs)}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the office chat',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="peach">
          <p className="m-0 text-xs font-bold">{t.chatTitle}</p>
          <Each items={t.chat} render={([who, text]) => <SpeechBubble speaker={who}>{text}</SpeechBubble>} />
          <SpeechBubble speaker={t.manager[0]}>{t.manager[1]}</SpeechBubble>
          <ConsoleCard title={t.logsTitle} rows={t.logs} />
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

/** The pictures of one version of the scenario. */
export function noticeFrames(v: NoticeVersion): FrameSet {
  return { setting: settingSpec(), decisions: [d1Spec(v), d2Spec(), d3Spec(v), d4Spec()] }
}
