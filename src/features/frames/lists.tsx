/**
 * Lists and tables for screens: an inbox list, a log table and a console card.
 * Every cell is plain text; nothing here relies on colour to carry a state.
 */
import { INK, LINE, PAPER, SCREEN, STEEL } from './palette'
import { boxStyle, Each, tiltStyle } from './primitives'

export interface InboxRow {
  from: string
  subject: string
  /** When it arrived, written the way a mail list does: "9:05 AM", "Tue", "Last Thu". */
  time: string
  unread?: boolean
}

/** A mail list: one line per message, newest first, with the sender and subject written out. */
export function InboxList({ title = 'Inbox', rows, tilt }: { title?: string; rows: InboxRow[]; tilt?: number }) {
  return (
    <div className="min-w-0 rounded-xl" style={{ ...boxStyle(SCREEN), ...tiltStyle(tilt), overflow: 'clip' }}>
      <p className="m-0 px-3 py-1 text-xs font-extrabold" style={{ background: STEEL, borderBottom: `${LINE}px solid ${INK}` }}>
        {title}
      </p>
      <ul className="m-0 flex list-none flex-col p-0 text-xs">
        <Each
          items={rows}
          render={(row) => (
            <li className="grid grid-cols-[4.5rem_1fr] gap-x-2 px-3 py-1" style={{ background: PAPER, borderBottom: `1.5px solid ${INK}` }}>
              <span className="font-semibold">{row.time}</span>
              <span className="min-w-0 break-words">
                <span className={row.unread ? 'font-extrabold' : 'font-bold'}>{row.from}</span>
                {row.unread ? <span className="sr-only"> (unread)</span> : null}
                {': '}
                {row.subject}
              </span>
            </li>
          )}
        />
      </ul>
    </div>
  )
}

/** A small table with a heading row, such as a sign-in log. */
export function LogTable({ title, columns, rows, tilt }: { title: string; columns: string[]; rows: string[][]; tilt?: number }) {
  return (
    <div className="min-w-0 rounded-xl" style={{ ...boxStyle(SCREEN), ...tiltStyle(tilt), overflow: 'clip' }}>
      <p className="m-0 px-3 py-1 text-xs font-extrabold" style={{ background: STEEL, borderBottom: `${LINE}px solid ${INK}` }}>
        {title}
      </p>
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead>
          <tr>
            <Each items={columns} render={(c) => <th className="break-words px-1.5 py-1 font-bold" style={{ borderBottom: `2px solid ${INK}` }}>{c}</th>} />
          </tr>
        </thead>
        <tbody>
          <Each
            items={rows}
            render={(row) => (
              <tr>
                <Each items={row} render={(cell) => <td className="break-words px-1.5 py-1 align-top" style={{ borderBottom: `1.5px solid ${INK}` }}>{cell}</td>} />
              </tr>
            )}
          />
        </tbody>
      </table>
    </div>
  )
}

export interface ConsoleRow {
  label: string
  value: string
}

/** A settings or status card: a heading and label and value pairs. */
export function ConsoleCard({ title, rows, tilt }: { title: string; rows: ConsoleRow[]; tilt?: number }) {
  return (
    <div className="min-w-0 rounded-xl" style={{ ...boxStyle(SCREEN), ...tiltStyle(tilt), overflow: 'clip' }}>
      <p className="m-0 px-3 py-1 text-xs font-extrabold" style={{ background: STEEL, borderBottom: `${LINE}px solid ${INK}` }}>
        {title}
      </p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 px-3 py-2 text-xs">
        <Each
          items={rows}
          render={(row) => (
            <>
              <dt className="font-bold">{row.label}</dt>
              <dd className="m-0 min-w-0 break-words">{row.value}</dd>
            </>
          )}
        />
      </dl>
    </div>
  )
}

/** A short status tile, for example a count. */
export function StatTile({ children }: { children: string }) {
  return (
    <span className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: PAPER, border: `2px solid ${INK}` }}>
      {children}
    </span>
  )
}
