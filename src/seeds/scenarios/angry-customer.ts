import type { ScenarioDraft } from '../../features/play/types'

const draft: ScenarioDraft = {
  id: 'starter-angry-customer',
  title: 'Two days offline and billed twice',
  situation:
    'You work phone support at a small internet provider. A customer calls to say his service has been down two days and that he was charged twice this month.',
  setting:
    'You are a tier 1 phone agent at Brightline Broadband, a small regional internet provider. Marcus Hill works from home and has been offline for two days. At your desk you can see accounts and billing, run a remote line test, send a refresh to a modem, book technician visits and apply service credit. Billing handles refunds. Your team lead is on the floor. Calls are recorded.',
  flags: [
    { id: 'promised-visit-today', label: 'You promised a technician today before checking the schedule' },
  ],
  decisions: [
    {
      prompt:
        'Marcus is already talking when you pick up: two days offline, he works from home, a client meeting missed, and his bank shows this month\'s bill taken twice. Forty seconds in, he is still going.',
      approaches: [
        {
          text: 'Let him run to the end, then respond to the points he raised',
          ways: [
            {
              text: 'Open his account from caller ID as he talks; at his stop, name the missed meeting and double bill, then verify him',
              grade: 'best',
              outcome:
                'He runs out of steam after about a minute. Hearing the client meeting and the bill named back, he says, "Yes, that is it." He gives his details without being asked twice, and his account is already on your screen.',
              why: 'Naming his specifics, the meeting included, shows he was heard before you ask anything of him, and the account is open when he is ready. A process question can wait until he has been acknowledged.',
            },
            {
              text: 'Say little as he talks; at his stop, verify him first so everything is on screen, then name his two problems',
              grade: 'slip',
              outcome:
                'He stops and you ask for his details. "Is that all you have to say?" He gives them flatly, and you name his problems afterward. He softens within a minute, but your first words to him were a process question.',
              why: 'Verification is needed, but asked first it feels like a gate after forty seconds of being ignored. Naming what he said first costs ten seconds and changes how the rest of the call goes.',
            },
            {
              text: 'Take notes as he talks; at his stop, read back each date, time and amount so every fact is confirmed first',
              grade: 'mistake',
              outcome:
                'You read back eleven items. By the fifth he cuts in: "I just told you that." You have corrected one date, but his voice is up again and three minutes have gone before any action is taken.',
              why: 'A full read-back replays his worst two days to him and delays action. Name the problems and what they cost him; small details can be checked later, when the refund or the visit needs them.',
            },
          ],
        },
        {
          text: 'Use his talking time to pull up the account and get ready',
          ways: [
            {
              text: 'Refresh his modem remotely the moment you see the account, so something is already in motion when he finishes',
              grade: 'mistake',
              outcome:
                'The refresh goes out and nothing comes back: the modem is not reporting. When he stops, you have to tell him it was tried and failed, and he asks why you were doing that instead of listening.',
              why: 'A modem that has not reported for two days cannot take a refresh, so the action fixed nothing and pulled your attention from him. Read the account while he talks; act once you know what you are acting on.',
            },
            {
              text: 'Match caller ID to the account and read him the payment dates on file to show you are on it, before verifying him',
              grade: 'blunder',
              outcome:
                'He is glad to hear the dates and confirms them, and the call moves fast. Your team lead reviews calls that week and flags it: caller ID is not proof of who is on the line, and account detail went out before verification.',
              why: 'Caller ID shows which phone rang, not who is holding it. Account details go out only after verification, however upset the caller is; a quick answer to the wrong person cannot be taken back.',
            },
            {
              text: 'Tell him you cannot go on until he passes security, then take his verification answers over his talking',
              grade: 'blunder',
              outcome:
                '"Security? I have been offline for two days." He gives the answers through his teeth, then asks for a manager. The rest of the call runs through his anger at being processed.',
              why: 'Verification is needed, but a rigid demand during a complaint becomes the first obstacle he meets. It takes half a minute once he has been acknowledged, and he will hand over the answers freely.',
            },
          ],
        },
        {
          text: 'Step in early with a short apology so he knows someone has taken this on',
          ways: [
            {
              text: 'Apologize once and give the order: the connection first, then the double charge, then what he is owed',
              grade: 'slip',
              outcome:
                'He hears the plan, but he was not finished: the missed client meeting comes back twice more, louder each time. The plan holds, though, and by the end he is asking what you need from him.',
              why: 'A plan is a good thing to offer, but at the first gap he still has things to say, and the unsaid ones resurface. After he finishes, the same plan lands as relief, not as a brush-off.',
            },
            {
              text: 'Apologize and ask him to take it one problem at a time, starting with the connection, so nothing gets muddled',
              grade: 'mistake',
              outcome:
                '"One at a time? It is all one problem: I cannot work." He starts again with the connection, but now his anger is aimed at how you are handling him as well as at the outage.',
              why: 'Telling a caller how to organize his own grievance feels like managing him. You can set the order yourself, after he has been heard; he does not need to follow a structure to be helped.',
            },
            {
              text: 'Apologize and say a technician will be at his door today, because the first thing he needs is a fix',
              grade: 'blunder',
              raises: ['promised-visit-today'],
              outcome:
                'He says, "Good, today," and calms down. When you later open the dispatch schedule, the first window with space is tomorrow morning, so the promise has to be taken back after you gave it.',
              why: 'A visit time is set by the schedule and the crews, not by you. Promising before looking turns a delay into a broken promise, which costs more trust than the delay itself.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'Marcus asks when he will be back online. Your screen shows the area outage marked repaired yesterday evening, and the reports under it, his included, were closed with it.',
      approaches: [
        {
          text: 'Run a remote test on his line and decide the next step from the result',
          ways: [
            {
              text: 'Run the line test; with no signal, book the first slot he can take now and reopen his closed report',
              grade: 'best',
              outcome:
                'The test shows no signal. He takes the first slot, tomorrow morning, and you reopen his closed report, so the two days of outage sit in the record the technician will open. He asks if he must do anything; you say no.',
              why: 'A remote test gives the next step on facts, and booking while he is on the line secures the slot. Reopening his report keeps the first complaint, and its date, attached to the visit and to any credit.',
            },
            {
              text: 'Run the line test; with no signal, book the first slot he can take on this call under a new fault report',
              grade: 'slip',
              ifRaised: {
                flag: 'promised-visit-today',
                grade: 'mistake',
                outcome:
                  'The test shows no signal. He takes tomorrow morning, then says, "You told me today." The recording backs him, the new report holds no trace of that promise, and dispatch cannot move the slot.',
                why: 'Your promise of a visit today collided with the real schedule, and a fresh report holds no note of it. Reopening his closed report, with the promise logged there, would at least have kept the record straight.',
              },
              outcome:
                'Same test, same slot, tomorrow morning. The new report carries your notes but starts today, so the technician sees a fresh fault and one day of trouble, not two. Marcus will probably explain it again on his doorstep.',
              why: 'A new report restarts the history, and the notes are only as good as what you typed. Reopening the closed one keeps the original date and complaint attached for the technician and for credit.',
            },
            {
              text: 'Run the line test, then send a refresh to his modem and keep him on the line while you wait to see if it comes back',
              grade: 'mistake',
              outcome:
                'The refresh goes out and nothing answers. After eight minutes of waiting on the line you book a visit, and the next-morning windows have been taken. The earliest left is two days out.',
              why: 'A modem that is not reporting cannot receive a refresh, so the wait could only confirm what the line test already showed. Book while the slots exist, and treat a refresh as an extra, if at all.',
            },
          ],
        },
        {
          text: 'Follow the usual order: his equipment first, then the line, then a visit',
          ways: [
            {
              text: 'Ask which lights are on and what he has tried, then run the line test before deciding on a visit',
              grade: 'slip',
              outcome:
                'He lists the restarts, the swapped cable and the light that stays red. Eight minutes later you run the test the system could have run in one, and it shows no signal. You book the visit; he is tired but civil.',
              why: 'Asking about the lights was reasonable, but your own tools answer faster than his memory, and he has been offline two days. Test first, then ask questions only if the result leaves something open.',
            },
            {
              text: 'Talk him through a full power cycle and a cable check, and book the visit if it is still down afterward',
              grade: 'mistake',
              outcome:
                '"I did that the first night, and again yesterday." He does it a third time anyway. Twelve minutes on, nothing has changed, and he asks whether you are reading from a card.',
              why: 'After two days he has done the basics, and repeating them signals a script instead of his account. A modem showing no signal on your side after two days will not be fixed by anything he can do with a plug.',
            },
            {
              text: 'Have him factory-reset the modem to clear any settings fault, and book the visit if that fails',
              grade: 'blunder',
              outcome:
                'The reset wipes his Wi-Fi name, password and the work settings he set up. The modem still shows no signal. He now has no line and no setup, and rebuilding it will take longer than the fault did.',
              why: 'A reset cannot restore a signal that is not arriving, and it erases settings he cannot easily rebuild while offline. A destructive step needs evidence it will help, and nothing on your screen supplied it.',
            },
          ],
        },
        {
          text: 'Hand it to the network team, since his report was closed along with the outage',
          ways: [
            {
              text: 'Log it with the network team as an early closure, with full notes, and tell him they will call when they know more',
              grade: 'mistake',
              outcome:
                'He accepts it with a sigh. The team does not ring that day and no visit is booked. He calls again in the evening and quotes you: "They will call."',
              why: 'Escalating with notes is right for what you cannot fix, but he leaves with no time and no owner, and the visit you could have booked on this call is still unbooked. A follow-up needs a time you can commit to.',
            },
            {
              text: 'Ask the network team in chat whether his area was fully restored, and book him once they answer',
              grade: 'mistake',
              outcome:
                'Eleven minutes pass with Marcus on hold. The answer says the area was restored, which you had already seen, and says nothing of his own line. You then run the test and book him, at the end of a call that has run long.',
              why: 'The area outage being closed tells you nothing about his line, so the team\'s answer could not settle your next step. Your own test shows the state of his line within minutes, while he is on the call.',
            },
            {
              text: 'Transfer him to the network desk with a short note, so the people who closed the outage handle his line',
              grade: 'blunder',
              outcome:
                'The desk picks up having not read the note and asks for his account number and what happened. He tells it again, louder, then hears that the desk investigates faults and does not book visits.',
              why: 'A transfer sends him to a team that cannot book the visit, and a note is no substitute for a briefing. Hand over only what is outside your tools; your tools included the line test and the booking.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'Back to the double charge. Your billing screen shows this month\'s fee taken twice, three days apart, both posted.',
      approaches: [
        {
          text: 'File the refund request on this call and give him a reference to quote',
          ways: [
            {
              text: 'File as a duplicate payment with both dates, give him the reference, and say billing\'s window plus his bank\'s time',
              grade: 'best',
              outcome:
                'He writes the reference down and repeats it. You tell him billing\'s window is a rough guide, and that his bank can add a few days after the money goes out. He says he will check his statement once both have passed.',
              why: 'A reference and a rough window with his bank\'s time counted in mean a refund that lands late on his statement does not look like a broken promise. The duplicate label also sends the request to the right queue.',
            },
            {
              text: 'File as a duplicate with both dates, give him the reference and the day billing\'s window ends; he rings if nothing shows',
              grade: 'slip',
              outcome:
                'He marks the day. Billing sends the refund on schedule, but his bank shows it three days later. He rings as told, and the next agent explains the bank\'s delay and that nothing was missed.',
              why: 'That day counted only billing\'s part. Money leaves the provider and reaches his statement days apart, so telling him to chase on billing\'s date sends him after money still in transit.',
            },
            {
              text: 'File one request covering the duplicate and the outage, so billing sees the whole picture, and give him the reference',
              grade: 'mistake',
              outcome:
                'Billing sends it back asking which part is the refund and which the credit. You re-file the duplicate alone the next day, the reference you gave him no longer matches, and he rings to ask which number is live.',
              why: 'A duplicate refund returns money to his card; an outage credit adjusts his account. Filed as one request, the simple refund waits on the part billing has to question. Keep them as two requests.',
            },
          ],
        },
        {
          text: 'Confirm what happened with the payments before filing, so the request is accurate',
          ways: [
            {
              text: 'Check the history for a retry or manual payment first, then file with what you find in the note, naming no cause to him',
              grade: 'slip',
              outcome:
                'The history shows one payment through the portal and one by autopay. You file with that in the note and give him a reference. He asks if you are saying he paid twice, and you spend a minute saying no.',
              why: 'The note helped billing, but the search came before the filing and put the cause ahead of his money. The request does not depend on the cause; file first, then look, with the reference already in hand.',
            },
            {
              text: 'Ask whether he paid by hand as well as autopay, since that would explain two payments in one month',
              grade: 'mistake',
              outcome:
                'He bristles: "No, I have not touched it." The question sounded like blame to him, and the request is still unfiled while you recover the tone. Billing later finds a retry on their side.',
              why: 'The question put the burden on him and was not needed to file. Billing finds the cause from records you cannot see, and an angry customer hears a question about his own conduct as an accusation.',
            },
            {
              text: 'Ask him to read out his bank entries so you can match each one to your records before filing',
              grade: 'blunder',
              outcome:
                'He searches his phone\'s banking app on mobile data, reading out lines while you wait. Eight minutes in, the amounts match what you already had, and nothing is filed. His patience for the money part is gone.',
              why: 'Both payments were already on your screen as posted, so matching them to his bank added only work for him. Once you can see two posted payments, you have what billing needs.',
            },
          ],
        },
        {
          text: 'Give him a clear answer on how and when the money comes back',
          ways: [
            {
              text: 'Tell him the second charge will come off his next bill, and put a note on his account so it is not missed',
              grade: 'mistake',
              outcome:
                'He accepts it, though not warmly. The note sits on the account; billing never sees it, no refund is filed, and next month\'s bill arrives at full price. He calls again, quoting what you told him.',
              why: 'A note on the account is not a request, and a credit against next month is a repair you cannot choose for billing. The refund has to be filed so billing sees it, and it returns to the card that paid.',
            },
            {
              text: 'File the request and tell him it will be back on his card within three working days, so he can plan around it',
              grade: 'blunder',
              outcome:
                'He is relieved and says he will tell his bank to expect it. On day four nothing has arrived. The refund goes out on day six and shows on his card days after that, and he rings to complain about the date you gave.',
              why: 'The date was invented: only billing controls when a refund goes out, and the bank adds its own days after that. A firm date you do not control costs more trust than a rough window.',
            },
            {
              text: 'Suggest he dispute the second charge with his bank, since the bank can reverse it directly',
              grade: 'blunder',
              outcome:
                'He says he will call his bank tonight and starts a dispute. A request you could have filed in two minutes never goes in, and he is still waiting on the bank when next month\'s bill arrives.',
              why: 'A bank dispute is slower and more adversarial than a refund the provider files itself, and it hands over the one thing you could do on this call. Disputes are for when the provider does not act.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'Marcus has stopped talking over you. Before he hangs up he says: "Two days of nothing. Where does that leave me?" Whatever you have arranged so far, the call is nearly over.',
      approaches: [
        {
          text: 'Apply the credit for the days lost and book the callback now',
          ways: [
            {
              text: 'Credit the two days lost; book a ticket callback for after the repair is due, at a time he picks',
              grade: 'best',
              outcome:
                'You state the credit aloud and put the callback in the ticket with the time he chose. He repeats it back: "Fine. Someone gave me a time." The next agent who opens the ticket sees the credit, the repair and the call.',
              why: 'The credit covers the days actually lost, and the call is set for when there will be something to report, in a ticket queue that does not depend on your shift. Both of his questions get answers you control.',
            },
            {
              text: 'Credit the two days lost; book a ticket callback for the morning of the visit, at a time he picks',
              grade: 'slip',
              ifRaised: {
                flag: 'promised-visit-today',
                grade: 'mistake',
                outcome:
                  'He picks a time. When you say the call is to confirm the visit, he says, "You told me a technician today." The visit is tomorrow, and the call you booked is where he hears that again.',
                why: 'Your early promise of a visit today turned a call before the visit into a second hearing of the delay. A call timed to the repair would have had a real result to report.',
              },
              outcome:
                'He picks an early time and you note it. The call goes ahead on schedule, but the technician has not arrived, so all it can say is "still booked." He is polite and unimpressed.',
              why: 'A call before the work has nothing to report, and it spends the one callback he was promised. Time it to the repair instead, so the call can confirm the result.',
            },
            {
              text: 'Credit the two days lost, book the callback after the repair, and say each further day offline will be credited too',
              grade: 'mistake',
              outcome:
                'He likes it. The visit finds a second fault and the repair takes four more days. Nobody applies the extra credit, and when he sees it missing on his bill he quotes your promise to a team lead.',
              why: 'An open-ended promise commits credit for days you cannot see, with nobody assigned to apply it. Apply what is established now, and add days when the repair date is known and someone can apply them.',
            },
          ],
        },
        {
          text: 'Get the team lead\'s sign-off on the credit and the callback first',
          ways: [
            {
              text: 'Hold him while the team lead approves the credit and the callback, then give him both',
              grade: 'slip',
              outcome:
                'The team lead is on another call, and Marcus waits nine minutes. Then he hears the credit and a callback time confirmed. It works, but he spent ten more minutes on a call that was ending.',
              why: 'Everything he asked about sat within your authority, so escalating added a wait without adding a decision. Escalate when you reach your limit, not before.',
            },
            {
              text: 'Tell him the team lead will review his case and ring him tomorrow with a goodwill offer on top of the credit',
              grade: 'mistake',
              outcome:
                'He hangs up expecting something sizeable. The team lead rings the next afternoon with a small extra credit, and he feels let down, having heard "goodwill" the day before.',
              why: 'You committed someone else\'s time and an offer nobody had decided on. Promise what you can deliver yourself, and bring in the lead only when you hit your limit.',
            },
            {
              text: 'Tell him the team lead can approve a free month, so he should ask for that when they speak',
              grade: 'blunder',
              outcome:
                'He asks the team lead for a free month, as you suggested. The team lead declines, since policy allows only a few days. Marcus says you led him to expect it, and the call ends worse than it began.',
              why: 'Saying a supervisor can approve what you do not know they will invites a refusal and makes it look like your broken promise. Say only what you can do yourself.',
            },
          ],
        },
        {
          text: 'Work out the credit once the repair is done, so it covers the whole outage',
          ways: [
            {
              text: 'Tell him the full credit will be worked out once the repair closes, with a dated note on the ticket so it is applied',
              grade: 'mistake',
              outcome:
                'He says, "So nothing today?" and accepts it with a sigh. The note sits unopened; the repair closes and no one applies the credit. He is not told who will, and he rings again two days later.',
              why: 'He asked what he gets and heard "later." A note with no owner is not an arrangement. Apply what is established now, and ticket anything still to come with a named owner.',
            },
            {
              text: 'Say the credit and the callback will follow automatically once the technician closes the visit',
              grade: 'blunder',
              outcome:
                'He writes down the technician\'s name and expects the rest. Nothing is applied and no call is booked, because you assumed the system would. Two days later he rings again and the next agent finds nothing in the ticket.',
              why: 'Credits and callbacks happen only if someone applies and books them. Saying they will follow leaves them undone and spends his trust a second time.',
            },
            {
              text: 'Give him your direct line and promise to call him yourself once the repair is confirmed',
              grade: 'blunder',
              outcome:
                'He rings your line the next day and you are off shift. Whoever answers has no note of your promise, so he starts over, now angry that you vanished.',
              why: 'A personal promise depends on shifts, days off and notes nobody wrote. Put the follow-up in the ticket with a time and an owner; do not promise your own availability.',
            },
          ],
        },
      ],
    },
  ],
  endings: {
    good: 'Marcus leaves the call with a technician booked for tomorrow morning, a refund request filed under a reference he can quote, and a credit for the days lost. A callback is booked on the ticket, so whoever opens it next can see what he was promised and when. He is still unhappy about the outage, but nothing he was told has to be taken back.',
    ok: 'Marcus got some of what he called for, though not cleanly. At least one thing you said or did cost him time, trust or a follow-up call. Whether he stays with the provider may come down to how the next contact goes.',
    bad: 'Too much of the call went against Marcus for the parts that worked to carry it. More than one thing you said or did cost him time, trust or a follow-up call, and at least one cost him a lot. If he rings back, he starts that call with less patience than he had today.',
  },
}
export default draft
