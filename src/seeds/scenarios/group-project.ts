import type { ScenarioDraft } from '../../features/play/types'

const draft: ScenarioDraft = {
  id: 'starter-group-project',
  title: 'A teammate has not replied in a week before the group presentation',
  situation:
    "Our group of four presents on Monday, and Dana, who agreed to write a quarter of the talk, hasn't answered anyone in a week.",
  setting:
    'It is Wednesday morning in an upper-level course. Your group of four presents Monday at 10:00. Last Wednesday Dana said in the group chat she would draft the methods and results section, about a quarter of the talk, by the weekend. Nothing has arrived, the shared doc shows no edits from her, and she has not answered anyone since. So far everyone has written only in the group chat. A peer evaluation follows the presentation. You made the shared folder; Priya and Marcus are waiting to see what you do.',
  flags: [
    { id: 'chat-only-ask', label: 'Your only ask to Dana was a group-chat post' },
    { id: 'told-late', label: 'Dana learned of the plan after it was set' },
  ],
  decisions: [
    {
      prompt:
        "Wednesday, 9 a.m. Dana's section is still empty, and Priya and Marcus ask in the chat what you plan to do first. What is your first move?",
      approaches: [
        {
          text: 'Write to Dana yourself, one to one, today',
          ways: [
            {
              text: 'Ask her privately for whatever exists, notes and raw output included, by Thursday evening, else plan without her',
              grade: 'best',
              outcome:
                'Dana does not reply that day, but your message sits in her private thread with a small ask and a time. Priya and Marcus can see you have moved, and the group knows when it will have to plan without her.',
              why: 'Unfinished work is easy to send and lets others build on it, while a request for a polished draft invites more delay. A near time and a stated next step make silence count as an answer.',
            },
            {
              text: 'Ask her privately for the finished draft by Friday noon, and say you will cover it yourselves if nothing comes in',
              grade: 'slip',
              outcome:
                'Dana does not answer. Friday noon leaves two days to write, check and rehearse, and the group has only a promise of a finished section to work from.',
              why: 'Same private channel and a fallback, but a finished draft is a high bar for someone who is stuck, and Friday noon is too late to recover. Rough material by Thursday evening is easier to send and use.',
            },
            {
              text: 'Tell her privately that the group will take the section, so she can deal with whatever is going on',
              grade: 'mistake',
              outcome:
                'Dana still does not reply, but now she holds a written release. Priya and Marcus ask whether the group has just agreed to do her share, and you cannot say yes or no.',
              why: 'Taking the load off her was kind, but it promised work the others had not agreed to and removed any reason to answer. An ask with a time keeps the decision open.',
            },
          ],
        },
        {
          text: 'Raise it with all of you together in the group chat',
          ways: [
            {
              text: 'Ask all four of you to post where your section stands by tonight, with the doc link',
              grade: 'slip',
              outcome:
                'Priya and Marcus answer within the hour. Dana does not, and a day has gone by with nothing addressed to her directly.',
              why: 'A status request for everyone avoids singling her out, but she has not answered the chat in a week, so it changes nothing. A private ask to her is what could get a reply.',
              raises: ['chat-only-ask'],
            },
            {
              text: 'Post what Dana promised last Wednesday, with the date, and ask her to confirm she is still on it',
              grade: 'mistake',
              outcome:
                'Dana, who has ignored the chat all week, ignores this too. The recap reads like a case file, and Marcus adds a list of other deadlines she has missed this term.',
              why: 'A dated recap looks like careful documentation, but she is not reading that thread and a public post turns a work problem into a dispute. The ask belongs where she will read it.',
            },
            {
              text: 'Post that the three of you will take over her section unless she answers by tonight',
              grade: 'blunder',
              outcome:
                'Priya and Marcus agree loudly. If Dana reads the thread later, she will see her teammates writing her out in public before anyone asked whether she could still deliver.',
              why: 'A public deadline hardens positions and hands her a grievance if something real is going on. It also leaves no private ask on record.',
            },
          ],
        },
        {
          text: 'Find out what is going on before asking her for anything',
          ways: [
            {
              text: 'Text her only to ask whether she is okay, with nothing about the section, so it does not feel like pressure',
              grade: 'mistake',
              outcome:
                'Dana does not answer. The message gave her nothing to act on, and a day passes with the section no closer to done.',
              why: 'Checking on her is a kind impulse, but a message with no ask is easy to leave unanswered and burns time the group lacks. A specific small request gets a reply sooner.',
            },
            {
              text: 'Ask a classmate who shares another course with her what is going on and whether she has been attending',
              grade: 'blunder',
              outcome:
                'The classmate shares things about Dana that were not theirs to share, and mentions that you asked. Dana learns you were checking on her through other people.',
              why: 'Worry is a decent motive, but probing others about her private life invites gossip and costs trust. The project needs a clear ask from you, not answers from them.',
            },
            {
              text: 'Email the instructor that she has not replied in a week and ask whether they know anything about her situation',
              grade: 'blunder',
              outcome:
                'The instructor replies that they cannot discuss a student\'s circumstances and asks what the group has tried. Dana is now on the instructor\'s radar before anyone has asked her anything.',
              why: 'Going to the instructor first skips the step the instructor will ask about. The instructor can help once the group has a record of trying to reach her directly.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'Wednesday, 9 p.m. Still nothing from Dana. Marcus built the dataset, Priya wrote the background and you the discussion. Slides must be done Sunday night to leave Monday morning for one run-through. What do you propose?',
      approaches: [
        {
          text: 'Wait for her reply until a set time before changing the plan',
          ways: [
            {
              text: 'Hold the slot until Thursday noon while Priya and Marcus outline it, then assign the pieces',
              grade: 'slip',
              outcome:
                'Thursday noon comes with no reply and the split begins. The outline helps, but each piece now has about a day less than it could have had.',
              why: 'A fixed time plus an outline limits the damage, but half a day of her section sat idle waiting for someone who has stopped answering. Starting the work tonight would have used that time.',
            },
            {
              text: 'Hold the slot until Saturday night, to leave her as much time as possible to send it',
              grade: 'mistake',
              outcome:
                'Saturday night passes with no word. Priya and Marcus write what they can in a rush, the parts differ in style, and there is time for one hurried run-through.',
              why: 'Giving her time feels fair, but the cost of waiting falls on the three who are working. Fairness to her cannot come at the price of the group\'s ability to recover.',
            },
            {
              text: 'Keep the plan as it stands and have the three of you ready to fill in on Sunday if nothing arrives',
              grade: 'blunder',
              outcome:
                'Sunday night nothing arrives and the three of you start writing a quarter of the talk the night before the run-through. Nobody has time to check the numbers.',
              why: 'Planning to fill in at the last moment treats the section as a problem for Sunday, when it is a problem for tonight. Analysis cannot be checked in one evening.',
            },
          ],
        },
        {
          text: 'Start covering her section tonight and keep her slot open',
          ways: [
            {
              text: 'Results go to whoever knows the data, methods to another; message Dana what is covered and when she can still send hers',
              grade: 'best',
              outcome:
                'By Thursday morning the results have an owner and an outline, the methods have another, and Dana has a private message with what is covered and a time to send hers. The group has a plan to sleep on.',
              why: 'One owner for the results keeps the numbers and the story consistent, and a stated last time lets her contribute without leaving the group guessing. Whole pieces with owners beat thirds with seams.',
            },
            {
              text: 'Split it into three equal parts, one each, and message Dana what is covered and when she can still send hers',
              grade: 'slip',
              outcome:
                'The thirds are assigned and Dana is told. By Friday night the three parts disagree on terms and one number, and merging them costs the evening meant for rehearsal.',
              why: 'An equal split looks fair, but results and methods lean on each other and on one dataset, so three writers produce three versions. One owner for the results keeps the story straight.',
            },
            {
              text: 'Assign it by who knows the data, and tell Dana once it is drafted so she is not asked to react to a half-done plan',
              grade: 'mistake',
              outcome:
                'The section comes together by Thursday night. Dana, told only then, writes nothing back, and Priya notices that she was handed a finished plan with no time or way to contribute.',
              why: 'Waiting to tell her felt kind, but a plan she learns of after it is done leaves no room for her to contribute and a record that she was left out. Tell her when the plan starts.',
              raises: ['told-late'],
            },
          ],
        },
        {
          text: 'Reshape the talk so it works with the three of you',
          ways: [
            {
              text: 'Fold her results into your parts as one slide each and drop the separate methods and results section',
              grade: 'mistake',
              outcome:
                'The talk fits the time, but the assignment lists methods and results as a required part. Priya spots the gap on Saturday and the group has to put a version of it back.',
              why: 'Folding it in feels efficient, but a required part is not the group\'s to drop; the instructor sets what counts. The content still has to be covered.',
            },
            {
              text: 'Mention her analysis as future work in the conclusion and give the saved minutes to your own parts',
              grade: 'mistake',
              outcome:
                'On Monday the conclusion reads as an excuse. The instructor asks why the planned results are missing, and the group has no answer ready.',
              why: 'Calling a missing part future work changes the project\'s claims without saying so. The content has to be covered, or the instructor told, not reframed.',
            },
            {
              text: 'Shorten every part equally and ask the instructor on Monday morning whether the shorter talk is acceptable',
              grade: 'blunder',
              outcome:
                'On Monday morning the instructor says the assignment cannot be shortened after the fact and asks why nobody raised it earlier. The talk is shorter and there is no time left to fix it.',
              why: 'Asking forgiveness here costs the one thing the group lacks, time, and gives the instructor no say before the work is shaped. A request has to come before the work is cut.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        "Thursday, noon. Dana still has not replied to anything. The syllabus lists the instructor's email and office hours, and the group has not decided what the instructor should hear or when.",
      approaches: [
        {
          text: 'Write to the instructor today',
          ways: [
            {
              text: 'Send the dated messages, what the group is covering and one question on individual credit, and tell Dana you wrote',
              grade: 'best',
              outcome:
                'The instructor replies that day: thanks for the dates, the group should cover the assignment, individual parts are judged on what each person turned in, and to forward anything Dana sends.',
              why: 'Dated messages let the instructor act without taking sides, a question on credit gets an answer the group can use, and telling Dana is fair to her. Four days left is enough time for help.',
            },
            {
              text: 'Send a summary of what you asked and when, the cover plan and one question on credit, and tell Dana you wrote',
              grade: 'slip',
              outcome:
                'The instructor says this helps and asks to see what was actually sent. It takes a day to gather the screenshots, and the real answer arrives a day later than it could have.',
              why: 'A summary is accurate but cannot be checked, and instructors act on records, not recollection. Sending the messages themselves saves the day.',
              ifRaised: {
                flag: 'chat-only-ask',
                grade: 'mistake',
                outcome:
                  'The instructor asks to see what you sent Dana. Your only ask was a post to all four of you in the group chat, so nothing is addressed to her, and the reply asks what the group tried before writing.',
                why: 'Your Wednesday post went to the whole chat, so there is nothing addressed to her to show, and a summary of asks has nothing behind it. The earlier choice is what weakened this email.',
              },
            },
            {
              text: 'Send the entire chat and doc history so the instructor can judge for themselves, and tell Dana you wrote',
              grade: 'mistake',
              outcome:
                'The instructor skims it, replies that they need dates and a question, and says the group should plan to cover the assignment. A day is lost and the email reads as a case against Dana.',
              why: 'More material feels thorough, but it buries the few dated facts an instructor needs and reads as building a case. A short email with the records that matter is easier to act on.',
            },
          ],
        },
        {
          text: 'Ask the instructor to take a specific step',
          ways: [
            {
              text: 'Ask the instructor to email Dana and tell her to hand in her section by Friday',
              grade: 'mistake',
              outcome:
                'The instructor sends Dana a short reminder. Her inbox stays quiet, and the instructor asks what the group plans to do in the meantime.',
              why: 'You asked the instructor to do the chasing. Instructors first want to see what the group has tried and what it plans.',
            },
            {
              text: 'Ask the instructor to confirm how her missing section will count toward her individual grade',
              grade: 'mistake',
              outcome:
                'The instructor replies that grades come from the work and the peer evaluations, not from a promise made in advance, and that the group should deal with the assignment first.',
              why: 'Asking for a verdict before the facts are in presumes the outcome and sounds like a complaint. A question on how credit is judged gets an answer the group can use.',
            },
            {
              text: 'Ask to move your presentation to next week, since one member\'s part is missing',
              grade: 'blunder',
              outcome:
                'The instructor declines because other groups are scheduled, and notes that the request came with no plan for the missing section.',
              why: 'A new date for everyone treats one person\'s gap as the group\'s problem and signals no plan. Instructors rarely move a date without a clear reason.',
            },
          ],
        },
        {
          text: 'Give Dana one more day before involving anyone',
          ways: [
            {
              text: 'Text her that you will write to the instructor Friday morning if you hear nothing, then do so',
              grade: 'slip',
              outcome:
                'Friday morning comes with no reply and you write then. The instructor answers usefully, but late Friday, leaving little time to adjust the weekend plan.',
              why: 'The notice to Dana is fair and the email is sound, but a day was spent. The instructor\'s answer is most useful with several days left.',
            },
            {
              text: 'Ask the TA to chase her informally, and keep the instructor out of it unless it grows',
              grade: 'mistake',
              outcome:
                'The TA says they will mention it to Dana and that grading is the instructor\'s call. Nothing is written down, and the instructor hears of it only when the group finally writes.',
              why: 'A TA is a friendly route, but an informal word leaves no record and no decision-maker. The person who sets credit needs to hear it directly.',
            },
            {
              text: 'Say nothing until the peer evaluations, since that is where contributions get recorded',
              grade: 'blunder',
              outcome:
                'The presentation goes ahead. Afterward the instructor learns for the first time that one member did nothing, and asks why nobody said so while it could have helped.',
              why: 'Peer evaluations measure contribution after the fact; they are not a warning. Waiting removes the instructor\'s ability to help while it matters.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'Monday afternoon, the presentation is over. Dana wrote Sunday night: a family emergency kept her offline, and she is sorry. The peer evaluation form is due in 48 hours: a 1 to 5 contribution rating for each teammate, plus comments. Priya suggests comparing notes first.',
      approaches: [
        {
          text: 'Rate Dana on the work she actually delivered',
          ways: [
            {
              text: 'Give a low score, list dated facts of what she promised and delivered, and quote her message as her reason',
              grade: 'best',
              outcome:
                'The instructor has dated facts and her stated reason in one place and can weigh the circumstances without guessing. Nothing in your comments needs defending.',
              why: 'A rating records contribution, and the comments carry facts and her own reason with no verdict on either. The instructor decides what the emergency changes, and your account stays one you can stand behind.',
            },
            {
              text: 'Give a low score, list the facts, quote her message, and ask the instructor to weigh the emergency in her grade',
              grade: 'slip',
              outcome:
                'The comments are accurate and specific. The instructor notes the request and mostly sets it aside, since consequences are theirs to decide.',
              why: 'The facts are sound, but asking for an outcome steps outside your role and dilutes a clean account. Evaluators report what happened; the instructor decides what follows.',
              ifRaised: {
                flag: 'told-late',
                grade: 'mistake',
                outcome:
                  'Dana tells the instructor nobody told her when she could still hand something in. Your request to weigh her emergency now reads as the group softening how it handled her.',
                why: 'Dana was told of the plan only after it was set, with no time to contribute, so she can say she was shut out and your leniency line reads as cover. The earlier choice is what weakened this.',
              },
            },
            {
              text: 'Give a low score, list the facts, and add her missed deadlines from earlier this term so the instructor sees the pattern',
              grade: 'mistake',
              outcome:
                'The instructor discounts the comments: the earlier deadlines belong to other work, and the pattern reads as a case against her, which the emergency now makes look unfair.',
              why: 'Adding history feels thorough, but this form asks about this project. Facts about other work invite a dispute over character.',
            },
          ],
        },
        {
          text: 'Rate Dana in light of what she has been through',
          ways: [
            {
              text: 'Give her a middle score and explain in the comments that she had an emergency and the group covered her part',
              grade: 'mistake',
              outcome:
                'The instructor reads a middling score and a kind note and cannot tell what was delivered. Priya and Marcus, who covered the section, see the same note and say nothing but notice.',
              why: 'Sympathy shaped the number, so it no longer records contribution. Her situation belongs in the comments, where the instructor can weigh it, not in the score.',
            },
            {
              text: 'Hold your rating until Dana has sent her side in writing, then rate her based on it',
              grade: 'mistake',
              outcome:
                'Dana replies Tuesday night with a long message and asks you to reword two dates. The deadline is hours away and the rating is written in a rush.',
              why: 'Waiting for her version hands the shape of your account to the person it is about, and she has already given her reason. Rate from what you saw and let her speak for herself.',
            },
            {
              text: 'Leave her entry blank and tell the instructor you will not rate someone in a crisis',
              grade: 'blunder',
              outcome:
                'The form is marked incomplete, and the instructor says a missing rating counts against your own evaluation until you submit it.',
              why: 'Skipping the rating avoids a hard call, but it leaves the instructor with less to judge and the requirement unmet.',
            },
          ],
        },
        {
          text: 'Compare notes with Priya and Marcus before anyone submits',
          ways: [
            {
              text: 'Agree on the dates and facts only, then each of you writes your own score and comments from the list',
              grade: 'slip',
              outcome:
                'Your comments match Priya\'s and Marcus\'s on every date, and the three forms share the same list of facts. The instructor finds them consistent, though a little uniform.',
              why: 'Checking dates is sensible, but forms built from one shared list read as one account repeated. Each evaluator should report what they saw independently.',
            },
            {
              text: 'Agree on one score and one set of comments, then each of you submits them',
              grade: 'mistake',
              outcome:
                'Three forms arrive with the same wording. The instructor reads it as one opinion repeated, and the evaluations count for less than they should have.',
              why: 'Evaluations are meant to be independent reports. Identical text from three forms looks coordinated and removes your separate viewpoints.',
            },
            {
              text: 'Send Dana your draft comments first so she can correct anything before you submit',
              grade: 'blunder',
              outcome:
                'Dana asks you to soften the facts and drop two dates. Rewriting your comments to please her changes what the instructor sees.',
              why: 'Offering her a review feels fair, but an evaluation is the instructor\'s read of each person, and her edits would shape your account.',
            },
          ],
        },
      ],
    },
  ],
  endings: {
    good: 'Dana’s section was covered, the instructor heard from you in writing, and your evaluation of Dana rested on dated facts rather than impressions. Whatever her reasons turn out to be, the record is fair to her and to you, and nothing you sent needs defending.',
    ok: 'The week is over, and at least one of the four calls cost more than it had to: how Dana was asked, how her part was covered, what the instructor was told, or how she was rated. That cost was time, goodwill or credibility the group could have kept.',
    bad: 'The week got away from the group. More than one call, from how Dana was asked to how she was rated, cost time, goodwill or credibility, and together they cost enough to show in the talk, in what the instructor could act on, or in how Dana was treated.',
  },
}
export default draft
