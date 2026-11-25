/**
 * Screens and paper: browser window, laptop, phone with notifications,
 * email view, letter, toast and taskbar tray.
 */
import type { ReactNode } from 'react'
import { AMBER, BLUE, GREEN, INK, LINE, PAPER, RED, ROSE, SCREEN, SLATE, STEEL } from './palette'
import { boxStyle, Each, tiltStyle } from './primitives'

/** The three little window buttons, drawn only. */
function WindowDots() {
  return (
    <svg width="42" height="12" viewBox="0 0 42 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="4.5" fill={RED} stroke={INK} strokeWidth="2" />
      <circle cx="21" cy="6" r="4.5" fill={AMBER} stroke={INK} strokeWidth="2" />
      <circle cx="36" cy="6" r="4.5" fill={GREEN} stroke={INK} strokeWidth="2" />
    </svg>
  )
}

/** A browser window: tab title, address bar text and a content area. */
export function Browser({
  url,
  title,
  children,
  secure,
  tilt,
}: {
  url: string
  title: string
  children: ReactNode
  /** Writes "https" as a padlock word beside the address; plain text, not a colour. */
  secure?: boolean
  tilt?: number
}) {
  return (
    <div className="min-w-0 rounded-xl" style={{ ...boxStyle(SCREEN), ...tiltStyle(tilt), overflow: 'clip' }}>
      <div className="flex items-center gap-2 px-2 py-1" style={{ background: STEEL, borderBottom: `${LINE}px solid ${INK}` }}>
        <WindowDots />
        <span className="min-w-0 truncate rounded-t-md px-2 text-xs font-bold" style={{ background: SCREEN, border: `2px solid ${INK}`, borderBottom: 'none' }}>
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2 px-2 py-1 text-xs" style={{ background: PAPER, borderBottom: `2px solid ${INK}` }}>
        {secure === undefined ? null : <span className="font-bold">{secure ? 'Padlock: secure' : 'Padlock: not secure'}</span>}
        <span className="min-w-0 flex-1 break-all rounded-full px-2 py-0.5 font-mono" style={{ background: SCREEN, border: `2px solid ${INK}` }}>
          {url}
        </span>
      </div>
      <div className="p-3 text-sm">{children}</div>
    </div>
  )
}

/** A laptop: screen bezel around any content, and a base. */
export function Laptop({ children, tilt }: { children: ReactNode; tilt?: number }) {
  return (
    <div className="mx-auto w-full min-w-0" style={tiltStyle(tilt)}>
      <div className="rounded-t-2xl p-2" style={boxStyle(SLATE, { borderBottom: 'none' })}>
        <div className="min-w-0 rounded-md" style={{ background: SCREEN, color: INK, overflow: 'clip' }}>
          {children}
        </div>
      </div>
      <div className="mx-auto h-3 w-[104%] -translate-x-[2%] rounded-b-2xl" style={boxStyle(STEEL)} aria-hidden="true" />
    </div>
  )
}

export interface TrayItem {
  label: string
  /** Short text after the label, for example a state. */
  detail?: string
}

/** The taskbar strip at the bottom of a screen: items written out, then the time. */
export function Tray({ items, time }: { items: TrayItem[]; time: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-2 py-1 text-xs font-semibold" style={{ background: STEEL, borderTop: `2px solid ${INK}`, color: INK }}>
      <Each items={items} render={(item) => (
          <span className="rounded px-1" style={{ background: PAPER, border: `1.5px solid ${INK}` }}>
            {item.label}
            {item.detail ? `: ${item.detail}` : ''}
          </span>
        )} />
      <span className="font-bold">{time}</span>
    </div>
  )
}

/** A pop-up notice on a laptop or desktop screen. */
export function Toast({ app, title, body, tilt }: { app: string; title: string; body: ReactNode; tilt?: number }) {
  return (
    <div className="max-w-[18rem] rounded-lg px-3 py-2 text-xs" style={{ ...boxStyle(PAPER, { boxShadow: `2px 2px 0 ${INK}` }), ...tiltStyle(tilt) }}>
      <p className="m-0 font-bold" style={{ color: BLUE }}>
        {app}
      </p>
      <p className="m-0 font-bold">{title}</p>
      <div>{body}</div>
    </div>
  )
}

export interface PhoneNotice {
  app: string
  text: string
  time: string
}

