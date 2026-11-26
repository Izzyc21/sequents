/**
 * Sample picture built with the kit: an email as it arrived in the inbox.
 * The sender, link address and dates are inputs, so a scenario can draw the
 * same email layout for each of its versions. Registered nowhere yet.
 */
import type { ReactNode } from 'react'
import { EmailView, Panel, Character, Each } from './kit'
import type { FrameSpec } from './types'

export interface ArrivedEmail {
  fromName: string
  fromAddress: string
  to: string
  date: string
  subject: string
  linkUrl: string
  /** Caption under the picture: when it arrived and where. */
  caption: string
  /** Words on the link button; the sample wording when left out. */
  linkLabel?: string
  /** Body paragraphs; the sample wording when left out. */
  body?: string[]
}

const SAMPLE_BODY = [
  'Hello,',
  'Your Harlow & Finch email password expires today at 5:00 PM.',
  'Sign in and choose a new password before then so your account keeps working.',
  'IT Support',
]

/** The email as the inbox shows it, with the reader beside it. */
export function EmailArrived({ email, aside }: { email: ArrivedEmail; aside?: ReactNode }) {
  return (
    <Panel caption={email.caption} fill="sky">
      <EmailView
        fromName={email.fromName}
        fromAddress={email.fromAddress}
        to={email.to}
        subject={email.subject}
        date={email.date}
        link={{ label: email.linkLabel ?? 'Update password now', url: email.linkUrl }}
        tilt={-0.6}
      >
        <Each items={email.body ?? SAMPLE_BODY} render={(line) => <p className="m-0">{line}</p>} />
      </EmailView>
      {aside ?? (
        <div className="flex justify-end">
          <Character name="You" mood="calm" shirt="#a6dcb8" />
        </div>
      )}
    </Panel>
  )
}

const SAMPLE: ArrivedEmail = {
  fromName: 'IT Support',
  fromAddress: 'support@harlowfinch.exa',
  to: 'all-staff@harlowfinch.exa',
  date: 'Tue 9:14 AM',
  subject: 'Your password expires today',
  linkUrl: 'https://harlowfinch.exa/password',
  caption: 'Tuesday, 9:14 AM. The email in your inbox.',
}

export const sampleEmailFrame: FrameSpec = {
  title: 'Picture: the email in your inbox',
  render: () => <EmailArrived email={SAMPLE} />,
}
