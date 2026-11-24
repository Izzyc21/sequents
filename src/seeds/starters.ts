/**
 * Starter scenarios shown to every signed-in user.
 *
 * Each one is a ScenarioDraft: the same shape the AI generator produces, so
 * starters and generated scenarios go through the same split (public part ->
 * `scenarios`, hidden part -> `scenario_answers`) and the same rule checks.
 *
 * This file is imported by worker code only. It holds the hidden parts
 * (effects, kinds, endings), so it must never be imported by a page.
 *
 * Meters: higher is always better. Deltas are applied in order and clamped to
 * 0-100. Every starter is unit-tested so that picking every "best" option ends
 * good, every "trap" ends bad, and every "ok" ends ok.
 */
import type { ScenarioDraft } from '../features/play/types'

export const STARTERS: ScenarioDraft[] = [
  {
    id: 'starter-wifi-deadline',
    title: 'The Wi-Fi dies an hour before the deadline',
    situation: "My laptop won't connect to Wi-Fi an hour before an assignment is due.",
    setting:
      "It's 10:58 PM. Your essay is due at midnight through the course portal, and your laptop just dropped off the Wi-Fi. The icon says \"No internet\". Your phone still has signal.",
    meters: [
      { name: 'Time left', start: 60 },
      { name: 'Calm', start: 50 },
      { name: 'Work quality', start: 55 },
    ],
    scenes: [
      {
        prompt: 'The Wi-Fi icon says "No internet". What do you do first?',
        options: [
          {
            text: 'Check whether your phone and other devices on the same Wi-Fi are online',
            kind: 'best',
            delta: [-3, 10, 0],
            outcome: 'Your phone loads pages fine on the same network, so the problem is the laptop, not the router. You narrowed it down in a minute.',
            why: 'Checking whether the problem is the device or the network tells you where to look.',
          },
          {
            text: 'Restart the router',
            kind: 'trap',
            delta: [-15, -5, 0],
            outcome: 'The router takes eight minutes to come back, knocks everyone else offline, and the laptop still says "No internet".',
            why: 'Restarting the router feels decisive, but it costs time and you never confirmed the router was the problem.',
          },
          {
            text: "Turn the laptop's Wi-Fi off and on",
            kind: 'ok',
            delta: [-2, 3, 0],
            outcome: 'It reconnects for a moment, then drops again. At least the Wi-Fi card is not completely dead.',
            why: "A quick toggle is cheap and sometimes works, but it doesn't tell you what's wrong.",
          },
        ],
      },
      {
        prompt: 'Your essay only exists on this laptop. What now?',
        options: [
          {
            text: 'Keep trying fixes on the laptop until it works',
            kind: 'trap',
            delta: [-15, -10, 0],
            outcome: 'Twenty minutes of forums and settings later, nothing has changed and the essay is still stuck on this machine.',
            why: 'Sinking time into one fix without a backup plan is how deadlines get missed.',
          },
          {
            text: "Save the essay to a USB stick so it isn't trapped on this laptop",
            kind: 'best',
            delta: [-3, 12, 0],
            outcome: 'The file is safe on the stick. Whatever happens to the laptop, you can submit from another device.',
            why: 'Removing the single point of failure first makes every later fix a bonus, not a rescue.',
          },
          {
            text: "Turn on your phone's hotspot and connect the laptop to it",
            kind: 'ok',
            delta: [-4, 5, 0],
            outcome: "The laptop connects to the hotspot. It's slow, but working for now.",
            why: 'A hotspot is a decent workaround, but it still depends on the laptop that is misbehaving.',
          },
        ],
      },
      {
        prompt: 'A classmate texts: "Is the portal down for you too??" What do you do?',
        options: [
          {
            text: 'Text back and swap theories for a while',
            kind: 'ok',
            delta: [-8, 2, 0],
            outcome: "You commiserate. It's comforting, but ten minutes go by and you learn nothing new.",
            why: 'Talking it out helps your mood more than your situation.',
          },
          {
            text: "Assume it's down for everyone and stop rushing",
            kind: 'trap',
            delta: [-10, 10, -10],
            outcome: 'You relax. Later you find out the portal was working the whole time and most people submitted.',
            why: "A rumour isn't confirmation; acting on it feels calming and costs you.",
          },
          {
            text: 'Open the portal on your phone and screenshot what you see, with the time showing',
            kind: 'best',
            delta: [-2, 8, 0],
            outcome: 'The portal is slow but up. Your timestamped screenshot proves when you tried, if anything goes wrong later.',
            why: 'Evidence with a timestamp protects you if the deadline turns into a dispute.',
          },
        ],
      },
      {
        prompt: "It's 11:35. The essay's last paragraph is still a rough draft. What do you do?",
        options: [
          {
            text: 'Spend ten minutes tightening the conclusion, then submit',
            kind: 'best',
            delta: [-8, 2, 15],
            outcome: "The ending reads cleanly now, and there's still time to submit.",
            why: 'A short, bounded polish improves the work without risking the deadline.',
          },
          {
            text: 'Leave it as it is and submit now',
            kind: 'ok',
            delta: [5, 5, -5],
            outcome: "It's in early. The ending is rough, but it's in.",
            why: 'Submitting early is safe; the cost is a weaker ending.',
          },
          {
            text: 'Rewrite the whole conclusion from scratch',
            kind: 'trap',
            delta: [-20, -8, 5],
            outcome: "The new version is half-finished at 11:52 and you're panicking.",
            why: 'Big rewrites under time pressure usually make the work worse, not better.',
          },
        ],
      },
      {
        prompt: 'You press Submit. The page spins, then shows an error. It is 11:56. What do you do?',
        options: [
          {
            text: 'Keep refreshing the submit page',
            kind: 'trap',
            delta: [-15, -15, 0],
            outcome: 'Each refresh resets the form. At 12:01 it finally goes through, late.',
            why: 'Repeating the action that is failing burns the last minutes you had.',
          },
          {
            text: 'Try a different browser on your phone',
            kind: 'ok',
            delta: [-5, -3, 0],
            outcome: 'The upload works on your phone at 11:59. Close, but done.',
            why: "Switching devices can work, but it's a gamble with seconds left.",
          },
          {
            text: 'Email the essay and your screenshot to your professor now, then retry the portal',
            kind: 'best',
            delta: [5, 12, 5],
            outcome: 'Your email lands at 11:57 with the file and the proof. The portal accepts it on the second try at 11:58.',
            why: 'A timestamped email is a backup submission most instructors accept.',
          },
        ],
      },
    ],
    endings: {
      good: "Submitted on time, with proof in your inbox. Next time the Wi-Fi dies, you'll know the order: protect the file, then fix the problem.",
      ok: 'You got it in, but it was closer than it needed to be.',
      bad: 'The essay went in late, or not at all, and you have nothing that shows when you tried.',
    },
  },

  {
    id: 'starter-raise',
    title: 'Asking your manager for a raise',
    situation: "I want to ask my manager for a raise but I'm nervous.",
    setting:
      "You've been in your role for 14 months. You took on extra work when a teammate left, and you've just seen job posts for your role paying about 12% more. Your one-on-one with your manager is on Thursday.",
    meters: [
      { name: 'Leverage', start: 45 },
      { name: 'Relationship', start: 60 },
      { name: 'Composure', start: 50 },
    ],
    scenes: [
      {
        prompt: "It's Monday. How do you prepare for Thursday?",
        options: [
          {
            text: 'Ask a coworker what they think you should ask for',
            kind: 'ok',
            delta: [3, -3, 3],
            outcome: 'Your coworker guesses a number. It is a starting point, and now one more person knows your plans.',
            why: "Advice helps, but a peer's guess isn't data.",
          },
          {
            text: 'Write down three things you delivered, with numbers, plus the pay range you found in job posts',
            kind: 'best',
            delta: [15, 0, 8],
            outcome: 'You have a one-page list: the extra work you covered, two projects you shipped, and three job posts with pay ranges.',
            why: 'Specific results and market data turn "I deserve more" into a case.',
          },
          {
            text: 'Wing it. You know your work is good.',
            kind: 'trap',
            delta: [-10, 0, -10],
            outcome: "You feel fine on Monday. By Wednesday night you can't remember the dates of anything you did.",
            why: 'Confidence without evidence falls apart the moment someone asks "like what?"',
          },
        ],
      },
      {
        prompt: 'Thursday. Your manager opens with "So, what\'s on your mind?"',
        options: [
          {
            text: 'Start by apologising for bringing it up',
            kind: 'trap',
            delta: [-12, 0, -8],
            outcome: '"Sorry, I know budgets are tight, but..." Your manager nods sympathetically, at the budget.',
            why: "Apologising frames the request as a burden before you've made it.",
          },
          {
            text: 'Ease in with small talk about the team first',
            kind: 'ok',
            delta: [0, 5, -3],
            outcome: 'Ten friendly minutes pass. When you finally bring up pay, there is less time left to discuss it.',
            why: 'A warm-up is pleasant, but it eats the time you need.',
          },
          {
            text: "Say plainly that you'd like to talk about your pay, then walk through your results",
            kind: 'best',
            delta: [10, 5, 8],
            outcome: 'Your manager leans in and asks good questions. The conversation is about your work, not your nerves.',
            why: 'Naming the topic and leading with results keeps the talk on your value.',
          },
        ],
      },
      {
        prompt: 'Your manager asks: "What number did you have in mind?"',
        options: [
          {
            text: 'Name one number at the top of the market range you found',
            kind: 'best',
            delta: [12, -2, 5],
            outcome: 'You say the number and stop talking. Your manager writes it down and says they need to check.',
            why: 'Anchoring high with a reason leaves room to land where you want.',
          },
          {
            text: 'Say "whatever you think is fair"',
            kind: 'trap',
            delta: [-15, 3, -5],
            outcome: "Your manager suggests 3%, which is awkward to argue with after you said whatever's fair.",
            why: 'Handing over the number gives away your strongest lever.',
          },
          {
            text: 'Give a range from the middle to the top of the market',
            kind: 'ok',
            delta: [5, 2, 3],
            outcome: 'Your manager hears the bottom of your range, naturally.',
            why: 'Ranges feel polite, but the listener hears the lower end.',
          },
        ],
      },
      {
        prompt: 'Your manager says: "The budget is frozen until next quarter."',
        options: [
          {
            text: 'Ask what it would take to approve it next quarter, and agree on a date to revisit',
            kind: 'best',
            delta: [10, 8, 5],
            outcome: 'You leave with a written goal and a calendar invite for the first week of next quarter.',
            why: 'Turning "not now" into a dated plan keeps the raise alive.',
          },
          {
            text: "Mention that you've been looking at other jobs, as pressure",
            kind: 'trap',
            delta: [5, -20, -5],
            outcome: "The room goes cold. Your manager asks whether you're planning to leave.",
            why: 'A vague threat damages trust without guaranteeing anything.',
          },
          {
            text: "Accept it and say you'll bring it up again sometime",
            kind: 'ok',
            delta: [-5, 5, 0],
            outcome: 'A friendly ending, but "sometime" has no date, and you both know it might not happen.',
            why: 'Agreeing without a follow-up date lets the request quietly expire.',
          },
        ],
      },
      {
        prompt: 'The next day your manager emails, asking you to put your request in writing.',
        options: [
          {
            text: 'Reply "Thanks, will do" and send it next week',
            kind: 'ok',
            delta: [-3, 0, 0],
            outcome: 'By next week the momentum has faded, but the email does go out.',
            why: 'The delay is not fatal, but it makes your request easy to push down the list.',
          },
          {
            text: 'Write a long email listing everything unfair about your pay',
            kind: 'trap',
            delta: [-10, -15, -8],
            outcome: 'Your manager replies "Let\'s discuss in person", and the tone has changed.',
            why: 'Grievances in writing read as conflict, not as a case.',
          },
          {
            text: 'Send a short email with your results, the number, and the agreed revisit date',
            kind: 'best',
            delta: [10, 5, 8],
            outcome: 'Your manager forwards it to HR with "Let\'s plan for this."',
            why: 'A clear written summary is easy for your manager to pass upward.',
          },
        ],
      },
    ],
    endings: {
      good: "You have a dated plan for your raise and a manager who's on your side.",
      ok: "The door is open, but nothing is promised and you'll need to push again.",
      bad: 'The conversation hurt your standing, and the raise is further away than before.',
    },
  },

  {
    id: 'starter-group-project',
    title: 'A teammate goes silent on the group project',
    situation: "One person in my group project hasn't done their part and we present in two days.",
    setting:
      'Your group of four presents on Friday. It is Wednesday morning. Jordan was supposed to make the data slides a week ago and has not answered the group chat since Sunday.',
    meters: [
      { name: 'Grade', start: 55 },
      { name: 'Team spirit', start: 55 },
      { name: 'Calm', start: 50 },
    ],
    scenes: [
      {
        prompt: "Jordan still hasn't replied. What's your first move?",
        options: [
          {
            text: 'Call Jordan out in the group chat',
            kind: 'trap',
            delta: [0, -15, -5],
            outcome: 'The chat goes silent. Jordan leaves it on read, and the others feel awkward.',
            why: 'Public blame makes people defensive and slower, not faster.',
          },
          {
            text: "Message Jordan privately: ask if they're OK and when they can send the slides",
            kind: 'best',
            delta: [5, 10, 5],
            outcome: "Jordan replies within an hour: they've been sick and fell behind, but can send a rough version tonight.",
            why: "A private, kind message gets answers that public pressure doesn't.",
          },
          {
            text: 'Wait one more day to see if they show up',
            kind: 'ok',
            delta: [-5, 0, -5],
            outcome: 'Another day passes. Nothing changes, and now there is less time.',
            why: 'Waiting avoids conflict but spends your buffer.',
          },
        ],
      },
      {
        prompt: 'The rest of the group wants a plan. What do you propose?',
        options: [
          {
            text: "Split Jordan's slides into small pieces, with Jordan keeping the piece they can finish",
            kind: 'best',
            delta: [12, 8, 5],
            outcome: "Everyone takes a slide. Jordan keeps the chart they'd already started. The work is moving.",
            why: 'Small, clear pieces get done, and keeping Jordan involved keeps the team whole.',
          },
          {
            text: "Ask the group to wait for Jordan's rough version",
            kind: 'ok',
            delta: [0, 3, -3],
            outcome: "The group waits. Jordan's version arrives late and needs work.",
            why: 'Trusting the rough version is fair, but it leaves no margin.',
          },
          {
            text: "Do all of Jordan's slides yourself tonight",
            kind: 'trap',
            delta: [5, -5, -15],
            outcome: "You stay up until 3 AM. The slides are done, you're exhausted, and the others now assume you've got everything.",
            why: 'Taking everything on yourself trades one problem for burnout and resentment.',
          },
        ],
      },
      {
        prompt: "Thursday: the slides don't match. Different fonts, colours and styles. Rehearsal is tonight.",
        options: [
          {
            text: "Redo everyone's slides in your own style without asking",
            kind: 'trap',
            delta: [5, -15, -5],
            outcome: 'The deck looks great. Two teammates are quietly annoyed that their work was replaced.',
            why: 'Rewriting other people\'s work without asking hurts trust, even when the result is better.',
          },
          {
            text: 'Spend 20 minutes putting every slide on one template',
            kind: 'best',
            delta: [10, 3, 3],
            outcome: 'The deck looks like one team made it, and nobody had to be told their slides were ugly.',
            why: 'A quick consistency pass is a big quality gain for little time.',
          },
          {
            text: 'Leave them. Content matters more.',
            kind: 'ok',
            delta: [-3, 2, 3],
            outcome: 'The content is fine, but the jumps in style are distracting.',
            why: 'Content does matter more, but presentation affects the grade too.',
          },
        ],
      },
      {
        prompt: 'At rehearsal, Jordan asks to present their own section even though they missed the meetings.',
        options: [
          {
            text: 'Let them, without practising it',
            kind: 'ok',
            delta: [-5, 5, -3],
            outcome: "Jordan presents. It's rough in places, but they get through it.",
            why: 'Including them helps the team, but skipping practice risks the grade.',
          },
          {
            text: 'Say yes, and run through their part with them once',
            kind: 'best',
            delta: [8, 10, 5],
            outcome: 'Jordan is nervous but prepared after one run-through. The group feels like a group again.',
            why: 'Including someone with support turns a weak spot into a contribution.',
          },
          {
            text: "Say no; you'll present it because you know it better",
            kind: 'trap',
            delta: [3, -15, -5],
            outcome: 'Jordan agrees, visibly hurt. The professor later asks why one person presented two sections.',
            why: 'Shutting someone out can look worse to the grader and to the team.',
          },
        ],
      },
      {
        prompt: 'After the presentation, the professor asks each group for a short report on who did what.',
        options: [
          {
            text: 'Say everyone contributed equally',
            kind: 'ok',
            delta: [-3, 3, 0],
            outcome: 'Smooth, but your extra work goes unmentioned.',
            why: 'Smoothing things over is kind, but it is not accurate.',
          },
          {
            text: 'Write a report blaming Jordan for everything',
            kind: 'trap',
            delta: [-5, -20, -5],
            outcome: 'The professor notices the report contradicts what they saw in the presentation. It looks petty.',
            why: 'One-sided blame undermines your own credibility.',
          },
          {
            text: 'Write an honest, factual report and show it to the group first',
            kind: 'best',
            delta: [5, 8, 8],
            outcome: 'Everyone agrees it is fair. Jordan thanks you for not throwing them under the bus.',
            why: 'Facts shared openly feel fair to everyone, the professor included.',
          },
        ],
      },
    ],
    endings: {
      good: "A strong grade, the group still friends, and you didn't burn out to get there.",
      ok: 'The project got done, with a few bruises along the way.',
      bad: 'The grade or the group fell apart, maybe both.',
    },
  },

  {
    id: 'starter-angry-customer',
    title: 'An angry customer on the phone',
    situation: 'A customer is shouting on the phone because their order is two weeks late.',
    setting:
      'You work the support line for an online furniture shop. Sam calls: their sofa is two weeks late, they took a day off work for a delivery that never came, and they are shouting.',
    meters: [
      { name: 'Customer trust', start: 30 },
      { name: 'Calm', start: 50 },
      { name: 'Budget', start: 60 },
    ],
    scenes: [
      {
        prompt: 'Sam is shouting. What do you say first?',
        options: [
          {
            text: 'Explain that delays are caused by the shipping company',
            kind: 'trap',
            delta: [-15, -5, 0],
            outcome: '"I don\'t care whose fault it is!" Sam gets louder.',
            why: 'Explaining whose fault it is sounds like an excuse, even when it is true.',
          },
          {
            text: 'Ask for the order number right away',
            kind: 'ok',
            delta: [3, 0, 0],
            outcome: 'Sam reads it out, still angry, but the call is moving.',
            why: 'Getting to the facts is useful, but skipping empathy keeps them angry.',
          },
          {
            text: "Let them finish, then repeat back what happened and say you're sorry it did",
            kind: 'best',
            delta: [15, 5, 0],
            outcome: 'Sam\'s voice drops. "Yes. Exactly. Thank you for listening."',
            why: 'People calm down once they feel heard, and repeating their facts proves you listened.',
          },
        ],
      },
      {
        prompt: 'You look up the order: the sofa is stuck at a warehouse, with no new delivery date.',
        options: [
          {
            text: "Tell Sam honestly what you know, and that you'll call the warehouse now",
            kind: 'best',
            delta: [10, 5, 0],
            outcome: "Sam isn't happy, but appreciates the honesty. You get the warehouse on the line.",
            why: 'Honest uncertainty with a next step builds more trust than a guess.',
          },
          {
            text: 'Promise it will arrive this week',
            kind: 'trap',
            delta: [-15, -10, -5],
            outcome: 'Sam relaxes, until the warehouse tells you it cannot ship for days and you have to call Sam back with the news.',
            why: "Promising what you don't control buys a minute and costs trust later.",
          },
          {
            text: 'Put Sam on hold while you investigate',
            kind: 'ok',
            delta: [-3, 3, 0],
            outcome: 'Eight minutes of hold music later, Sam is back to irritated.',
            why: 'Investigating is right, but a long silent hold feels like being ignored.',
          },
        ],
      },
      {
        prompt: 'The warehouse can ship in five days. Sam asks for compensation for the day off work.',
        options: [
          {
            text: "Say you'll ask your supervisor and get back to them",
            kind: 'ok',
            delta: [-3, 0, 0],
            outcome: 'Sam sighs at another wait, but the request is logged.',
            why: 'Escalating is safe, but slower when you could have solved it yourself.',
          },
          {
            text: 'Offer free express delivery plus a partial refund within your limit',
            kind: 'best',
            delta: [12, 3, -10],
            outcome: "Sam accepts. It costs the shop something, but it's within your authority.",
            why: 'A concrete, fair offer inside your limits solves it without escalation.',
          },
          {
            text: 'Offer a full refund and let them keep the sofa',
            kind: 'trap',
            delta: [15, 5, -25],
            outcome: 'Sam is delighted. Your supervisor is not: that was far outside your limit.',
            why: 'Overpaying to end the discomfort sets a costly precedent.',
          },
        ],
      },
      {
        prompt: 'Sam asks: "How do I know this won\'t happen again?"',
        options: [
          {
            text: 'Guarantee it will never happen again',
            kind: 'trap',
            delta: [-5, 0, -5],
            outcome: 'Sam laughs. "You can\'t promise that." Fair point.',
            why: 'Absolute guarantees sound hollow and are impossible to keep.',
          },
          {
            text: 'Give them a tracking link and your direct extension',
            kind: 'best',
            delta: [10, 3, 0],
            outcome: 'Sam saves your extension. "OK. That actually helps."',
            why: 'Giving the customer control and a real contact rebuilds confidence.',
          },
          {
            text: 'Say the company is working on its shipping',
            kind: 'ok',
            delta: [0, 0, 0],
            outcome: 'Sam says "Sure" in a flat voice.',
            why: "Vague assurances don't change anything for the customer.",
          },
        ],
      },
      {
        prompt: 'The call ends. You have five minutes before the next one.',
        options: [
          {
            text: 'Take a short break to reset',
            kind: 'ok',
            delta: [0, 10, 0],
            outcome: "You feel better. The order notes are thin, but you're ready for the next call.",
            why: 'Resetting is healthy; skipping the notes costs someone later.',
          },
          {
            text: 'Write clear notes on the order so the next person knows everything',
            kind: 'best',
            delta: [8, 10, 5],
            outcome: 'When Sam calls back next week, your colleague sees the whole story and sorts it out in two minutes.',
            why: 'Good notes protect the customer and your teammates from starting over.',
          },
          {
            text: 'Vent about Sam in the team chat',
            kind: 'trap',
            delta: [-5, -10, 0],
            outcome: 'A few laughs, but you are more wound up, and the notes never get written.',
            why: 'Venting feels good for a minute and leaves the real work undone.',
          },
        ],
      },
    ],
    endings: {
      good: 'Sam will order again, and the shop paid a fair price to keep them.',
      ok: 'Sam is satisfied enough, but not won over.',
      bad: 'Sam is gone for good, or the fix cost far more than it should have.',
    },
  },

  {
    id: 'starter-phishing',
    title: 'A phishing email hits the whole office',
    situation: 'A fake email went to everyone at work and a coworker typed their password into it.',
    setting:
      'You are the IT person at a 40-person office. At 9:12 AM an email "from the CEO" reaches everyone: "Urgent: review this invoice", with a link to a fake sign-in page. A coworker messages you: "I clicked it and typed my password. Is that bad?"',
    meters: [
      { name: 'Security', start: 40 },
      { name: 'Staff trust', start: 55 },
      { name: 'Time', start: 60 },
    ],
    scenes: [
      {
        prompt: 'A coworker says they typed their password into the fake page. What do you do first?',
        options: [
          {
            text: 'Reset their password and sign them out of every session right now',
            kind: 'best',
            delta: [20, 5, -5],
            outcome: 'Within three minutes the stolen password is useless and any session the attacker had is cut off.',
            why: 'Stolen passwords are used fast, so cutting them off first limits the damage.',
          },
          {
            text: 'Tell them to change their password when they get a chance',
            kind: 'ok',
            delta: [3, 0, 0],
            outcome: 'They change it an hour later. Nothing obviously bad happened in that hour, as far as you can tell.',
            why: 'The right idea, but "when you get a chance" leaves a window open.',
          },
          {
            text: 'Ask them to forward you the email so you can study it first',
            kind: 'trap',
            delta: [-15, 0, -5],
            outcome: "While you read the email's details, someone signs in to their mailbox from another country.",
            why: 'Investigating before containing gives the attacker time.',
          },
        ],
      },
      {
        prompt: 'The fake email is still sitting in 39 other inboxes.',
        options: [
          {
            text: 'Reply-all to the fake email: "This is a scam!"',
            kind: 'trap',
            delta: [-10, -5, 0],
            outcome: 'Your reply goes to the attacker too, and a dozen people reply-all "thanks!", burying the real warning.',
            why: 'Replying on the phishing thread spreads noise and tells the attacker you are watching.',
          },
          {
            text: 'Delete the email from every mailbox with the admin tools',
            kind: 'best',
            delta: [15, 3, -5],
            outcome: 'It is gone from every inbox in minutes, so fewer people get the chance to click.',
            why: 'Removing the bait stops new victims faster than any warning.',
          },
          {
            text: 'Send everyone a warning not to click it',
            kind: 'ok',
            delta: [5, 3, -2],
            outcome: 'Most people read it. Two had already clicked before they saw it.',
            why: 'Warnings help, but they arrive after some people have acted.',
          },
        ],
      },
      {
        prompt: "The sign-in log shows the coworker's account was used from an unknown location at 9:20.",
        options: [
          {
            text: 'Turn on two-step sign-in for that account',
            kind: 'ok',
            delta: [8, 0, -3],
            outcome: 'Future sign-ins need their phone. Whatever happened at 9:20 is still unexamined.',
            why: "Two-step sign-in prevents a repeat but doesn't clean up the past.",
          },
          {
            text: 'Assume the password reset fixed everything and move on',
            kind: 'trap',
            delta: [-15, 0, 5],
            outcome: 'A week later, invoices are still being copied to an outside address by a mail rule nobody checked.',
            why: "A reset stops new sign-ins but doesn't undo what the attacker already set up.",
          },
          {
            text: 'Check what that sign-in did (mail rules, sent mail) and remove anything it set up',
            kind: 'best',
            delta: [15, 0, -8],
            outcome: 'You find a hidden rule forwarding their email to an outside address, and delete it.',
            why: 'Attackers often leave rules behind; checking what they changed finishes the cleanup.',
          },
        ],
      },
      {
        prompt: 'The office manager asks what to tell everyone.',
        options: [
          {
            text: 'Send a short, calm note: what happened, what you did, and what to do if they clicked',
            kind: 'best',
            delta: [5, 15, -3],
            outcome: 'Three more people come forward who clicked. You handle each one in minutes.',
            why: 'A clear, blame-free message gets people to report instead of hide.',
          },
          {
            text: 'Say nothing unless people ask',
            kind: 'ok',
            delta: [-5, -5, 5],
            outcome: 'Rumours spread on their own. Someone thinks the whole network was hacked.',
            why: 'Silence saves time now and creates confusion later.',
          },
          {
            text: 'Name the coworker who clicked, so others learn from it',
            kind: 'trap',
            delta: [0, -20, 0],
            outcome: 'Everyone now knows who clicked. Nobody else admits they did too.',
            why: 'Shaming makes people hide mistakes, which is worse for security.',
          },
        ],
      },
      {
        prompt: 'End of the day. What do you set up so this goes better next time?',
        options: [
          {
            text: 'Block every link in email',
            kind: 'trap',
            delta: [5, -15, -10],
            outcome: 'Phishing links stop, and so does work: every real invoice and shared file link is blocked.',
            why: 'A blunt control that breaks normal work gets worked around or reversed.',
          },
          {
            text: 'Turn on two-step sign-in for everyone and add a "Report phishing" button',
            kind: 'best',
            delta: [15, 5, -5],
            outcome: "Next month, three people report a fake email within minutes, and nobody's password gets used.",
            why: 'Making the safe action easy turns staff into an early warning system.',
          },
          {
            text: 'Schedule a training session for next month',
            kind: 'ok',
            delta: [5, 5, -3],
            outcome: 'The session helps, but a month is a long time.',
            why: 'Training matters, but technical safeguards protect people while they learn.',
          },
        ],
      },
    ],
    endings: {
      good: 'The attack was contained within minutes, and staff now report suspicious emails instead of hiding them.',
      ok: 'The immediate problem is handled, but gaps are left for next time.',
      bad: 'The attacker kept access, or staff stopped trusting IT, maybe both.',
    },
  },

  {
    id: 'starter-rent-increase',
    title: 'Your landlord raises the rent 15%',
    situation: 'My landlord says my rent goes up 15% next month.',
    setting:
      "You have rented the same apartment for three years and always paid on time. A letter says your rent rises 15% from next month. You like the place, but money is tight.",
    meters: [
      { name: 'Savings', start: 45 },
      { name: 'Leverage', start: 40 },
      { name: 'Relationship', start: 60 },
    ],
    scenes: [
      {
        prompt: "You've just read the letter. What's your first move?",
        options: [
          {
            text: 'Call the landlord right away and say the increase is outrageous',
            kind: 'trap',
            delta: [0, -5, -15],
            outcome: 'The landlord gets defensive: "Plenty of people would pay it."',
            why: 'Opening angry makes the other side dig in.',
          },
          {
            text: 'Read your lease and the local rules on notice periods and rent increases',
            kind: 'best',
            delta: [5, 15, 0],
            outcome: "Your lease requires 60 days' notice for an increase. The letter gave you 30.",
            why: "Knowing the rules tells you what's actually allowed before you negotiate.",
          },
          {
            text: 'Start browsing other apartments online',
            kind: 'ok',
            delta: [0, 5, 0],
            outcome: 'You get a rough feel for prices nearby. Useful, but not yet specific.',
            why: 'Looking around helps, but it is only half the picture.',
          },
        ],
      },
      {
        prompt: 'Similar apartments nearby rent for about 8% more than you pay now.',
        options: [
          {
            text: 'Decide to accept the 15% to avoid conflict',
            kind: 'trap',
            delta: [-15, -10, 5],
            outcome: 'You start planning a tighter budget before even talking to them.',
            why: 'Giving in before asking leaves money on the table.',
          },
          {
            text: 'Save three comparable listings, with size and price, to bring up',
            kind: 'best',
            delta: [0, 12, 0],
            outcome: 'You have a short list with links, sizes and prices.',
            why: 'Concrete comparisons make your counteroffer sound reasonable, not emotional.',
          },
          {
            text: 'Plan to just say "it\'s higher than average"',
            kind: 'ok',
            delta: [0, 3, 0],
            outcome: "It's true, but vague.",
            why: 'A general claim is easy to dismiss.',
          },
        ],
      },
      {
        prompt: 'You meet the landlord. How do you open?',
        options: [
          {
            text: 'Ask why the rent is going up',
            kind: 'ok',
            delta: [0, 3, 3],
            outcome: 'Taxes and repairs, they say. Now you understand their side.',
            why: "Understanding their reasons helps, but you haven't asked for anything yet.",
          },
          {
            text: "Say you'd like to stay, mention three years of on-time rent, and ask if there's flexibility",
            kind: 'best',
            delta: [0, 10, 10],
            outcome: 'The landlord softens: "You\'ve been a good tenant. What were you thinking?"',
            why: 'Leading with a shared interest, keeping a good tenant, invites a deal.',
          },
          {
            text: 'Threaten to report them for the short notice',
            kind: 'trap',
            delta: [0, -5, -20],
            outcome: 'The landlord stiffens: "Then we\'ll do it by the book: 60 days, then the full increase."',
            why: 'Leading with threats turns a negotiation into a fight.',
          },
        ],
      },
      {
        prompt: 'The landlord asks what you would accept.',
        options: [
          {
            text: "Say you can't afford any increase at all",
            kind: 'trap',
            delta: [-5, -10, -10],
            outcome: 'The landlord shrugs: "Then I\'ll have to find someone who can."',
            why: 'Zero leaves nothing to negotiate.',
          },
          {
            text: 'Ask them to meet you halfway',
            kind: 'ok',
            delta: [7, 0, 3],
            outcome: 'Halfway is 7.5%. Not bad.',
            why: 'Splitting the difference is fair, but it is anchored on their number.',
          },
          {
            text: 'Propose 6%, citing the comparable listings, and offer to renew for a year',
            kind: 'best',
            delta: [15, 8, 5],
            outcome: 'After some back and forth, you settle on 7% with a one-year lease.',
            why: 'A specific number backed by data, plus something they value, gets a yes.',
          },
        ],
      },
      {
        prompt: 'The landlord agrees in principle. What do you do next?',
        options: [
          {
            text: 'Shake hands and trust it',
            kind: 'trap',
            delta: [-15, -5, 0],
            outcome: 'Next month\'s bill shows the full 15%. "I never agreed to anything," says the landlord.',
            why: 'Spoken agreements are easy to forget or deny.',
          },
          {
            text: 'Ask for the new rent and lease terms in writing',
            kind: 'best',
            delta: [10, 5, 3],
            outcome: 'A signed letter arrives two days later: 7%, one year, starting in 60 days.',
            why: 'Getting it in writing turns a conversation into a commitment.',
          },
          {
            text: 'Send a text summarising what you agreed',
            kind: 'ok',
            delta: [5, 3, 0],
            outcome: 'The landlord replies "yep". Not a lease, but it is a record.',
            why: "A written note helps, but it isn't as strong as signed terms.",
          },
        ],
      },
    ],
    endings: {
      good: 'You kept the apartment at a fair price, in writing, with the landlord still on good terms.',
      ok: 'You saved something, but less than you could have.',
      bad: "You're paying far more than you needed to, or the relationship is damaged, maybe both.",
    },
  },
]
