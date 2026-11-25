import type { ScenarioDraft } from '../../features/play/types'

const draft: ScenarioDraft = {
  id: 'starter-wifi-deadline',
  title: 'An hour before the essay is due, pages stop loading on the laptop',
  situation: 'My laptop shows Wi-Fi connected but loads nothing, an hour before my essay is due on the course portal.',
  setting:
    "It's 10:58 PM. Your essay is due at midnight on the course portal. Your Windows laptop says Wi-Fi is connected but nothing loads; the same thing happened for a few minutes on Tuesday. Your Android phone is on the desk at 21 percent, with full cell service. The portal texts a login code to your phone. The essay is saved, but two citations are still unformatted and the rubric grades citation style.",
  flags: [{ id: 'hotspot-on-battery', label: "You ran the hotspot on the phone's battery" }],
  decisions: [
    {
      prompt:
        'The Wi-Fi icon says connected, but no page will load. It is 10:58 PM, and the portal will text a login code to your phone. What do you do first?',
      approaches: [
        {
          text: 'Find out what is wrong with the Wi-Fi first',
          ways: [
            {
              text: 'Check whether other devices on the same Wi-Fi can reach the internet',
              grade: 'slip',
              outcome:
                "Your housemate's laptop loads pages fine on the same Wi-Fi, so the fault sits on your laptop. That took six minutes, and you turn to the phone at 11:04.",
              why: 'A useful clue, but under a deadline the cause matters less than a working route to the portal. It cost minutes and did not get you any closer to submitting.',
            },
            {
              text: 'Unplug the router for thirty seconds, plug it back in and wait for the lights',
              grade: 'mistake',
              outcome:
                'The router takes five minutes to restart and drops everyone else in the house offline. The laptop still says no internet, and at 11:08 you give in and use the phone.',
              why: 'A router restart is a guess about the wrong device. It costs everyone five minutes of connection and does nothing for a fault that sits on the laptop.',
            },
            {
              text: "Call the internet provider's support line to ask about an outage in your area",
              grade: 'blunder',
              outcome:
                'You wait eleven minutes in the queue. The agent reports no outage and offers a technician visit on Thursday. You hang up at 11:12 and tether to your phone instead.',
              why: 'A provider cannot fix a fault on your laptop, and hold times eat the hour. The one device with a working link was in your hand the whole time.',
            },
          ],
        },
        {
          text: "Reset the laptop's network connection",
          ways: [
            {
              text: 'Turn Wi-Fi off and on, then run the Windows network troubleshooter and apply its fix',
              grade: 'mistake',
              outcome:
                'The troubleshooter runs for four minutes, resets the adapter and reports that it could not identify the problem. The icon still says connected with no internet, and at 11:04 you reach for the phone.',
              why: 'Toggling and troubleshooters are routine, but a fault that survives them costs minutes with no answer. Under a deadline, going around a fault beats diagnosing it.',
            },
            {
              text: 'Open Command Prompt as administrator and run ipconfig /release, then ipconfig /renew',
              grade: 'mistake',
              outcome:
                'The release works, but the renew hangs for a minute and then fails to reach the router. The laptop now has no network address at all, and at 11:07 you reach for the phone.',
              why: 'Releasing and renewing an address helps only when the lease was the fault. When it was not, it leaves the laptop with less than it started with.',
            },
            {
              text: 'Run Windows network reset, which clears saved networks and restarts the laptop',
              grade: 'blunder',
              outcome:
                'A countdown restarts the laptop. Every saved Wi-Fi network and any VPN profile is gone, and the portal still will not load. At 11:14 you tether to the phone.',
              why: 'Network reset wipes every saved network and adapter setting and forces a restart. It is a last resort that leaves more to rebuild than any quicker route online.',
            },
          ],
        },
        {
          text: 'Get the laptop online through your phone',
          ways: [
            {
              text: 'Plug the phone into the laptop with its charging cable and turn on USB tethering',
              grade: 'mistake',
              outcome:
                'The laptop shows a new wired network, but pages will not load: the USB network driver Windows installed at 10:31 is waiting for a restart. You find the notice at 11:07, restart, and the portal loads at 11:11.',
              why: 'Windows had installed a driver that needs a restart before it works, and the laptop said so. A cable cannot help while the driver waits. Read what the laptop is already telling you before you plug anything in.',
            },
            {
              text: "Turn on the phone's Wi-Fi hotspot and join it from the network list in the laptop's menu",
              grade: 'slip',
              outcome:
                'The hotspot shows up after one retry and the portal loads at 11:02. Running on battery, the phone slides from 21 to 14 percent over the next twenty minutes.',
              why: 'It works, but joining over Wi-Fi leans on the adapter that just misbehaved and drains a phone you still need for login codes. A cable would have powered the phone instead.',
              raises: ['hotspot-on-battery'],
            },
            {
              text: 'Plug the phone in, turn on USB tethering, then restart the laptop so Windows sets up the network cleanly',
              grade: 'best',
              outcome:
                'The restart takes two minutes and Windows finishes the driver update on the way up. The wired network comes up with internet; you switch tethering back on, as the reset turned it off, and the portal loads at 11:03.',
              why: 'Tonight’s update left a restart pending for the USB network driver, so tethering could not work until it ran. Restarting with the cable already in fixed that in one go, and the phone kept charging.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'About 11:15 PM. You are online, but the link has dropped twice in the last ten minutes. The essay is saved, two citations are still raw (you reckon five minutes of work), and the only copy is on this laptop. What now?',
      approaches: [
        {
          text: 'Get a first version into the portal now',
          ways: [
            {
              text: 'Upload the file as it stands, then format the citations and upload the finished file over it',
              grade: 'mistake',
              outcome:
                'The first upload starts at 11:17 and creeps. You finish the citations by 11:24 and start the finished file as a second upload. Both crawl on the one weak link, and neither has confirmed by 11:41.',
              why: 'Two uploads share one weak link, so the finished file waits behind the raw one. Five minutes of formatting first would have left a single upload carrying the right file.',
            },
            {
              text: 'Upload the file as it stands, then format the citations only if the connection looks steady',
              grade: 'mistake',
              outcome:
                'The upload stalls twice and you watch it until 11:30. When you open the citations the link has dropped again, and whatever lands in the portal will carry raw citations.',
              why: 'A weak link does not turn steady on a crawling portal, and the citations are graded. The five minutes were available right then, and they went on watching a progress bar.',
            },
            {
              text: 'Upload the file as it stands and email your instructor the two corrected citations to add',
              grade: 'blunder',
              outcome:
                'The upload stalls and never confirms. Your email promises citation fixes after the deadline, so the only thing on record is an unfinished essay and a plan to change it late.',
              why: 'Offering to edit later invites a late-work judgment, and the email carries no usable copy. It is a promise made before anything was actually submitted.',
            },
          ],
        },
        {
          text: 'Polish the whole essay before submitting',
          ways: [
            {
              text: 'Format the citations, then proofread the whole essay once before uploading',
              grade: 'mistake',
              outcome:
                'The read-through catches three typos and takes twenty minutes. You start the upload at 11:40, just as the portal begins to slow, and the only copy is still on this laptop.',
              why: 'Proofreading is worth doing, but it spent the clean window before the first upload attempt. On a link that keeps dropping, submitting early mattered more than three typos.',
            },
            {
              text: "Tighten the weakest paragraph's argument first, then format the citations and upload",
              grade: 'mistake',
              outcome:
                'The paragraph improves but takes twenty minutes, and the citations get done in a hurry with a stray period out of place. You start the upload at 11:41.',
              why: 'Content rework is what eats an hour, and the risk tonight is the connection, not the argument. Time spent here was time not spent getting the work submitted.',
            },
            {
              text: 'Rewrite the conclusion to land a stronger final point, then format and upload',
              grade: 'blunder',
              outcome:
                'The new conclusion takes twenty-five minutes and no longer matches the introduction. At 11:41 you are still hurrying through the citations, with nothing uploaded.',
              why: 'A rewrite at this hour trades a sure deadline problem for a small chance of improvement, and leaves both the formatting and the submission undone.',
            },
          ],
        },
        {
          text: 'Finish the two graded citations, then submit',
          ways: [
            {
              text: 'Format the two citations, save, start the upload, and email the file to yourself while it runs',
              grade: 'best',
              outcome:
                'The upload starts at 11:21 and the email goes out within a minute, so a copy now sits off the laptop. By 11:41 the bar has crept to 40 percent.',
              why: 'The upload is the long, failure-prone step on a weak link, so it starts first and the quick email rides along. That gets the file moving earliest and still moves a copy off the laptop.',
            },
            {
              text: 'Format the two citations, save, email the file to yourself, then start the upload',
              grade: 'slip',
              outcome:
                'The email arrives at 11:20 and the upload starts at 11:23. Nothing goes wrong, and by 11:41 the bar has reached 25 percent.',
              why: 'Sound, but the backup ran ahead of the long step. Starting the upload first and emailing while it runs gets the file moving earlier on a link that keeps dropping.',
            },
            {
              text: 'Format the two citations, then recheck every other reference against the style guide before saving and uploading',
              grade: 'mistake',
              outcome:
                'The reference check takes seventeen minutes and you change two entries that were already correct. You start the upload at 11:38, and the bar has barely moved by 11:42.',
              why: 'Only the two raw citations are in scope. Rechecking the rest feels thorough, but it spends the window on work nobody needed and can alter entries that were right.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        "At 11:42 the portal slows to a crawl: pages time out and uploads stall on 'Submitting…'. Whatever you have tried so far, you have no confirmed submission yet. Eighteen minutes left. What do you do?",
      approaches: [
        {
          text: 'Stay on the portal and use email only as a fallback',
          ways: [
            {
              text: 'Retry in a private window or a second browser, and email the instructor at 11:52 if it still fails',
              grade: 'slip',
              outcome:
                'A private window loads the submit page faster. The upload is still spinning at 11:52, so you send the email you planned, essay attached, eight minutes before the deadline.',
              why: 'The retry was sound and the email still beat the deadline, but you left ten minutes with no copy on record. Sending the same email at 11:44 cost nothing and removed that exposure.',
            },
            {
              text: 'Cancel the stalled upload and start a new one every two minutes until one goes through',
              grade: 'mistake',
              outcome:
                'Each restart wipes the progress bar. At 11:50 you have restarted five times, the portal lists several half-finished attempts, and you are no closer.',
              why: 'Restarting on a timer discards whatever progress the stalled upload had and can leave duplicate partial attempts. Repeating the same step changes nothing and puts no copy on record.',
            },
            {
              text: 'Log out of the portal and back in to clear whatever has hung, then retry the upload',
              grade: 'blunder',
              outcome:
                'The login page takes four minutes to load, and the first texted code has expired by the time you type it. You are back at the submit page at 11:53 with the upload to start again.',
              why: 'Signing out on a struggling portal needs a fresh texted code and a slow login page, all before you can retry. It spends the remaining time rebuilding a session that was not the problem.',
            },
          ],
        },
        {
          text: 'Ask the instructor how they want the work handed in',
          ways: [
            {
              text: 'Email the instructor that the portal is stalling and ask whether you may send the essay by email',
              grade: 'mistake',
              outcome:
                'The email goes at 11:45 with no essay attached. There is no reply by midnight, so nothing on record shows when the work existed, and the portal is still stalling.',
              why: 'Asking first, with nothing attached, leaves the decision with someone who may be asleep. A copy on record before midnight beats a request for permission.',
            },
            {
              text: 'Message classmates asking whether their uploads are stuck, and tell the instructor if several are',
              grade: 'mistake',
              outcome:
                'By 11:52 three classmates reply that theirs stall as well. It is reassuring, but it does nothing to get yours in, and the email to the instructor never gets written.',
              why: 'Hearing that others struggle feels like cover but creates no record of your own work. The thing that helps is a copy in the instructor’s inbox before midnight, not company.',
            },
            {
              text: 'Call the IT help desk number on the portal page and ask them to submit it for you',
              grade: 'blunder',
              outcome:
                'The help desk line plays an after-hours menu and nobody can submit on your behalf. You hang up at 11:52 with nothing sent.',
              why: 'Help desks cannot submit your work for you, and late at night the line is often unstaffed. The call spent useful minutes where nothing could happen.',
            },
          ],
        },
        {
          text: 'Send the instructor the essay by email now, and keep trying the portal',
          ways: [
            {
              text: 'From your school email, attach the essay, say what the portal is doing, and say you are still retrying',
              grade: 'best',
              outcome:
                'The email reaches the instructor at 11:44 with the essay attached and a timestamp. You go back to the portal knowing a copy is on record if it fails.',
              why: 'A timestamped attachment sent before the deadline is a fixed copy of the work, from an address the school knows, stated as fact rather than as a request.',
            },
            {
              text: 'From your school email, attach the essay, say what the portal is doing, and ask if email is acceptable',
              grade: 'slip',
              outcome:
                'The email lands at 11:44 with the essay attached. There is no reply before midnight, so the question hangs, but the attachment still shows when the work existed.',
              why: 'The attachment does the work, but asking permission turns a record into a request that needs an answer you will not get by midnight. Report what happened and let the instructor decide.',
            },
            {
              text: 'From your school email, link the file in your cloud drive, say what the portal is doing, and say you are still retrying',
              grade: 'mistake',
              outcome:
                "The link opens a document your cloud drive keeps syncing. Your later edits change it, and its modified time reads 12:07 AM. The email proves little about what existed at 11:44.",
              why: 'A link points at a file that can still change, so it records nothing about what existed when you sent it. An attachment is a fixed copy, and sharing settings can also block the reader.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'At 11:55 PM the upload bar finally reaches 100% and the page reloads showing your file. Five minutes left. What do you do?',
      approaches: [
        {
          text: 'Wrap up and tell your instructor about the upload',
          ways: [
            {
              text: 'Email the instructor that you uploaded the essay and ask them to confirm they can see it',
              grade: 'mistake',
              outcome:
                'The email goes at 11:56 saying it went through. By morning the portal still lists the file as a draft, so what you told the instructor was not true.',
              why: 'Telling the instructor it went through before reading the status put an unverified claim on record. Confirmation from them can wait, and the portal can be read at once.',
            },
            {
              text: "Post in the class chat that you have submitted and ask whether others see the same page",
              grade: 'mistake',
              outcome:
                'Two classmates say their pages look the same and wish you luck. Nobody reads the status label, and at midnight yours is still a draft.',
              why: 'Classmates seeing the same page does not tell you that yours is submitted. Social reassurance is not a record, and the five minutes went on a conversation.',
            },
            {
              text: "Shut the laptop and turn off the phone's connection sharing, since the bar hit 100 percent",
              grade: 'blunder',
              outcome:
                'You shut everything at 11:56. At midnight the file is only a draft, and with the connection off you could not even check or press anything until morning.',
              why: 'A full progress bar is not a submission, and switching off the connection removed any chance to find that out. It threw away the last five minutes and the means to act in them.',
            },
          ],
        },
        {
          text: "Check what the portal says about your submission",
          ways: [
            {
              text: 'Read the status under your file, press Submit if it says draft, then screenshot it with the time',
              grade: 'best',
              outcome:
                "The status reads 'Draft – not submitted'. You press Submit, and at 11:57 it changes to 'Submitted' with the time beside it. Your screenshot shows the status, the time and the file name.",
              why: 'An upload finishing is not a submission; the portal’s status is the record that counts. Reading it first, acting on it and capturing it with the time gives you proof.',
            },
            {
              text: 'Press the Submit button under your file, then shut the laptop as soon as the page has reloaded',
              grade: 'slip',
              outcome:
                "The page reloads at 11:56 and you shut the laptop. The submission registered, but you have no screenshot, receipt or timestamp that you can show anyone.",
              why: 'It submitted the work, but you never read the status afterwards and kept no proof. If anyone ever disputes the time, you have only your own word.',
              ifRaised: {
                flag: 'hotspot-on-battery',
                grade: 'blunder',
                outcome:
                  "At 11:57 the phone, which has run the hotspot on battery since 10:58, shuts off just as you press Submit. The page hangs, the laptop loses its link, and at midnight you cannot tell if it registered.",
                why: 'Running the hotspot on battery at the start drained the phone, and the missing proof now mattered: with no link and no screenshot you could not confirm anything.',
              },
            },
            {
              text: 'See your file name and size listed on the page, then close the tab',
              grade: 'mistake',
              outcome:
                "The name and size are listed, so you close the laptop at 11:56. At midnight the status under it still reads 'Draft', which the portal does not count as submitted.",
              why: 'A listed file shows an upload, not a submission; some portals show both the file and a draft label. The status field is the thing to read, and it was never looked at.',
            },
          ],
        },
        {
          text: 'Use the last minutes to check the essay itself',
          ways: [
            {
              text: "Skim the file's preview in the portal to confirm every page came through",
              grade: 'slip',
              outcome:
                "All pages are there. At 11:58 you notice the page label above your file reads 'Draft', press Submit at 11:59, and it goes through with a minute to spare.",
              why: 'The pages were fine, but checking contents before status burned three of your five minutes and nearly missed the one step that actually submits the work.',
            },
            {
              text: 'Download the file back and read it through from the first page to the last',
              grade: 'mistake',
              outcome:
                "The read-through takes until 11:59 and finds nothing. The page still shows your file as a draft at midnight, and the portal does not count a draft as a submission.",
              why: 'Reading the file confirms the content, not the submission. Some portals hold an upload as a draft until a final submit step, and the deadline passed with that step undone.',
            },
            {
              text: 'Spot-fix the one typo you remember and upload the file again at once',
              grade: 'blunder',
              outcome:
                "The second upload stalls on 'Submitting…' at 11:58 and replaces the first attempt. At midnight the page holds only a half-finished attempt.",
              why: 'A new upload can replace the earlier attempt and carries its own later timestamp. Starting it with five minutes left on a crawling portal risked the file already uploaded.',
            },
          ],
        },
      ],
    },
  ],
  endings: {
    good: 'You got around the dead connection, a copy of the essay left the laptop by email while the upload ran or just before it, and your instructor had the essay in their inbox before midnight. The portal recorded your submission before the deadline.',
    ok: 'At least one step cost minutes, battery, a backup, your word with the instructor or the submission itself. Whether the essay counts comes down to what the portal showed at midnight, and the night ran closer to that line than it needed to.',
    bad: 'Too much of the hour went to the wrong things. More than one step cost minutes, battery, a backup, your word with the instructor or the submission itself, and at least one cost a lot. Whatever the portal showed at midnight, the hour you had at 10:58 was gone long before it.',
  },
}
export default draft
