/**
 * Pictures for the "password expires today" scenario. Two versions
 * share one setting picture and the pictures of decisions 2 and 4; decisions
 * 1 and 3 differ in the details the pictures show (an address bar, a log row,
 * a phone line, a console card, a calendar card and one inbox row). What the
 * people in the pictures think is the same in both versions.
 *
 * Every drawn word comes from NOTICE_TEXT, and the screen-reader description
 * of each picture is built from the same constants, so the two cannot drift.
 */
import { Character, ConsoleCard, Each, InboxList, LogTable, Panel, Phone, Scene, SpeechBubble, StatTile, StickyNote, Browser, Thoughts, thoughtWords, type Thought } from './kit'
import { ROSE } from './palette'
import { EmailArrived } from './settingEmail'
import type { FrameSet, FrameSpec } from './types'

export type NoticeVersion = 0 | 1

const LOG_COLUMNS = ['Time', 'User', 'City', 'App', 'Result']

/** The words every picture of this scenario draws. */
export const NOTICE_TEXT = {
  email: {
    fromName: 'IT Support',
    fromAddress: 'support@harlowfinch.example',
    to: 'All staff',
    date: 'Today, 9:05 AM',
    subject: 'Your password expires today',
    body: ['Hello,', 'Your Harlow & Finch password expires at 5:00 PM today. Use the button below to keep your account active.', 'IT Support'],
    linkLabel: 'Keep my account active',
    linkUrl: 'https://go.harlowfinch.example/r/7Fq2',
    caption: 'Today, 9:05 AM. The email as it arrived, and Dana at your desk at 9:20 AM.',
    dana: 'I clicked it, typed my password and approved the prompt on my phone.',
    thoughts: [['Dana', 'Was I supposed to do something different?']] as Thought[],
  },
  d1: {
    caption: "Today, 9:22 AM. Dana's laptop, her phone and the admin console.",
    tab: 'Sign in to your account',
    page: ['Sign in', 'Work email: dana.reyes@harlowfinch.example', 'Password: ********'],
    payroll: 'Payroll run: step 3 of 5',
    sticky: 'Payroll due 12:00 PM',
    logTitle: 'Admin console: sign-in log',
    columns: LOG_COLUMNS,
    phoneTime: '9:22',
    phoneApp: 'Authenticator',
    phoneAt: '9:19 AM',
    thoughts: [
      ['Dana', 'Two more steps and payroll is done. Please let me finish.'],
      ['Lena', 'If her account goes, does mine go next?'],
    ] as Thought[],
    byVersion: [
      {
        url: 'https://login.microsoftonline.com.hf-secure-id.example/common/oauth2',
        rows: [
          ['9:19 AM', 'Dana Reyes', 'Amsterdam', 'Firefox on Linux', 'Success'],
          ['8:47 AM', 'Dana Reyes', 'New York', 'Edge on Windows', 'Success'],
          ['Mon 4:48 PM', 'Dana Reyes', 'Newark', 'Edge on Windows', 'Success'],
        ],
        prompt: 'Approve sign-in? Location: Amsterdam',
      },
      {
        url: 'https://login.microsoftonline.com/harlowfinch.example/oauth2/authorize',
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
    caption: 'Today, 9:40 AM. The hallway and the places you can check.',
    manager: ['Office manager', 'Is that email okay to use?'],
    hallway: ['Staff', 'Is the email okay to open?'],
    phoneTime: '9:40',
    sam: ['Messages: Sam', 'Boarding now. Phone off until we land at 1 PM.', 'Today 6:40 AM'],
    sticky: 'Sam lands 1 PM',
    cardTitle: 'Places to check',
    places: [
      { label: 'IT page', value: 'Company intranet' },
      { label: 'IT change calendar', value: 'Shared calendar' },
      { label: 'Sam (IT lead)', value: 'Phone off until 1 PM' },
    ],
    thoughts: [
      ['Priya', "If this one is from IT and I ignore it, I'm locked out at 5."],
      ['Office manager', 'Last thing I want is everyone typing their password into that.'],
    ] as Thought[],
  },
  d3: {
    caption: 'Today, 9:55 AM. The web filter console, the IT change calendar and the inbox list.',
    filterTitle: 'Web filter console: link destination (after the redirect)',
    tiles: ['312 blocked this week', 'Firewall: no alerts'],
    senderTitle: 'Web filter console: sender domain',
    sender: { label: 'harlowfinch.example', value: 'Business, allowed' },
    policyTitle: 'IT change calendar: this week',
    inboxTitle: 'Inbox',
    commonRows: [
      { time: '9:05 AM', from: 'IT Support', subject: 'Your password expires today', unread: true },
      { time: 'Tue', from: 'Facilities', subject: 'Printer moved to floor 2' },
      { time: 'Mon', from: 'Accounts', subject: 'Month-end timetable' },
    ],
    thoughts: [
      ['Office manager', 'More people are opening it while we stand here.'],
      ['Tom', 'If this came from IT, people still need instructions they can use.'],
    ] as Thought[],
    byVersion: [
      {
        filter: [
          { label: 'Domain', value: 'hf-secure-id.example' },
          { label: 'Category', value: 'Newly registered (3 days old)' },
          { label: 'Action', value: 'Allowed' },
        ],
        policy: [{ label: 'This week', value: 'Nothing booked' }],
        lastRow: { time: 'Last Thu', from: 'IT Notices', subject: 'Printer on floor 2 back in service' },
      },
      {
        filter: [
          { label: 'Domain', value: 'login.microsoftonline.com' },
          { label: 'Category', value: 'Sign-in services (Microsoft)' },
          { label: 'Action', value: 'Allowed' },
        ],
        policy: [{ label: 'Today, 5:00 PM', value: 'Password change, all staff (Sam)' }],
        lastRow: { time: 'Last Thu', from: 'IT Notices', subject: 'Password change planned this week' },
      },
    ],
  },
  d4: {
    caption: 'Today, 10:30 AM. The office chat and the sign-in logs.',
    chat: [
      ['Priya', 'Is the password email okay to use?'],
      ['Marcus', 'Do I need to do anything before lunch?'],
      ['Lena', 'Dana, are you all right?'],
      ['Tom', 'Printing is slow again.'],
    ],
    manager: ['Office manager', 'What should I say to people?'],
    logsTitle: 'Admin console: sign-in logs',
    logs: [{ label: 'Accounts to review', value: '30 accounts' }],
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
    `${e.body.join(' ')} A button reads "${e.linkLabel}". Link goes to: ${e.linkUrl}. Dana, at your desk, says: "${e.dana}" ${thoughtWords(e.thoughts)}`
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
              <Thoughts items={e.thoughts} />
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
    `The address bar reads ${d.url}, with a padlock marked secure. The page reads: ${t.page.join('. ')}. A banner on the laptop reads "${t.payroll}". ` +
    `The admin console sign-in log has the columns ${t.columns.join(', ')}. Its rows: ${d.rows.map(rowWords).join('; ')}. ` +
    `Dana's phone shows a notice from ${t.phoneApp} at ${t.phoneAt}: "${d.prompt}". A sticky note reads "${t.sticky}". ${thoughtWords(t.thoughts)}`
  return {
    title: "Picture: Dana's laptop and the admin console",
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="cream">
          <Browser url={d.url} title={t.tab} secure>
            <div className="flex flex-col gap-1">
              <Each items={t.page} render={(line, i) => <p className={i === 0 ? 'm-0 text-base font-extrabold' : 'm-0'}>{line}</p>} />
              <StatTile>{t.payroll}</StatTile>
            </div>
          </Browser>
          <LogTable title={t.logTitle} columns={t.columns} rows={d.rows} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Phone time={t.phoneTime} battery="80%" notices={[{ app: t.phoneApp, text: d.prompt, time: t.phoneAt }]} />
            <StickyNote>{t.sticky}</StickyNote>
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
    `The hallway and the places you can check at 9:40 AM. The ${t.manager[0].toLowerCase()} says: "${t.manager[1]}" Staff in the hallway say: "${t.hallway[1]}" ` +
    `Your phone shows a message from Sam at ${t.sam[2]}: "${t.sam[1]}" A sticky note reads "${t.sticky}". A card titled "${t.cardTitle}" lists: ${pairWords(t.places)}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the hallway and the help channels',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="mint">
          <SpeechBubble speaker={t.manager[0]}>{t.manager[1]}</SpeechBubble>
          <SpeechBubble speaker={t.hallway[0]} side="right">
            {t.hallway[1]}
          </SpeechBubble>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Phone time={t.phoneTime} battery="64%" notices={[{ app: t.sam[0], text: t.sam[1], time: t.sam[2] }]} />
            <StickyNote>{t.sticky}</StickyNote>
          </div>
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
    `The web filter console, the IT change calendar and the inbox list at 9:55 AM. ` +
    `Card "${t.filterTitle}": ${pairWords(d.filter)}. Tiles: ${t.tiles.join('; ')}. Card "${t.senderTitle}": ${pairWords([t.sender])}. ` +
    `Card "${t.policyTitle}": ${pairWords(d.policy)}. ${t.inboxTitle} list, newest first: ${rows.map((r) => `${r.time}, ${r.from}: ${r.subject}`).join('; ')}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the filter console, the IT change calendar and the inbox',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="lavender">
          <ConsoleCard title={t.filterTitle} rows={d.filter} />
          <div className="flex flex-wrap gap-2">
            <Each items={t.tiles} render={(tile) => <StatTile>{tile}</StatTile>} />
          </div>
          <ConsoleCard title={t.senderTitle} rows={[t.sender]} />
          <ConsoleCard title={t.policyTitle} rows={d.policy} />
          <InboxList title={t.inboxTitle} rows={rows} />
          <Thoughts items={t.thoughts} />
        </Panel>
      </Scene>
    ),
  }
}

function d4Spec(): FrameSpec {
  const t = T.d4
  const description =
    `The office chat and the sign-in logs at 10:30 AM. Messages: ${t.chat.map(([who, text]) => `${who}: "${text}"`).join(' ')} ` +
    `${t.manager[0]}: "${t.manager[1]}" A card titled "${t.logsTitle}" lists: ${pairWords(t.logs)}. ${thoughtWords(t.thoughts)}`
  return {
    title: 'Picture: the office chat',
    render: () => (
      <Scene description={description}>
        <Panel caption={t.caption} fill="peach">
          <Each items={t.chat} render={([who, text]) => <SpeechBubble speaker={who}>{text}</SpeechBubble>} />
          <SpeechBubble speaker={t.manager[0]} side="right">
            {t.manager[1]}
          </SpeechBubble>
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
