/**
 * Sample picture built with the kit: an email as it arrived in the inbox.
 * The sender, link address and dates are inputs, so a scenario can draw the
 * same email layout for each of its versions. Registered nowhere yet.
 */
import { EmailView, Panel, Character } from './kit'
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
}

/** The email as the inbox shows it, with the reader beside it. */
export function EmailArrived({ email }: { email: ArrivedEmail }) {
  return (
    <Panel caption={email.caption} fill="sky">
      <EmailView
        fromName={email.fromName}
        fromAddress={email.fromAddress}
        to={email.to}
        subject={email.subject}
        date={email.date}
        link={{ label: 'Update password now', url: email.linkUrl }}
        tilt={-0.6}
      >
        <p className="m-0">Hello,</p>
        <p className="m-0">Your Harlow &amp; Finch email password expires today at 5:00 PM.</p>
        <p className="m-0">Sign in and choose a new password before then so your account keeps working.</p>
        <p className="m-0">IT Support</p>
      </EmailView>
      <div className="flex justify-end">
        <Character name="You" mood="calm" shirt="#a6dcb8" />
      </div>
    </Panel>
  )
}

const SAMPLE: ArrivedEmail = {
  fromName: 'IT Support',
  fromAddress: 'support@harlowfinch.example',
  to: 'all-staff@harlowfinch.example',
  date: 'Tue 9:14 AM',
  subject: 'Your password expires today',
  linkUrl: 'https://harlowfinch.example/password',
  caption: 'Tuesday, 9:14 AM. The email in your inbox.',
}

export const sampleEmailFrame: FrameSpec = {
  title: 'Picture: the email in your inbox',
  render: () => <EmailArrived email={SAMPLE} />,
}