/** A phone: status line (time, battery written as a number) and notification cards. */
export function Phone({
  time,
  battery,
  notices,
  tilt,
}: {
  time: string
  battery: string
  notices: PhoneNotice[]
  tilt?: number
}) {
  return (
    <div className="w-full max-w-[15rem] rounded-[1.6rem] p-2" style={{ ...boxStyle(SLATE), ...tiltStyle(tilt) }}>
      <div className="rounded-[1.1rem] p-2" style={{ background: SCREEN, color: INK, minHeight: '9rem' }}>
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span>{time}</span>
          <span>Battery {battery}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Each items={notices} render={(n) => (
              <div className="rounded-lg px-2 py-1 text-xs" style={{ background: PAPER, border: `2px solid ${INK}` }}>
                <p className="m-0 flex justify-between gap-2 font-bold">
                  <span>{n.app}</span>
                  <span className="font-semibold">{n.time}</span>
                </p>
                <p className="m-0 break-words">{n.text}</p>
              </div>
            )} />
        </div>
      </div>
    </div>
  )
}

/**
 * An email as the inbox shows it. The sender's display name and its address
 * are both written out, then the subject, the body, and where a link leads.
 */
export function EmailView({
  fromName,
  fromAddress,
  to,
  subject,
  date,
  children,
  link,
  attachments,
  tilt,
}: {
  fromName: string
  fromAddress: string
  to: string
  subject: string
  date: string
  children: ReactNode
  link?: { label: string; url: string }
  attachments?: string[]
  tilt?: number
}) {
  return (
    <div className="min-w-0 rounded-xl" style={{ ...boxStyle(SCREEN), ...tiltStyle(tilt), overflow: 'clip' }}>
      <div className="px-3 py-2" style={{ background: STEEL, borderBottom: `${LINE}px solid ${INK}` }}>
        <p className="m-0 break-words text-base font-extrabold">{subject}</p>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 px-3 py-2 text-xs" style={{ borderBottom: `2px solid ${INK}`, background: PAPER }}>
        <dt className="font-bold">From</dt>
        <dd className="m-0 min-w-0 break-words">
          {fromName} <span className="font-mono">&lt;{fromAddress}&gt;</span>
        </dd>
        <dt className="font-bold">To</dt>
        <dd className="m-0 min-w-0 break-words">{to}</dd>
        <dt className="font-bold">Date</dt>
        <dd className="m-0">{date}</dd>
      </dl>
      <div className="flex flex-col gap-2 px-3 py-3 text-sm">
        {children}
        {link ? (
          <div className="flex flex-col gap-1">
            <span className="w-fit rounded-md px-3 py-1 text-sm font-bold underline" style={{ background: ROSE, border: `2px solid ${INK}` }}>
              {link.label}
            </span>
            <span className="break-all rounded px-2 py-0.5 text-xs" style={{ background: PAPER, border: `1.5px dashed ${INK}` }}>
              Link goes to: <span className="font-mono">{link.url}</span>
            </span>
          </div>
        ) : null}
        {attachments && attachments.length > 0 ? (
          <p className="m-0 text-xs font-semibold">
            Attachments: <Each items={attachments} render={(name) => <span className="mr-2 rounded px-1 font-mono" style={{ border: `1.5px solid ${INK}`, background: PAPER }}>{name}</span>} />
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** A sheet of paper: heading, lines of text, and an optional stamp or footer. */
export function Letter({
  heading,
  children,
  footer,
  stamp,
  tilt = 1,
}: {
  heading: string
  children: ReactNode
  footer?: string
  stamp?: string
  tilt?: number
}) {
  return (
    <div className="relative min-w-0 px-4 py-3 text-sm" style={{ ...boxStyle(PAPER), ...tiltStyle(tilt) }}>
      <p className="m-0 border-b-2 pb-1 text-base font-extrabold" style={{ borderColor: INK }}>
        {heading}
      </p>
      <div className="flex flex-col gap-1.5 pt-2">{children}</div>
      {footer ? <p className="m-0 pt-2 text-xs font-semibold">{footer}</p> : null}
      {stamp ? (
        <span className="absolute right-2 top-2 rotate-6 rounded px-1.5 text-xs font-extrabold uppercase" style={{ border: `2px solid ${INK}`, background: ROSE }}>
          {stamp}
        </span>
      ) : null}
    </div>
  )
}
