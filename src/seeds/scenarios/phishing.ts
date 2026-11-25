/**
 * The phishing starter: one scenario with two hidden versions. Both share the
 * readable half (title, situation, setting, prompts, approach and way texts);
 * each way carries one grade, outcome and reason per version, and each
 * version has its own flags and endings. The default export is version 0, the
 * starter's main draft; `phishingVersion1` is registered in ../variants.ts.
 */
import type { Grade, ScenarioDraft } from '../../features/play/types'

interface V {
  g: Grade
  o: string
  w: string
  raises?: string[]
  ifRaised?: { flag: string; grade: Grade; outcome: string; why: string }
}
interface Way { text: string; v: [V, V] }
interface Approach { text: string; ways: Way[] }
interface Decision { prompt: string; approaches: Approach[] }

const READABLE = {
  title: 'A "password expires today" email goes out to the office',
  situation: 'An email saying "your password expires today" reached all 30 of us, and a coworker has already used the link in it.',
  setting:
    'You are the IT assistant at a 30-person office on Microsoft 365, with global admin rights. Sam, your IT lead, is on a flight until 1 PM. The laptops run a web filter agent, managed from a console you rarely open, and the office has a firewall you adjust often. At 9:05 an email from "IT Support", subject "Your password expires today", reached every inbox. At 9:20 Dana from accounting comes to your desk: she clicked the link, entered her password on the page it opened and approved the phone prompt that followed. Nobody else has said anything yet.',
}

const FLAGS: [{ id: string; label: string }[], { id: string; label: string }[]] = [
  [
    { id: 'back-in-early', label: 'Dana was let back in before her account was swept' },
    { id: 'office-only-block', label: 'The link was blocked only on the office network' },
  ],
  [{ id: 'notice-removed', label: 'The IT notice was removed from the inboxes' }],
]

const ENDINGS = [
  {
    good: 'The Amsterdam session on Dana’s account was cut off within minutes, and by 10:05 the message was gone from all 30 inboxes with a copy kept for evidence. The link’s site was blocked, at least on the office network, and staff heard from you before noon without anyone being named.',
    ok: 'The email was an attack, and parts of your response held. At least one step cost time, left a way in open for longer than it needed to be, or made people less likely to come to you. Whether that gap mattered depends on what the attacker did with it.',
    bad: 'The email was an attack, and your response did not keep pace with it. More than one step cost time, left a way in open, or made people less likely to come to you, and together they cost a lot. You will spend the coming days finding out what the attacker reached.',
  },
  {
    good: 'The notice was real: Sam’s scheduled password change, posted on the IT page the Thursday before. Nearly everyone changed their password before 5 PM, no more than three people were locked out, and nobody was named.',
    ok: 'The notice was real: Sam’s scheduled password change. Parts of your response fit that, but at least one step cost the office time, interrupted work that did not need interrupting, left people without clear word on what to do before the day was out, or gave staff an answer you could not stand behind. There was no attacker, so every cost was one the office paid itself.',
    bad: 'The notice was real: Sam’s scheduled password change. More than one step cost the office time, interrupted work, left people without clear word on what to do before the day was out, or gave staff an answer you could not stand behind, and together they cost a lot. There was no attacker, so the disruption came from the response, not from the email.',
  },
] as const

