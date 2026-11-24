import type { ScenarioDraft } from '../../features/play/types'

const draft: ScenarioDraft = {
  id: 'starter-phishing',
  title: 'A fake "password expires today" email hits the whole office',
  situation: 'A convincing "your password expires today" email reached all 30 of us, and a coworker says she entered her password.',
  setting:
    'You are the only IT person at a 30-person office on Microsoft 365, with global admin rights. The laptops run a web filter agent, managed from a console you rarely open, and the office has a firewall you adjust often. At 9:05 an email styled as IT, "Your password expires today", reached every inbox. At 9:20 Dana from accounting comes to your desk: she clicked, entered her password on a Microsoft-looking page and approved the phone prompt that followed. Nobody else has said anything yet.',
  flags: [
    { id: 'back-in-early', label: 'Dana was let back in before her account was swept' },
    { id: 'office-only-block', label: 'The link was blocked only on the office network' },
  ],
  decisions: [
    {
      prompt: 'It is 9:22. Dana is at your desk with her laptop open, and she has a payroll run to finish by noon. You have the admin console open in another window.',
      approaches: [
        {
          text: 'Lock her account and look into what happened before she gets it back',
          ways: [
            {
              text: 'Block her sign-in, then revoke her sessions and tokens; leave her password and methods as they are until you have looked',
              grade: 'best',
              outcome: 'By 9:26 she is blocked and the overseas session is dead; the log shows its next refresh failing. Her password and methods are untouched, ready for you to look at.',
              why: 'Stopping new sign-ins first, then ending live ones, shuts both doors. Leaving her settings alone keeps what the attacker added visible while you decide what to remove.',
            },
            {
              text: 'Block her sign-in, revoke her sessions and tokens, then reset her password and clear her sign-in methods straight away',
              grade: 'slip',
              outcome: 'The account is blocked, the session ends and the new password is set. Every method is gone, the attacker’s too, before anyone noted what was there; Dana must set up her phone again.',
              why: 'Safe, but out of order. With sign-in blocked and sessions revoked the attacker is already out, so clearing could wait; doing it now removed their method before it was recorded. Contain, record, remove.',
            },
            {
              text: 'Block her sign-in and stop there; a blocked account cannot be used, so the rest can wait until you have a free hour',
              grade: 'mistake',
              outcome: 'The block stops new sign-ins, but the attacker’s open session keeps reading Dana’s mail until its token expires, most of an hour. You still see it active in the log at 10:15.',
              why: 'Blocking sign-in stops new sessions but does not end ones already open. Revoking them is a separate step.',
            },
          ],
        },
        {
          text: 'Change what was stolen, her password and sessions, so she can keep working',
          ways: [
            {
              text: 'Reset her password, revoke her sessions and tokens, and let her sign in again on the new password right away',
              grade: 'slip',
              raises: ['back-in-early'],
              outcome: 'By 9:30 Dana is back at work on the new password and the overseas session drops. Nothing has been looked at yet for what the attacker added while inside.',
              why: 'A new password and ended sessions cut the attacker off, but handing the account back before any review leaves rules, extra methods or app access working under it.',
            },
            {
              text: 'Revoke all her sessions and tokens now, and force a password change at her next sign-in',
              grade: 'mistake',
              outcome: 'Her sessions end, but the stolen password stays valid until her next sign-in. At 9:50 the log shows the attacker back in on it with a method added earlier, and Dana’s own sign-in is refused.',
              why: 'Ending sessions does nothing about a stolen password that stays usable until it is replaced. Whoever signs in first is the one who sets the new one.',
            },
            {
              text: 'Reset her password, then have Dana sign out of every device she uses and sign back in',
              grade: 'mistake',
              outcome: 'Dana signs out of her laptop and phone and back in with the new password. The attacker’s browser, on another continent, is not one of her devices and stays signed in.',
              why: 'Signing out on her own devices cannot end a session on the attacker’s machine; only revoking it from the admin side does that.',
            },
          ],
        },
        {
          text: 'Treat it as a formal incident: preserve the evidence and call in specialists first',
          ways: [
            {
              text: 'Take her laptop off the network and image its disk for evidence, then turn to the account',
              grade: 'mistake',
              outcome: 'The image takes an hour. The laptop was clean, the attacker was never on it, and in that hour they went through Dana’s mail from their own machine.',
              why: 'She typed the password into a web page, so the thief holds the password and a session and nothing on the laptop. Imaging it does not touch the cloud account, where the attacker is.',
            },
            {
              text: 'Open a priority case with Microsoft support and hold all changes until their engineer has reviewed the account',
              grade: 'blunder',
              outcome: 'The first reply comes in the afternoon. By then the attacker has been in Dana’s mailbox for hours and a bank-details invoice has gone to a supplier.',
              why: 'Waiting for a vendor leaves a live intruder in the account for hours. Support can help later; stopping a stolen account is yours to do, in minutes.',
            },
            {
              text: 'Export her whole mailbox and every log you can reach for the record, and only then change anything on the account',
              grade: 'mistake',
              outcome: 'The export takes nearly an hour and the attacker’s session reads her mail the whole time. When you finally block the account, the logs you exported are the same ones the portal still holds.',
              why: 'Containment cannot wait for evidence gathering: the cloud keeps its sign-in and audit logs while you act, and each minute of delay is another minute for the attacker. Contain first, then collect.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'It is 9:40. The sign-in log shows a session from overseas that began eight minutes after Dana typed her password and ran for twenty minutes. Dana handles supplier payments, and the office manager asks what you can tell her.',
      approaches: [
        {
          text: 'Go through her account’s settings and clear out anything that is not hers',
          ways: [
            {
              text: 'Record her rules (hidden too), forwarding, delegates, sign-in methods and app consents, then remove what is not hers',
              grade: 'best',
              outcome: 'You find a rule sending invoice replies to RSS Feeds, a phone number the attacker registered, an app with mail access and an unknown delegate. All four are recorded, then removed.',
              why: 'Added methods, delegates and app consents are what bring an attacker back after a password change, and a hidden rule masks the damage. Recording first shows what they were hunting.',
            },
            {
              text: 'Review her rules, forwarding, delegates, sign-in methods, devices and Sent Items, deleting anything odd as you go',
              grade: 'slip',
              outcome: 'You delete a rule and a forwarding address and the account looks clean. An app consent and a hidden rule are still there, and nothing was kept of what you removed.',
              why: 'The list looks wide but misses hidden rules and app consents, and deleting on the fly leaves no record of what the attacker wanted. Look at everything and keep a copy before removing.',
              ifRaised: {
                flag: 'back-in-early',
                grade: 'mistake',
                outcome: 'Dana has been working in the account since 9:30. The app consent you did not see keeps the attacker’s access alive, and at 10:40 two more messages go out from her address.',
                why: 'Because her account was reopened before it was swept, the leftover access was live, and a sweep that missed an app consent let the attacker use it.',
              },
            },
            {
              text: 'Remove every rule, delegate, method and consent on the account at once, then rebuild what Dana needs with her',
              grade: 'mistake',
              outcome: 'The account is bare in minutes. You cannot tell which invoices the attacker was hiding replies to, and two of Dana’s real rules and a delegate for her manager must be rebuilt from memory.',
              why: 'Wholesale removal erases the record of what the attacker was targeting and takes legitimate settings out with the bad ones. Record first, then remove only items that are not hers.',
            },
          ],
        },
        {
          text: 'Work out what the attacker read and sent, since that decides who has to be told',
          ways: [
            {
              text: 'Search the audit log for what was read and sent from her account since 9:08, and list the outside recipients',
              grade: 'slip',
              outcome: 'You list nine outside recipients, but the log is an hour behind and the last minutes of the session are missing. Her sign-in methods and rules stay unexamined meanwhile.',
              why: 'Audit records can take an hour or more to appear, so this view is incomplete right now, and it shows impact more than the settings that keep the attacker in. Check settings first, read the log later.',
            },
            {
              text: 'Ask Dana to go through her Sent and Deleted Items and tell you what looks wrong, then act on what she finds',
              grade: 'mistake',
              outcome: 'Dana finds two odd sent messages and you deal with those. She cannot see hidden rules or sign-in methods, and that evening the attacker is back in through a method she never knew about.',
              why: 'Her mail folders show messages, not hidden rules, delegates, app consents or sign-in methods, and an attacker can delete the traces she would look for. The account’s settings show what was changed.',
            },
            {
              text: 'Run a content search for "invoice" and "bank" across all 30 mailboxes to see what the attacker may have targeted',
              grade: 'mistake',
              outcome: 'The search returns hundreds of results across the office and takes an afternoon to sort. You still do not know what was changed in Dana’s account or what was read.',
              why: 'A keyword search across everyone’s mail is slow and mostly noise. The account’s own settings and activity answer the question for a single account.',
            },
          ],
        },
        {
          text: 'Return her account to a known-good state and rebuild from there',
          ways: [
            {
              text: 'Restore her mailbox from last night’s backup so every change the attacker made disappears',
              grade: 'mistake',
              outcome: 'This morning’s mail is gone and the restore takes an hour. That evening the attacker is back in on a sign-in method they registered, which the mailbox restore never touched.',
              why: 'Sign-in methods and app consents live in the account, not the mailbox, so a restore cannot remove them. It also discards her legitimate mail from today.',
            },
            {
              text: 'Delete Dana’s account and create a new one, so nothing the attacker built can carry over',
              grade: 'blunder',
              outcome: 'Her mailbox and files vanish until you restore them, and documents she owned lose their owner. You have also lost the trail you needed.',
              why: 'Rebuilding the account destroys her data and the evidence, when a short list of settings had to be checked.',
            },
            {
              text: 'Empty her mailbox of all mail and folders so nothing the attacker saw or planted remains',
              grade: 'blunder',
              outcome: 'Years of Dana’s accounting mail are gone, including messages the office may need for its records. The attacker’s rules and methods are still in place.',
              why: 'Emptying the mailbox destroys business records and does nothing about settings or sign-in methods, which is where the attacker’s access lives.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'It is 9:55. The email is still in most of the 30 inboxes and people are asking each other in the hallway whether it is real.',
      approaches: [
        {
          text: 'Remove the email and block the link first, then look for who clicked',
          ways: [
            {
              text: 'Block the domain in the laptops’ web filter agent, then purge the message from all 30 mailboxes, keeping a copy',
              grade: 'best',
              outcome: 'The domain stops loading on every laptop, in the office or at home, and the message is gone from all 30 inboxes by 10:05. Your saved copy has the full headers.',
              why: 'Blocking where the device is covers people anywhere, and removing the message ends new clicks. The saved copy gives you what you need to report it.',
            },
            {
              text: 'Block the link’s domain on the office firewall, then purge the message from all 30 mailboxes, keeping a copy',
              grade: 'slip',
              raises: ['office-only-block'],
              outcome: 'The message is gone by 10:05 and the office firewall blocks the domain. Anyone off the office network, on a laptop at home or a phone, can still load the page.',
              why: 'A firewall only sees traffic passing through the office. The filter agent on the laptops follows people home, so that is where the domain has to be blocked.',
            },
            {
              text: 'Add a mail rule rejecting "password expires" and purge every message with that wording from all 30 mailboxes',
              grade: 'mistake',
              outcome: 'The rule later catches a real notice from your accounting software and a vendor’s invoice reminder, while the link itself still loads for anyone who has a copy.',
              why: 'A keyword rule catches genuine mail and does nothing about the link. Match on the link’s domain and the sender, not on common wording.',
            },
          ],
        },
        {
          text: 'Find out who has already entered a password first, so you know the real scale',
          ways: [
            {
              text: 'Search all 30 sign-in logs for the attacker’s address and new-country sign-ins since 9:05, then act on each hit',
              grade: 'slip',
              outcome: 'You find one more account with an odd sign-in, a good catch, and reset it by 10:20. But the message sat live for half an hour more and two more people clicked.',
              why: 'Hunting for victims is worthwhile, but it takes longer than blocking and removing, and every minute the page stays reachable adds clicks. Block first, hunt right after.',
            },
            {
              text: 'Check the office firewall logs for visits to the link and speak to each person who reached it, then clear the message',
              grade: 'mistake',
              outcome: 'The logs show four visits from inside the office. The people who opened it on a phone or from home do not appear, and one of them has already entered a password.',
              why: 'Firewall logs only see traffic through the office, so they miss phones and people at home. Sign-in logs and a block on the devices cover them.',
            },
            {
              text: 'Ask everyone to reply if they clicked and handle the replies as they arrive, leaving the message up meanwhile',
              grade: 'mistake',
              outcome: 'Six people reply that they did nothing. By 10:45 two more have typed their passwords into the page, and neither replies.',
              why: 'People who entered a password often do not say so, and every minute the message stays up adds another click. Remove the bait first, then ask.',
            },
          ],
        },
        {
          text: 'Treat all 30 accounts as exposed and lock down the whole office until you know more',
          ways: [
            {
              text: 'Revoke all sessions and force a password reset for all 30 accounts, then remove the message once everyone is back in',
              grade: 'mistake',
              outcome: 'At 10:05 thirty people hit a sign-in wall and call you at once. The message is still in their inboxes and the link works, and two of them open it again.',
              why: 'Most accounts show no sign of compromise, and resetting them while the link is live invites repeat clicks. Remove the bait first and reset only accounts with signs.',
            },
            {
              text: 'Disable all 30 accounts until you have cleared each person one by one and confirmed what they entered',
              grade: 'blunder',
              outcome: 'The office stops. Clients cannot reach anyone, and clearing 30 people takes the afternoon while the link still works for anyone off the network.',
              why: 'Shutting down the whole office costs more than the attack did, and it removes neither the message nor the link. Contain the bait first, then clear accounts by evidence.',
            },
            {
              text: 'Turn off incoming email for all 30 mailboxes until the cleanup of the message and the link is finished',
              grade: 'mistake',
              outcome: 'No new mail arrives, but the phish is still in everyone’s inbox. Two clients call to ask why their messages bounce.',
              why: 'Stopping incoming mail leaves the message already delivered where it is and blocks real business mail as well.',
            },
          ],
        },
      ],
    },
    {
      prompt: 'It is 10:30. The office manager asks what to tell staff, and you still have the sign-in logs for all 30 accounts to go through.',
      approaches: [
        {
          text: 'Brief the whole office now, with what is known so far, gaps included',
          ways: [
            {
              text: 'Say in person and in chat what the email looked like, to report even a click, and that you will reset anyone affected',
              grade: 'best',
              outcome: 'Four more people come to your desk within the hour, two of whom typed passwords. You reset and revoke each in minutes, and nobody is left hunting for a reset page.',
              why: 'A spoken note plus a chat message reaches everyone at once and makes reporting safe. Doing the resets yourself also revokes sessions and checks methods, which a change they make alone does not.',
            },
            {
              text: 'Say in person and in chat what the email looked like, to report any click, and to change any password typed',
              grade: 'slip',
              outcome: 'Most people read the note and a few change passwords on their own. Their stolen sessions are never revoked, and others hunt for where to change theirs and try the first "IT" link they find.',
              why: 'A password change made alone does not end a stolen session, and telling people to do it sends them looking for a page an attacker can copy. You do the resets, so sessions are revoked.',
              ifRaised: {
                flag: 'office-only-block',
                grade: 'mistake',
                outcome: 'At 11:15 a colleague working from home reopens the page from her browser history on her laptop; the link still loads for her and she enters her password. Your note told her to fix it herself, so she never comes to you.',
                why: 'Because the link was blocked only at the office firewall, it still worked off the network, and a note telling people to fix it themselves left her unreported.',
              },
            },
            {
              text: 'Tell everyone in the chat that Dana’s account was taken over and what the attacker did, so they grasp how serious it is',
              grade: 'mistake',
              outcome: 'People grasp the stakes, but Dana is mortified, and two colleagues say they would rather not mention a click after seeing what happened to her. One who typed a password stays silent.',
              why: 'Naming a victim makes others fear the same exposure and hide their clicks. Describe the scam, not who it caught, and make coming forward safe.',
            },
          ],
        },
        {
          text: 'Wait for the sign-in review and give the whole office one accurate account',
          ways: [
            {
              text: 'Tell staff only what is confirmed now, that the email is fake and you are checking, and give the full account at noon',
              grade: 'slip',
              outcome: 'Staff avoid the email and wait for noon. Nobody who typed a password has been asked to come to you, so two of them say nothing until the afternoon.',
              why: 'A short true message is a sound start, but leaving out the request to report a click lets people who entered a password sit quietly for hours. Say what to do now, not just what to avoid.',
            },
            {
              text: 'Wait for the noon sign-in review, then email everyone one note naming each affected person and what was taken',
              grade: 'mistake',
              outcome: 'The note lands at 12:15 after a morning of rumours, and a quiet colleague’s name on it spreads through the office by lunch. Two more people had already clicked.',
              why: 'Silence leaves room for rumour and for more clicks, and naming people discourages the next one from speaking up. Brief everyone now and keep names out.',
            },
            {
              text: 'Ask the office manager to tell staff that IT is on it and to watch for anything odd until you report back',
              grade: 'mistake',
              outcome: 'Staff nod and go back to work. A coworker who typed her password this morning does not connect "anything odd" with herself and says nothing.',
              why: 'A general watch-out gives anyone who clicked no step to take. People need to hear what to do if they already acted, and who to tell.',
            },
          ],
        },
        {
          text: 'Tell only the people most likely to have clicked, and keep the rest focused on work',
          ways: [
            {
              text: 'Tell the finance team and anyone the web filter shows reaching the page to come to you if they typed a password',
              grade: 'mistake',
              outcome: 'Seven people hear it. Others who clicked on a phone or at home, and who do not work in finance, never learn there is anything to report.',
              why: 'You only know about people who show up in your logs or handle money. Anyone who clicked off the network is invisible to you and needs the same message.',
            },
            {
              text: 'Message the people whose accounts show a sign-in from a new country or address since 9:05',
              grade: 'mistake',
              outcome: 'You reach one person with an odd sign-in. The victims whose stolen sessions the attacker has not used yet show nothing and hear nothing.',
              why: 'A stolen password can sit unused for hours, so quiet accounts are not clean. Everyone who may have clicked needs the same message, not only those who already show signs.',
            },
            {
              text: 'Tell the rest the email is handled and to carry on as normal, and give likely victims their steps in private',
              grade: 'blunder',
              outcome: 'The people who actually typed a password this morning are not the ones you singled out, so they hear only "carry on as normal" and say nothing.',
              why: 'Reassuring everyone else tells any silent victim that there is nothing to report, and you cannot see who the real victims are. The whole office needs the same plain warning.',
            },
          ],
        },
      ],
    },
  ],
  endings: {
    good: 'Dana’s account was blocked, swept and handed back in the afternoon with her rules, methods and app access checked. The link was blocked on every laptop and the message purged, and the staff who had clicked came to you before lunch and were reset, with no money lost and nobody named.',
    ok: 'The worst was contained and nobody lost money, but one gap stayed open for a while: a leftover sign-in method, a link that still worked off the office network, or a silent case that surfaced later. You close it by evening, and some staff trust you a little less than before.',
    bad: 'The attacker kept a way back in, the link kept working for people off the office network, or those who clicked stayed silent. By the end of the week a fake invoice has gone to a client from Dana’s address, and you spend the next days cleaning up after the fact.',
  },
}
export default draft
