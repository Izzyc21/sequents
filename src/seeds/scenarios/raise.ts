import type { ScenarioDraft } from '../../features/play/types'

const draft: ScenarioDraft = {
  id: 'starter-raise',
  title: 'Asking your manager for a raise',
  situation:
    "I've been doing a bigger job for months at the same pay, and I want to ask my manager for a raise without hurting the relationship.",
  setting:
    "You are a client services coordinator, 18 months in. Four months ago a senior colleague left and you took over her client reporting and the training of new hires; your title and $72,000 pay did not change. Reviews are held each March. Last spring most people got about 3 percent, and a teammate who asked for more in April was told the money was already spoken for. Two salary sources list your role in your city at both levels: your current title at $68,000 to $75,000, the senior version at $78,000 to $86,000. You would be glad with $80,000.",
  flags: [
    { id: 'previewed-figure', label: 'You named a figure before showing your case' },
    { id: 'said-flexible', label: 'You told your manager you were flexible' },
  ],
  decisions: [
    {
      prompt: 'It is early November. You have decided to ask for a raise. How do you start?',
      approaches: [
        {
          text: 'Ask your manager for a separate conversation about your pay and your role',
          ways: [
            {
              text: 'At your next 1:1, ask for a separate meeting this month about your pay and the role you now cover',
              grade: 'best',
              outcome: "Your manager says yes and sets Thursday. They mention they will look at where the department's raise money stands before then.",
              why: 'A named topic and a near date let your manager look into the money before you sit down, and asking this early reaches them while next year\'s plan can still change.',
            },
            {
              text: 'At your next 1:1, ask for a separate meeting this month about your pay and say you are hoping for about $80,000',
              grade: 'slip',
              outcome: 'Your manager agrees to Thursday and says $80,000 sounds like a stretch but they will see. They walk in with a figure of their own already set.',
              why: 'Giving a figure before you have shown your value lets your manager form their reference first. The case should come before the number, so the meeting opens on your terms.',
              raises: ['previewed-figure'],
            },
            {
              text: 'Email your manager asking for a meeting this month about your pay, with your full case attached',
              grade: 'mistake',
              outcome: 'Your manager reads it that night and replies that budgets are tight. The meeting happens, but it starts as an answer to your argument instead of a chance to shape one.',
              why: 'A full case in writing lets your manager form a view, and even decline, before you can frame it. The person who must argue for you upward should first hear it in your voice.',
            },
          ],
        },
        {
          text: "Use the annual review, the company's regular time for pay discussions",
          ways: [
            {
              text: 'Put a clearly marked raise request, with your evidence, in your written self-review ahead of March',
              grade: 'slip',
              outcome: 'Your manager reads it in the review cycle and agrees the case is solid. By then the raise money is mostly spoken for, so the answer is a small step now and a promise to look again.',
              why: 'The formal channel is proper, but money is mostly allocated before reviews are written. A request inside the review reaches the decision after the pool is set.',
            },
            {
              text: 'Ask HR how raise requests are handled in the review cycle, and follow the process they describe',
              grade: 'mistake',
              outcome: "HR sends a form and notes that pay changes need your manager's sign-off. Your manager hears about it from HR and seems surprised you did not come to them.",
              why: 'HR administers raises but does not decide them, and a manager who hears second-hand feels bypassed. The request should reach them from you first.',
            },
            {
              text: 'Keep a dated log of your added work through the winter, so your March review packet is complete',
              grade: 'mistake',
              outcome: 'By March you hold a thorough, dated record. Your review brings the standard increase, and your manager says there is little left to move.',
              why: 'Evidence is worth most before the money is set. A perfect packet that arrives with the review lands on a budget that was settled months earlier.',
            },
          ],
        },
        {
          text: 'Make your manager aware of the added work first',
          ways: [
            {
              text: 'At your next 1:1, walk through the reporting and training you took on and ask how your manager sees your role developing',
              grade: 'mistake',
              outcome: 'Your manager agrees you have grown a lot and talks about where the role could go. Pay is not discussed, and nobody sets a date to return to it.',
              why: 'A question about your development invites a development answer. It spends the early window on a conversation that ends with no pay decision queued.',
            },
            {
              text: 'Over the next few weeks, update your manager at 1:1s on the reporting and training load, then ask for a pay meeting',
              grade: 'mistake',
              outcome: 'Your manager is glad to hear it. By the time you ask in December, they say next year\'s raise plan was already sent up, and what is left is small.',
              why: 'Awareness is not a decision, and the weeks spent building it are the weeks the money gets set. Your manager already sees the work; what they need is a reason to act now.',
            },
            {
              text: "Use your scheduled skip-level with your manager's boss to describe the added scope, and mention it to your manager after",
              grade: 'blunder',
              outcome: 'The boss listens and says pay questions start with your manager. Your manager hears about the meeting and is annoyed, and now argues for you less readily.',
              why: 'A skip-level is legitimate, but using it for your own pay removes the person who has to argue for you and signals distrust. Telling them afterward does not undo that.',
            },
          ],
        },
      ],
    },
    {
      prompt: 'You set aside an evening to build the case you will bring to your manager. What do you build it around?',
      approaches: [
        {
          text: 'Build it around the measurable results you have delivered',
          ways: [
            {
              text: 'One page: your three biggest results this year, each with a client, revenue or time-saved figure',
              grade: 'slip',
              outcome: 'Your page is sharp and your manager is impressed. They talk about a strong performance rating and a merit increase, and the added duties barely come up.',
              why: 'Results show you are good but not what the job is worth, so the answer comes out as a performance raise. A change in scope calls for a pay case, not a performance one.',
            },
            {
              text: 'A binder of your reviews, thank-you emails and client compliments from the 18 months',
              grade: 'mistake',
              outcome: 'Your manager flips through it and says it is nice to see so much praise. The volume hides the one change that matters, and the meeting feels like a review of your year.',
              why: 'Volume dilutes. A manager deciding on pay needs one clear reason the pay should change; a pile of praise gives many reasons to say thank you.',
            },
            {
              text: 'Your last two review ratings and a note that you have met every goal you were set',
              grade: 'mistake',
              outcome: 'Your manager agrees you are doing well and says the review process exists for that. The case sounds like every other strong performer and gives them nothing special to take upward.',
              why: 'Meeting goals earns the standard increase. It does not show that the job itself has grown, which is what justifies going beyond the standard.',
            },
          ],
        },
        {
          text: 'Build it around how your role has changed and its market rate',
          ways: [
            {
              text: 'One page: the duties you took over, what changed since, and senior-role pay from two sources',
              grade: 'best',
              outcome: 'Your page lists the reporting and training you absorbed, what improved since, and the senior-level pay range from both sources. It is short enough for your manager to forward.',
              why: 'Benchmarking the job you actually do turns the ask into one about scope, not merit, and a single page travels easily to whoever approves it.',
            },
            {
              text: 'One page: the duties you took over, what changed since, and current-title pay from the same two sources',
              grade: 'slip',
              outcome: 'The page is neat and well sourced. The pay data sits close to what you earn now, so your own page argues for a small step.',
              why: 'Right sources, wrong yardstick. Your current title measures the job you were hired for, not the larger one you do, and anchors the talk low.',
            },
            {
              text: 'A spreadsheet of a dozen similar job postings, with the duties you took over noted beside each',
              grade: 'mistake',
              outcome: 'Your manager sees pay from different companies and sizes, some far lower than others, and picks out the low ones. The postings give them more to argue with than to carry upward.',
              why: 'A big pile of postings invites quibbles over which are comparable. Two sources that fit your role are easier to defend and forward than many that vary.',
            },
          ],
        },
        {
          text: 'Build it around fairness against what similar colleagues are paid',
          ways: [
            {
              text: "Show where you sit in your company's pay band for your level, using the HR guide",
              grade: 'mistake',
              outcome: 'The band for your level tops out only slightly above your pay. Your manager notes you are already near the top of it and says there is little room without a new level.',
              why: 'A band describes the limits of your level, not of the larger job you now do, and it hands your manager a ready reason to say no.',
            },
            {
              text: 'Tell your manager you have heard that teammates at your level earn more, without naming anyone',
              grade: 'mistake',
              outcome: "Your manager says they cannot discuss anyone else's pay and asks who said it. The meeting turns to the rumour instead of your work.",
              why: 'A rumour cannot be checked, and it invites a defence of fairness instead of an assessment of your value.',
            },
            {
              text: 'Share the pay a teammate confided to you and say what you know of their duties, to show the gap',
              grade: 'blunder',
              outcome: 'Your manager is visibly uncomfortable. The teammate is asked about it later and is upset with you, and your manager grows wary of what else you repeat.',
              why: 'It exposes a colleague and breaks a confidence, costing trust with both, whatever the facts. Pay for the work you do should rest on outside data, not a peer\'s secret.',
            },
          ],
        },
      ],
    },
    {
      prompt: "In the meeting you walk through your case. Your manager listens, then asks: 'So what are you looking for?'",
      approaches: [
        {
          text: 'Give a range grounded in your sources, so there is room to meet',
          ways: [
            {
              text: 'Say between $82,000 and $86,000, and walk through which source backs each end',
              grade: 'slip',
              outcome: 'Your manager writes the range down and says they will test the lower end with their boss.',
              why: 'A range invites settling near its bottom. Yours starts above your target, so the harm is small, but a single figure would have kept the reference point higher.',
            },
            {
              text: 'Say between $80,000 and $86,000, from the figure you would accept to the top of your sources',
              grade: 'mistake',
              outcome: 'Your manager says $80,000 sounds workable and will aim for that. It becomes the realistic target for both of you.',
              why: 'People hear the low end of a range, and yours is exactly what you would accept. You handed them a stopping point at your target with no room to trade.',
            },
            {
              text: 'Say between 8 and 12 percent, which is how most raise requests are framed',
              grade: 'mistake',
              outcome: 'Your manager hears 8 percent, about $5,800, and offers to see whether that is possible. The market data you collected goes unmentioned.',
              why: 'A percentage range ties the talk to your current pay instead of the market, and its bottom lands well under your target. It also sets aside the data you gathered.',
            },
          ],
        },
        {
          text: 'Name a single figure and explain the evidence that supports it',
          ways: [
            {
              text: 'Say $84,500, name your two sources, then stop talking and wait for their response to it',
              grade: 'best',
              outcome: 'You say it and the silence feels long. Your manager writes the figure down and says they will take it to their boss.',
              why: 'A specific figure above your target is an anchor with room to settle where you want, and stopping keeps you from bargaining against yourself.',
            },
            {
              text: 'Say $80,000, the figure you would be happy with, name your two sources, then wait for their answer',
              grade: 'slip',
              outcome: 'Your manager notes $80,000 and calls it reasonable. They say they will see whether they can approve most of it.',
              why: 'Naming exactly what you would accept leaves nothing to give, so any compromise lands under your target. Asking a little above it lets a trade still end where you hoped.',
              ifRaised: {
                flag: 'previewed-figure',
                grade: 'mistake',
                outcome: 'You had already said about $80,000 in November, so saying it again made it your ceiling. Your manager came back with a number below it, since it was set before your case was heard.',
                why: 'Floating the figure early and repeating it gave your manager a fixed reference. Anything lower was a concession from your ceiling, not from an opening ask.',
              },
            },
            {
              text: 'Say $84,500, name your two sources, and add that you can be flexible if budgets are tight',
              grade: 'mistake',
              outcome: "Your manager relaxes. 'Good to know, budgets are tight.' The talk turns to what you would take instead of why $84,500 is right.",
              why: 'Offering flexibility in the same breath tells them the figure is soft. A concession is theirs to ask for, not yours to volunteer.',
              raises: ['said-flexible'],
            },
          ],
        },
        {
          text: 'Find out what is realistic this cycle before you name a number',
          ways: [
            {
              text: "Ask what the department's raise budget looks like, then choose a figure that fits it",
              grade: 'mistake',
              outcome: 'Your manager says about 4 percent is typical for the department. You spend the meeting arguing for 5.',
              why: 'It ties you to what the process allows instead of what the role is worth, so you haggle in small steps. Your value case belongs in your figure, not in their limits.',
            },
            {
              text: 'Ask what pay range the company has set for the senior version of your role',
              grade: 'mistake',
              outcome: 'Your manager says the senior band runs $74,000 to $82,000. Your data goes unmentioned, and the top of their band becomes the ceiling.',
              why: 'Their band reflects company policy, not the market data you gathered, and once said it caps the talk. Whoever speaks first usually sets the frame.',
            },
            {
              text: 'Say you would rather hear their proposal first, since they know what the company can do',
              grade: 'blunder',
              outcome: 'Your manager mentions 3 percent as the usual figure. Having asked for their number, you find it awkward to argue for far more.',
              why: 'Handing over the number gives up the one anchor you control. Their default merit figure sits below what the larger scope justifies, and you now argue up from it.',
            },
          ],
        },
      ],
    },
    {
      prompt: "A week later your manager calls you in. 'I got $76,000 approved, effective next month. It is what I could get this cycle. Can I tell HR you are on board?'",
      approaches: [
        {
          text: 'Say yes to the $76,000 and use the goodwill to secure next steps',
          ways: [
            {
              text: 'Accept with thanks and ask for a pay review date, in writing, six months from now',
              grade: 'slip',
              outcome: 'Your manager is glad, confirms the six-month date by email, and tells HR. The $76,000 starts next month and the review date is on file.',
              why: 'A firm raise plus a dated review is sensible, but it closes the gap to your case at the first number. A counter was still open, and accepting ends it.',
            },
            {
              text: 'Accept on the spot and say you will be back for more at the March review',
              grade: 'mistake',
              outcome: 'Your manager tells HR it is settled. In March the answer is that you were only just raised, so the standard increase will be small.',
              why: 'A spoken promise to ask again carries no date or criteria, and a recent raise is an easy reason to wait. You also gave up your leverage in the room.',
            },
            {
              text: 'Accept, and ask what you would need to show to be paid at the senior level next cycle',
              grade: 'mistake',
              outcome: 'Your manager lists a few goals, such as leading a larger account, and it feels fair. Next cycle those goals are the condition, and senior pay is described as something you are working toward.',
              why: 'It concedes that you do not yet earn senior pay, undoing the case that you already do the senior job, and it lets your manager set the criteria.',
            },
          ],
        },
        {
          text: 'Hold your answer for a day, then reply with your own proposal',
          ways: [
            {
              text: 'Thank them, ask for a day, then counter at $82,000 and say it rests on the same senior-role pay data',
              grade: 'best',
              outcome: 'Your manager understands and gives you until tomorrow. You counter at $82,000, tied to your sources, and they say they will go back to their boss.',
              why: 'Pausing keeps you from agreeing under pressure. A counter that moves a little, with a reason, shows good faith and gives your manager a concrete number to carry upward.',
            },
            {
              text: 'Thank them, ask for a day, then restate $84,500 and go back through your whole case',
              grade: 'slip',
              outcome: 'You repeat $84,500 and rerun your case. Your manager says they already made that argument upward and offers to ask once more, though they sound doubtful.',
              why: 'No movement tells your manager you do not see this as a negotiation, and a full replay repeats what they already took upward. A small, reasoned move would have helped them.',
              ifRaised: {
                flag: 'said-flexible',
                grade: 'mistake',
                outcome: 'Your manager reminds you that you said you were flexible and asks why you are holding firm now. Your unchanged number sounds inconsistent, and they offer only a few hundred dollars more.',
                why: 'At the meeting you said you were flexible, so an unchanged number now reads as a shift in position. That earlier softness weakened this stance.',
              },
            },
            {
              text: 'Thank them, ask for a day, then email your manager and HR together with a counter at $82,000',
              grade: 'mistake',
              outcome: 'HR confirms receipt and says pay decisions rest with your manager. Your manager is quietly irritated at being copied on a formal request and argues for you less warmly.',
              why: 'Copying HR formalises a negotiation that is still between you and your manager, and implies you doubt they will carry it fairly. Keep it between you until a figure is agreed.',
            },
          ],
        },
        {
          text: 'Treat the base figure as set and negotiate the rest of the package',
          ways: [
            {
              text: 'Take $76,000 and ask for a one-time bonus for the months you already did the bigger job',
              grade: 'mistake',
              outcome: 'Your manager says a bonus is easy to approve and will try. A bonus arrives, and your base stays at $76,000, which every later raise builds on.',
              why: 'A one-time payment covers the past but leaves base pay, and every future raise built on it, lower. Offering to take it hands them the cheaper option.',
            },
            {
              text: 'Take $76,000 and ask for extra vacation days and a training budget, which cost the department less',
              grade: 'mistake',
              outcome: 'Your manager agrees to a training budget and three extra days. Your base stays at $76,000, and the gap to your sources is harder to raise now that you took other terms.',
              why: 'Perks cost the department less but do not compound like base pay. Taking them at the first number settles the main question for good.',
            },
            {
              text: 'Ask for the senior title now, and agree that the pay change waits until the March review',
              grade: 'blunder',
              outcome: 'Your manager is pleased to give a title for free. The raise waits, you lose four months of the increase you were offered, and in March it arrives from the standard pool.',
              why: 'A title with no pay is the cheapest thing a company can give, and delaying the money forfeits months of the raise already offered. Title should follow pay, not replace it.',
            },
          ],
        },
      ],
    },
  ],
  endings: {
    good: 'Your manager heard you out before the budget closed, carried a one-page case and a clear figure to their boss, and had a counter ready when the first offer came back. You were offered $81,500 in writing. That is close to your target and well above the standard increase.',
    ok: 'Your manager supported you, but the request reached the budget late, came without a firm figure behind it, or you took the first answer. You got an increase of about 6 percent. It helps, though the gap to the senior-level pay you researched is still open, and next year you must start earlier.',
    bad: 'Your manager stayed friendly, but the request never gained force. The money was spent before it got to the table, your figures on record were low or loose, and little was agreed in writing. By spring you have the bigger job at nearly the same pay, with less goodwill.',
  },
}
export default draft