const DECISIONS: Decision[] = [
  // ---------------------------------------------------------------- D1
  {
    prompt:
      'It is 9:22. Dana is at your desk with her laptop open and her phone beside it, and she has a payroll run to finish by noon. The admin console is open in another window.',
    approaches: [
      {
        text: 'Block her account while you work out what happened',
        ways: [
          {
            text: 'Block her sign-in, then revoke her sessions and tokens; leave her password and methods as they are for now',
            v: [
              {
                g: 'slip',
                o: 'By 9:26 she is blocked and the Amsterdam session can no longer renew its sign-in. The stolen password and anything added after her approval still work, so she cannot be let back in yet.',
                w: 'Blocking and revoking stop the session from renewing, but the stolen password and any added method work again the moment the block lifts. Replacing and clearing them at once closes both before she is let back in.',
              },
              {
                g: 'mistake',
                o: 'By 9:26 Dana is locked out mid-run. The log holds only her own sign-in from this office, so you unblock her at 9:41 and she finishes the run at 11:55, five minutes before the cut-off.',
                w: 'Nothing in the record was off, so there was nothing to contain, and the block cost fifteen minutes of her payroll window. Look at the evidence before locking an account.',
              },
            ],
          },
          {
            text: 'Block her sign-in, revoke her sessions and tokens, then reset her password and clear her sign-in methods',
            v: [
              {
                g: 'best',
                o: 'By 9:28 she is blocked, the Amsterdam session’s next refresh is refused and a new password is set. Every method is gone, and the audit log still shows when the extra one was added. Dana must set up her phone again.',
                w: 'Blocking, revoking, replacing the stolen password and clearing every method shuts the ways in that the record shows, and she stays out until the rest is checked. Note the added method’s details before removing it.',
              },
              {
                g: 'blunder',
                o: 'Her account is blocked, her password reset and her phone method cleared. She cannot approve anything until the phone is registered again, and the payroll run goes out at 2:10, after the cut-off.',
                w: 'Clearing every sign-in method means she must register again before she can work, and that takes time. The page and her sign-in record were normal, so the price was a late payroll for no gain.',
              },
            ],
          },
          {
            text: 'Block her sign-in and stop there; the rest can wait until you have a free hour',
            v: [
              {
                g: 'mistake',
                o: 'The block stops new sign-ins, but the attacker’s open session keeps reading Dana’s mail until its token expires, most of an hour. You still see it active in the log at 10:15.',
                w: 'Blocking sign-in stops new sessions but does not end ones already open. Revoking them is a separate step.',
              },
              {
                g: 'mistake',
                o: 'The block stops her working and nothing else is done. She waits twenty-five minutes for you to look, the log shows only her own sign-in, and the payroll run is nearly late.',
                w: 'A block is a reason to look at once, not a place to stop. It protected nothing here and took most of her morning.',
              },
            ],
          },
        ],
      },
      {
        text: 'Look at her sign-in record and the page she used first',
        ways: [
          {
            text: 'Compare the page’s address and her sign-in times and places with her usual ones, and let her keep working',
            v: [
              {
                g: 'mistake',
                o: 'You compare the address with the real sign-in page and spot the difference by 9:30. Dana kept working meanwhile, and the attacker’s session read her payroll mail and files until you blocked her at 9:32.',
                w: 'The comparison was right, but it left the stolen session live. When the sign-in record already looks off, ending the intruder’s access comes first and checking the page can follow.',
              },
              {
                g: 'best',
                o: 'Her 9:19 sign-in shows her usual city and laptop, and the page address is Microsoft’s own sign-in page. She keeps working, and the payroll run is out by 11:40.',
                w: 'The page address was Microsoft’s own and the sign-in came from her own laptop when she used the link, so nothing pointed to anyone else in her account. Checking first spared her a lockout.',
              },
            ],
          },
          {
            text: 'Compare the page address and sign-in record with her usual ones, and revoke her sessions as a precaution',
            v: [
              {
                g: 'mistake',
                o: 'Her sessions end at 9:28 and the comparison shows the odd page. Her password is still stolen, and at 9:50 the attacker signs back in on it with a method added earlier while Dana is refused.',
                w: 'Ending sessions without blocking or changing the sign-in leaves the stolen password usable. Whoever signs in first sets the next password.',
              },
              {
                g: 'slip',
                o: 'The comparison shows nothing wrong, but revoking her sessions signed her out of payroll mid-run. She signs back in, redoes twenty minutes of work and finishes at 11:55.',
                w: 'The precaution was not needed once the record looked normal, and ending sessions cost her unsaved work. Revoke when the evidence calls for it, not out of habit.',
              },
            ],
          },
          {
            text: 'Ask Dana what the page looked like and what she typed, and decide what to do from what she says',
            v: [
              {
                g: 'blunder',
                o: 'Dana says the page looked like her usual Microsoft one and she typed her password once. She cannot describe the address bar. You decide it was fine, and the attacker’s session keeps running past noon.',
                w: 'What a person remembers of a page is the weakest evidence, since a copy looks the same. The address and the sign-in record show what happened, and neither depends on her memory.',
              },
              {
                g: 'mistake',
                o: 'Dana says the page looked ordinary and she typed her password once. You have nothing to check her words against, spend twenty minutes unsure, and end up resetting her password after all.',
                w: 'Her memory cannot settle it either way; the address and the sign-in record can. Deciding from her account alone left the question open and cost time on a deadline.',
              },
            ],
          },
        ],
      },
      {
        text: 'Reset her password and let her get on with the payroll run',
        ways: [
          {
            text: 'Reset her password, revoke her sessions and tokens, and let her sign in again on the new password right away',
            v: [
              {
                g: 'slip',
                raises: ['back-in-early'],
                o: 'By 9:30 Dana is back at work on the new password and the Amsterdam session drops. Nothing has been looked at yet for what the attacker added while inside.',
                w: 'A new password and ended sessions stop the stolen sign-in, but handing the account back before any review leaves rules, extra methods or app access working under it.',
              },
              {
                g: 'mistake',
                o: 'The reset and the revoke end her payroll session mid-run. She signs in on the new password and finds the run’s progress gone, and the payroll goes out twenty minutes late.',
                w: 'Resetting a password that was typed on a normal page cut her off for no reason and cost her the deadline. Look at the page and the record before changing her account.',
              },
            ],
          },
          {
            text: 'Revoke all her sessions and tokens now, and force a password change at her next sign-in',
            v: [
              {
                g: 'mistake',
                o: 'Her sessions end, but the stolen password stays valid until her next sign-in. At 9:50 the log shows the attacker back in on it with a method added earlier, and Dana’s own sign-in is refused.',
                w: 'Ending sessions does nothing about a stolen password that stays usable until it is replaced. Whoever signs in first is the one who sets the new one.',
              },
              {
                g: 'slip',
                o: 'Her sessions end at 9:25 and she changes her password at the next sign-in, which is the change the notice asked for. Payroll is interrupted for ten minutes and then carries on.',
                w: 'A forced change at next sign-in is mild and matches what a real notice asks, so it did little harm. Ending her sessions mid-run was the unneeded part.',
              },
            ],
          },
          {
            text: 'Reset her password, then have Dana sign out of every device she uses and sign back in',
            v: [
              {
                g: 'mistake',
                o: 'Dana signs out of her laptop and phone and back in with the new password. The attacker’s browser in Amsterdam is not one of her devices, and it stays signed in.',
                w: 'Signing out on her own devices cannot end a session on the attacker’s machine; only revoking it from the admin side does that.',
              },
              {
                g: 'mistake',
                o: 'Dana resets, signs out of her laptop and phone and back in. The authenticator app has to be set up again on her phone, and the payroll run is ten minutes late.',
                w: 'Signing out everywhere forced a new sign-in on every device for no reason, and the extra prompts cost her the deadline. Her normal sign-in needed no repair.',
              },
            ],
          },
        ],
      },
    ],
  },
  // ---------------------------------------------------------------- D2
  {
    prompt:
      'It is 9:40. Staff in the hallway are asking each other whether the email is real, and the office manager asks what you can say.',
    approaches: [
      {
        text: 'Check the email against IT’s own records and channels',
        ways: [
          {
            text: 'Check the IT page and the IT change calendar for a password notice, and text Sam to ask if he sent it',
            v: [
              {
                g: 'slip',
                o: 'Neither the IT page nor the change calendar mentions a password change, and Sam’s phone is off until 1 PM. By 9:50 neither record shows a notice from IT, but two more people have opened the link while you looked.',
                w: 'Checking IT’s records was sound, but you already had the answer: the page Dana used was not Microsoft’s, and her account was signed in from Amsterdam minutes later. Staff could have been warned several minutes sooner.',
              },
              {
                g: 'best',
                o: 'The IT page has a post from last Thursday about this week’s password change, and the change calendar has it booked for today at 5 PM. Sam’s phone is off until 1 PM, but by 9:50 the records already answer you.',
                w: 'Checking where IT would have recorded a notice gives an answer the email cannot give about itself. Here two records agreed with the email, so you could act on it without having to reach Sam.',
              },
            ],
          },
          {
            text: 'Reply to the email and ask IT Support to confirm in writing that the notice came from them',
            v: [
              {
                g: 'mistake',
                o: 'You reply at 9:42 and an answer arrives within four minutes: “Yes, this is IT, please sign in today.” It comes from the same sender, so it proves nothing, and you have spent ten minutes on it.',
                w: 'Asking the sender whether the sender is genuine only tests the sender’s own word, and a lure answers yes. The reply also told whoever sent it that this mailbox is read and that IT is asking questions.',
              },
              {
                g: 'slip',
                o: 'Your reply goes to the IT helpdesk mailbox, which Sam checks only from his laptop. No answer comes before 1 PM, and you have spent the morning waiting on a mailbox nobody was reading.',
                w: 'A reply goes to a person who may not be there, and the wait cost the morning. It was a sound idea to ask IT, but a record that already exists would have answered at once.',
              },
            ],
          },
          {
            text: 'Open the sign-in page’s help link and call the support number listed there to ask about this notice',
            v: [
              {
                g: 'mistake',
                o: 'The help link opens the same page, and the number rings to a person who says they are IT and offers to “fix” Dana’s account if you read out a code. You hang up at 10:05, nothing wiser.',
                w: 'A number found on a page you are checking is only as trustworthy as that page. Use a number you already had, from your own records.',
              },
              {
                g: 'mistake',
                o: 'The help link opens Microsoft’s general support page, and the number reaches a queue. After forty minutes on hold you learn nothing about this office’s own policy.',
                w: 'Microsoft’s support line cannot say what Sam scheduled for this office. The office’s own records could, and the forty minutes bought nothing.',
              },
            ],
          },
        ],
      },
      {
        text: 'Find out how far the email spread and who has used the link',
        ways: [
          {
            text: 'Run a message trace on the sender and subject to list everyone the message was delivered to',
            v: [
              {
                g: 'mistake',
                o: 'The trace lists all 30 recipients by 9:50. It cannot say who opened the message or used the link, and you are still without an answer when the office manager comes back.',
                w: 'A delivery list is worth having, but it says nothing about who typed a password, and the address on Dana’s page already told you what the email was. Warning everyone came first; the list could follow.',
              },
              {
                g: 'mistake',
                o: 'The trace lists all 30 recipients by 9:50. It cannot say who opened the message or whether IT sent it, and by 10:05 you still cannot answer the office manager.',
                w: 'A delivery list does not say who sent a notice. IT’s own records would have, and the trace spent twenty minutes on the other question.',
              },
            ],
          },
          {
            text: 'Ask everyone in chat to reply if they clicked or typed anything, and wait for the replies',
            v: [
              {
                g: 'mistake',
                o: 'Eleven people reply that they did nothing, and nobody says they typed anything. By 10:20 one more person has entered a password and has not replied.',
                w: 'People who did something often stay quiet, and a reply count says nothing about the source. The people who most needed to be reached are the ones who did not answer.',
              },
              {
                g: 'mistake',
                o: 'Most reply that they did nothing, and a few ask whether they should. With no answer from you, six hold off changing their passwords, and none of it settles anything.',
                w: 'Asking for replies without an answer of your own leaves people guessing. It tells you little about the source and held up a change that was due.',
              },
            ],
          },
          {
            text: 'Search all 30 mailboxes for “password” and “sign in” to find other messages like it',
            v: [
              {
                g: 'mistake',
                o: 'The search finds the one message in 29 inboxes and nothing else, in forty minutes. It says nothing about who sent it or whether anyone used the link.',
                w: 'A keyword search across everyone’s mail is slow and mostly noise, and it cannot show where a message came from.',
              },
              {
                g: 'mistake',
                o: 'The search finds the one notice in 29 inboxes and a vendor’s unrelated reminder, in forty minutes. It does not say who sent it.',
                w: 'A wide keyword search is slow and mostly noise, and it cannot show who a message came from.',
              },
            ],
          },
        ],
      },
      {
        text: 'Give staff a plain answer now, from what you can see',
        ways: [
          {
            text: 'Tell everyone to use the link and change their passwords today',
            v: [
              {
                g: 'blunder',
                o: 'Staff change their passwords through the link all morning. By 10:30 eleven have entered them on the attacker’s page, and you spend the day resetting accounts.',
                w: 'Vouching for the message without checking where it came from sent the whole office to the page. Never stand behind a message before you know its source.',
              },
              {
                g: 'mistake',
                o: 'Staff change their passwords through the link, and it works: the page is Microsoft’s own. But two ask how you knew, and you have nothing to show them.',
                w: 'The answer happened to be right, but you had not checked, so you could not defend it. Had the notice been a lure, you would have sent everyone to it.',
              },
            ],
          },
          {
            text: 'Tell everyone not to use the link and not to enter anything',
            v: [
              {
                g: 'best',
                o: 'Staff stop using the link at 9:42. When the office manager asks how you know, you show her the page address and the Amsterdam sign-in, and one person comes over to say she opened the page but typed nothing.',
                w: 'The page’s address was not Microsoft’s, and Dana’s account was signed in from Amsterdam minutes after she used it. That was enough to warn everyone at once, and a plain warning made it easy to come forward.',
              },
              {
                g: 'blunder',
                o: 'Staff delete the notice and do not change their passwords. At 5 PM twenty-two accounts are locked out, Sam lands to a busy helpdesk, and you reset passwords until evening.',
                w: 'Warning people off a genuine notice made them ignore a real deadline. Without checking where it came from, either confident answer can be badly wrong.',
              },
            ],
          },
          {
            text: 'Tell everyone to wait until Sam lands at 1 PM and to leave the email alone until then',
            v: [
              {
                g: 'slip',
                o: 'Staff leave the email alone. Two who already typed their passwords say nothing, because nothing told them they were at risk, and you find them in the afternoon logs.',
                w: 'Waiting for Sam left the question open, so anyone who had already typed a password had no reason to think they were at risk. A plain warning would have told them.',
              },
              {
                g: 'slip',
                o: 'Staff wait for Sam. At 1:05 he confirms the notice, and everyone changes their password by 3 PM. A few people spend the morning worried that the email is a risk.',
                w: 'Waiting cost no deadline here, since the change was due at 5 PM, but it left the office anxious for hours over an answer you could have found yourself in minutes.',
              },
            ],
          },
        ],
      },
    ],
  },
  // ---------------------------------------------------------------- D3
  {
    prompt: 'It is 9:55. The email is in 29 of the 30 inboxes, and about a dozen people have already opened it.',
    approaches: [
      {
        text: 'Deal with the email and its link for the whole office, starting now',
        ways: [
          {
            text: 'Block the link’s domain in the laptops’ web filter agent, then purge the message from all 30 mailboxes, keeping a copy',
            v: [
              {
                g: 'best',
                o: 'The domain stops loading on every laptop, in the office or at home, and the message is gone from all 30 inboxes by 10:05. Your saved copy has the full headers.',
                w: 'Blocking where the device is covers people anywhere, and removing the message ends new clicks. The saved copy gives you what you need to report it.',
              },
              {
                g: 'blunder',
                raises: ['notice-removed'],
                o: 'The filter blocks the address, and with it the password page the notice pointed to. Nobody can change a password, and by 10:30 the phones are ringing and the real notice is gone from every inbox.',
                w: 'The link led to Microsoft’s own password page, which every account needs. Blocking it broke the very thing the notice asked for. Check where a link goes before you block it.',
              },
            ],
          },
          {
            text: 'Block the link’s domain on the office firewall, then purge the message from all 30 mailboxes, keeping a copy of it',
            v: [
              {
                g: 'slip',
                raises: ['office-only-block'],
                o: 'The message is gone by 10:05 and the office firewall blocks the domain. Anyone off the office network, on a laptop at home or a phone, can still load the page.',
                w: 'A firewall only sees traffic passing through the office. The filter agent on the laptops follows people home, so that is where the domain has to be blocked.',
              },
              {
                g: 'mistake',
                raises: ['notice-removed'],
                o: 'The office firewall stops the password page and the notice is purged. People in the office cannot change their passwords and the phones ring until 10:40, while those at home carry on.',
                w: 'A firewall block reaches only the office, so people at home carried on, but in the office it cut off the very page the notice pointed to, and the purge took the instructions away too.',
              },
            ],
          },
          {
            text: 'Add a mail rule rejecting “password expires” and purge every message with that wording from all 30 mailboxes at once',
            v: [
              {
                g: 'mistake',
                o: 'The rule later catches a real notice from your accounting software and a vendor’s invoice reminder, while the link itself still loads for anyone who has a copy.',
                w: 'A keyword rule catches genuine mail and does nothing about the link. Match on the link’s domain and the sender, not on common wording.',
              },
              {
                g: 'mistake',
                raises: ['notice-removed'],
                o: 'The rule pulls the real notice and a vendor’s “invoice password” reminder as well. People cannot change their passwords and ask you why the email disappeared.',
                w: 'A wording rule catches real mail and does nothing about a link that was fine. Match on where a message came from, and look before deleting it.',
              },
            ],
          },
        ],
      },
      {
        text: 'Check which accounts have used the link before changing anything',
        ways: [
          {
            text: 'Search all 30 sign-in logs for sign-ins from new countries or unknown devices since 9:05, then act on each',
            v: [
              {
                g: 'mistake',
                o: 'You find one more account with an odd sign-in and reset it by 10:20, but the page stayed reachable for half an hour more while you searched, and two more people used the link.',
                w: 'Hunting for victims is worthwhile, but it takes longer than blocking and removing, and each minute the page stays reachable adds clicks. Block first, hunt right after.',
                ifRaised: {
                  flag: 'back-in-early',
                  grade: 'blunder',
                  outcome: 'Dana has been working in the account since 9:30. The search finds the attacker’s extra sign-in method too late: at 10:40 two more messages go out from her address.',
                  why: 'Her account was reopened before anyone looked at what the attacker had added, so the leftover access was live while you searched, and a log search alone did not close it.',
                },
              },
              {
                g: 'best',
                o: 'The logs show nothing from a new country or device since 9:05, only staff on their usual laptops and phones, several on Microsoft’s own password page. It matches the IT notice, so you leave the message in place.',
                w: 'The sign-in logs showed ordinary activity, with staff on Microsoft’s own password page, which fits a notice being followed. Looking first kept you from breaking it.',
              },
            ],
          },
          {
            text: 'Check the office firewall logs for visits to the link and then speak to each person who is shown to have reached it',
            v: [
              {
                g: 'mistake',
                o: 'The logs show four visits from inside the office. The people who opened it on a phone or from home do not appear, and one of them has already entered a password.',
                w: 'Firewall logs only see traffic through the office, so they miss phones and people at home. Sign-in logs and a block on the devices cover them.',
              },
              {
                g: 'slip',
                o: 'The firewall logs show five visits from inside the office, and you speak to each. All five changed their passwords, and the talks take forty minutes while others wait for word.',
                w: 'Firewall logs miss anyone off the network, and talking to each person reached only five. The sign-in logs cover everyone at once.',
              },
            ],
          },
          {
            text: 'Ask everyone to reply if they used the link and handle the replies as they arrive, leaving the message up',
            v: [
              {
                g: 'mistake',
                o: 'Six people reply that they did nothing. By 10:45 two more have typed their passwords into the page, and neither replies.',
                w: 'People who entered a password often do not say so, and every minute the message stays up adds another click. Remove the bait first, then ask.',
              },
              {
                g: 'mistake',
                o: 'Six reply that they did nothing and nine say they have changed their password. By 10:40 you are still counting replies and nobody has been told what to do.',
                w: 'A reply is optional and slow, while the sign-in logs already cover every account. Counting replies spent the morning on what those logs would have shown in minutes.',
              },
            ],
          },
        ],
      },
      {
        text: 'Lock down all 30 accounts across the whole office until you know more about it',
        ways: [
          {
            text: 'Revoke all sessions and force a password reset for all 30 accounts, then remove the message once everyone is back in',
            v: [
              {
                g: 'mistake',
                o: 'At 10:05 thirty people hit a sign-in wall and call you at once. The message is still in their inboxes and the link works, and two of them open it again.',
                w: 'Most accounts show no sign of compromise, and resetting them while the link is live invites repeat clicks. Remove the bait first and reset only accounts with signs.',
              },
              {
                g: 'slip',
                o: 'At 10:05 all 30 accounts are signed out and sent to change their passwords, which the notice asked for anyway. Dana’s payroll run loses its progress, and the office loses an hour of work.',
                w: 'A forced reset matched what the notice asked, so it did little harm, but ending everyone’s sessions cost an hour for nothing. Most accounts showed nothing to reset.',
              },
            ],
          },
          {
            text: 'Disable all 30 accounts until you have cleared each person one by one and confirmed what they entered',
            v: [
              {
                g: 'blunder',
                o: 'The office stops. Clients cannot reach anyone, and clearing 30 people takes the afternoon while the link still works for anyone off the network.',
                w: 'Shutting down the whole office costs more than the attack did, and it removes neither the message nor the link. Contain the bait first, then clear accounts by evidence.',
              },
              {
                g: 'blunder',
                o: 'The office stops. Nobody can reach a client, and clearing 30 people takes the afternoon, though every account was fine and the notice was genuine.',
                w: 'Disabling everyone cost far more than the notice could have, and nothing was wrong. Lock accounts down from evidence, not from alarm.',
              },
            ],
          },
          {
            text: 'Turn off incoming email for all 30 mailboxes until the message and the link have been dealt with',
            v: [
              {
                g: 'mistake',
                o: 'No new mail arrives, but the message is still in everyone’s inbox. Two clients call to ask why their messages bounce.',
                w: 'Stopping incoming mail leaves the message already delivered where it is and blocks real business mail as well.',
              },
              {
                g: 'mistake',
                o: 'No mail arrives, including clients’ messages, until 1 PM. The notice stays in every inbox, and half the office still has to change passwords by 5.',
                w: 'Stopping mail did nothing to a notice already delivered, and it blocked real business. The email needed no handling.',
              },
            ],
          },
        ],
      },
    ],
  },
  // ---------------------------------------------------------------- D4
  {
    prompt: 'It is 10:30. The office manager asks what to tell staff, and you still have the sign-in logs for all 30 accounts to go through.',
    approaches: [
      {
        text: 'Brief the whole office now, with what is known so far, gaps included',
        ways: [
          {
            text: 'Say in person and in chat what the email is and what to do with the link, and that you will check anyone unsure',
            v: [
              {
                g: 'best',
                o: 'Four more people come to your desk within the hour, two of whom typed passwords. You reset and revoke each in minutes, and nobody is left hunting for a reset page.',
                w: 'A spoken note plus a chat message reaches everyone at once and makes reporting safe. Checking each person yourself means each reset comes with revoked sessions and a look at their methods.',
              },
              {
                g: 'best',
                o: 'Staff change their passwords on Microsoft’s own page by 2 PM, and three come to you to check they did it right. You walk each through it, and nobody is locked out at 5.',
                w: 'A clear message with a way to ask for help reaches everyone at once, and checking the changes yourself catches mistakes early. It tells people what to do, not only what to avoid.',
              },
            ],
          },
          {
            text: 'Post what the email is in the office chat only, and ask anyone who has entered a password to deal with it themselves',
            v: [
              {
                g: 'slip',
                o: 'Most people read the note and a few change passwords on their own. Their stolen sessions are never revoked, and others hunt for where to change theirs and try the first “IT” link they find.',
                w: 'A password change made alone does not end a stolen session, and telling people to do it sends them looking for a page an attacker can copy. You do the resets, so sessions are revoked.',
                ifRaised: {
                  flag: 'office-only-block',
                  grade: 'mistake',
                  outcome: 'At 11:15 a colleague working from home reopens the page from her browser history; the link still loads for her and she enters her password. Your note told her to fix it herself, so she never comes to you.',
                  why: 'Because the link was blocked only at the office firewall, it still worked off the network, and a note telling people to fix it themselves left her unreported.',
                },
              },
              {
                g: 'slip',
                o: 'Most people read the chat and change their passwords themselves. Three miss it and are locked out at 5 PM, and nobody was watching for who had not changed theirs.',
                w: 'Chat alone reaches only those who read it, and leaving each person to handle their own password gave you no check on who had done it. A spoken note and a follow-up catch those.',
                ifRaised: {
                  flag: 'notice-removed',
                  grade: 'mistake',
                  outcome: 'With the notice gone from the inboxes, the chat note is all people have. Nine cannot find the page to change their passwords, and by 5 PM eleven are locked out.',
                  why: 'Once the notice was removed, a chat line was the only instruction left, and it gave no way to the page. Without the notice, people needed a spoken walk-through.',
                },
              },
            ],
          },
          {
            text: 'Name Dana as the first person who used the link, so others can see how it went for her',
            v: [
              {
                g: 'mistake',
                o: 'People grasp the stakes, but Dana is mortified, and two colleagues say they would rather not mention a click after seeing what happened to her. One who typed a password stays silent.',
                w: 'Naming a victim makes others fear the same exposure and hide their clicks. Describe the scam, not who it caught, and make coming forward safe.',
              },
              {
                g: 'mistake',
                o: 'Dana gets a stream of chat messages while she finishes payroll, and the run goes out late. Others say they would rather not mention any trouble with the link.',
                w: 'Naming a colleague pulled attention onto her and made others reluctant to ask for help. Describe the notice and what to do, not who used the link first.',
              },
            ],
          },
        ],
      },
      {
        text: 'Wait for the sign-in review and give the whole office one accurate account',
        ways: [
          {
            text: 'Tell staff only what is confirmed now, and give the full account at noon',
            v: [
              {
                g: 'slip',
                o: 'Staff avoid the email and wait for noon. Nobody who typed a password has been asked to come to you, so two of them say nothing until the afternoon.',
                w: 'A short true message is a sound start, but leaving out the request to report a click lets people who entered a password sit quietly for hours. Say what to do now, not just what to avoid.',
              },
              {
                g: 'slip',
                o: 'Staff read a short note and hold off on the email. At noon you confirm it, and passwords change after lunch, though a dozen forget until 4:45 and queue at your desk.',
                w: 'A short true message was a fair start, but it gave people no next step for two hours. Say what to do now, not only that you are checking.',
                ifRaised: {
                  flag: 'notice-removed',
                  grade: 'mistake',
                  outcome: 'With the notice removed, staff have no link and no instructions to come back to at noon. By 4:45 eleven still have not changed their passwords and are locked out at 5.',
                  why: 'The short note could only point back to a notice that was no longer there, so the noon account arrived to people with nothing in hand.',
                },
              },
            ],
          },
          {
            text: 'Wait for the noon review, then email everyone one note on what was found and who was affected',
            v: [
              {
                g: 'mistake',
                o: 'The note lands at 12:15 after a morning of rumours, and a quiet colleague’s name on it spreads through the office by lunch. Two more people had already clicked.',
                w: 'Silence leaves room for rumour and for more clicks, and naming people discourages the next one from speaking up. Brief everyone now and keep names out.',
              },
              {
                g: 'mistake',
                o: 'The note lands at 12:15 after a morning of rumours, and seven people have deleted the notice meanwhile. They are locked out at 5 PM and wait for you to clear it.',
                w: 'A morning of silence let rumours replace instructions, and people acted on the rumours. One early, plain message would have kept the notice in use.',
              },
            ],
          },
          {
            text: 'Ask the office manager to tell staff that IT is on it and to watch for anything odd until you report back',
            v: [
              {
                g: 'mistake',
                o: 'Staff nod and go back to work. A coworker who typed her password this morning does not connect “anything odd” with herself and says nothing.',
                w: 'A general watch-out gives anyone who clicked no step to take. People need to hear what to do if they already acted, and who to tell.',
              },
              {
                g: 'mistake',
                o: 'Staff nod and go back to work. Nobody knows whether to use the link, so about half the office leaves the change until 4:50 and the helpdesk queue fills.',
                w: 'A general “IT is on it” gives no instruction about the change that was due. People needed to hear what to do and by when.',
              },
            ],
          },
        ],
      },
      {
        text: 'Tell only the people most likely to have used the link, and keep the rest focused on work',
        ways: [
          {
            text: 'Tell the finance team and anyone the web filter shows reaching the page to come to you if they typed a password',
            v: [
              {
                g: 'mistake',
                o: 'Seven people hear it. Others who clicked on a phone or at home, and who do not work in finance, never learn there is anything to report.',
                w: 'You only know about people who show up in your logs or handle money. Anyone who clicked off the network is invisible to you and needs the same message.',
              },
              {
                g: 'mistake',
                o: 'Seven people hear it and a few worry for nothing. Everyone else gets no instruction about the change, and thirteen are caught out at 5 PM.',
                w: 'Only the people you could see got a message, and it was about a problem that was not there. The whole office needed the plain instruction.',
              },
            ],
          },
          {
            text: 'Message the people whose accounts show a sign-in from a new country or address since 9:05',
            v: [
              {
                g: 'mistake',
                o: 'You reach one person with an odd sign-in. The victims whose stolen sessions the attacker has not used yet show nothing and hear nothing.',
                w: 'A stolen password can sit unused for hours, so quiet accounts are not clean. Everyone who may have clicked needs the same message, not only those who already show signs.',
              },
              {
                g: 'mistake',
                o: 'No account shows a sign-in from anywhere new, so nobody is messaged and the office hears nothing from you. At 4:50 a queue forms for password changes.',
                w: 'Messaging only accounts with odd sign-ins reached nobody, and the office still needed an instruction. The notice was due, and silence from IT left people to guess.',
              },
            ],
          },
          {
            text: 'Tell the rest the email is handled and to carry on as normal, and give anyone who used the link their steps in private',
            v: [
              {
                g: 'blunder',
                o: 'The people who actually typed a password this morning are not the ones you singled out, so they hear only “carry on as normal” and say nothing.',
                w: 'Reassuring everyone else tells any silent victim that there is nothing to report, and you cannot see who the real victims are. The whole office needs the same plain warning.',
              },
              {
                g: 'blunder',
                o: 'Staff carry on as normal and ignore the notice. At 5 PM twenty-four accounts are locked out and you reset them until nine.',
                w: 'Telling people it was “handled” told them to skip the one step the notice required. The whole office needed to hear that the deadline was real.',
              },
            ],
          },
        ],
      },
    ],
  },
]
function build(v: 0 | 1): ScenarioDraft {
  return {
    id: 'starter-phishing',
    ...READABLE,
    flags: FLAGS[v].map((f) => ({ ...f })),
    decisions: DECISIONS.map((d) => ({
      prompt: d.prompt,
      approaches: d.approaches.map((a) => ({
        text: a.text,
        ways: a.ways.map((w) => {
          const x = w.v[v]
          return {
            text: w.text,
            grade: x.g,
            outcome: x.o,
            why: x.w,
            ...(x.raises ? { raises: x.raises } : {}),
            ...(x.ifRaised ? { ifRaised: x.ifRaised } : {}),
          }
        }),
      })),
    })),
    endings: { ...ENDINGS[v] },
  }
}

export const phishingVersion1: ScenarioDraft = build(1)

const draft: ScenarioDraft = build(0)
export default draft
