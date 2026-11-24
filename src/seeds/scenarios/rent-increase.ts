import type { ScenarioDraft } from '../../features/play/types'

const draft: ScenarioDraft = {
  id: 'starter-rent-increase',
  title: 'Your landlord raises the rent 15% at renewal',
  situation:
    "My landlord says my rent goes up 15% when my lease renews in 60 days, and I'm not sure what my options are.",
  setting:
    "You have rented a one-bedroom in a small building for three years, always on time, at $1,600 a month. The owner runs it himself. A letter dated three days ago offers a 12-month renewal at $1,840, a 15% increase, and asks for your answer within three weeks. Your current lease ends in 60 days. You would like to stay, but money is tight. You haven't replied to him yet.",
  flags: [
    { id: 'lease-gaps', label: "You never read your lease's renewal and holdover terms" },
    { id: 'loose-comps', label: "Your rent comparisons weren't tight like-for-like" },
  ],
  decisions: [
    {
      prompt:
        'The letter is on your kitchen table and the landlord has said nothing else. How do you start?',
      approaches: [
        {
          text: 'Answer him promptly, while things are friendly and he is waiting to hear from you',
          ways: [
            {
              text: 'Email him a brief note saying you got the letter and will answer by a date you name',
              grade: 'slip',
              outcome:
                "He replies with a thumbs-up and says he'll wait for your answer. The date you named is now one you have to keep.",
              why: 'Naming a date before you have read the lease can box you in, and it shows you are engaging before you have a position. The cost is small but real.',
            },
            {
              text: 'Call him, say how much you like living there, and ask whether there is any room on the number',
              grade: 'mistake',
              outcome:
                "He says he's glad you like it, that costs are up all around, and that 15% is the number. You hang up on friendly terms, with nothing on paper.",
              why: 'Saying you like living there tells him you will not leave, which is your main leverage, and a call leaves no record of what either of you said.',
            },
            {
              text: 'Email that 15% is more than you can manage and that you may have to look at other places',
              grade: 'mistake',
              outcome:
                "He replies the next day that he understands and will think about who else might want the unit. Neither of you has named a number.",
              why: 'A warning with no lease facts or evidence behind it shows your hand early and gives him a reason to start planning for your vacancy.',
            },
          ],
        },
        {
          text: 'Start from the paperwork: the lease and the letter, and what each says about timing',
          ways: [
            {
              text: "Read the lease's renewal, notice and holdover clauses, then check how and when the letter reached you against them",
              grade: 'best',
              outcome:
                'Your lease says that if nobody signs you become month-to-month at a higher holdover rate, and that a rent change needs written notice by hand or mail. His letter was mailed and arrived in time.',
              why: 'The lease sets your real deadlines and your fallback if nobody signs, and a rent change has to reach you a certain way. Knowing both keeps every later move on facts.',
            },
            {
              text: "Read the lease's end date and your own notice requirement, then set calendar reminders for each deadline",
              grade: 'slip',
              outcome:
                "You owe 30 days' written notice if you leave, and the lease ends in 60 days. You set reminders for both and the reply date, and feel organized.",
              why: "Your own notice duty is only half of it. What the lease says if nobody signs, and what he must do to change the rent, decide your fallback and whether his letter counts.",
              raises: ['lease-gaps'],
            },
            {
              text: 'Gather your payment history, repair requests and photos of the unit into one folder, and skim the lease for rent terms',
              grade: 'mistake',
              outcome:
                'You end up with a neat folder of receipts, repair emails and photos. The rent pages say nothing about the renewal, and you move on without knowing your deadlines.',
              why: 'A folder of evidence helps in a dispute, not at a renewal. It tells you nothing about deadlines, your fallback or whether his letter was valid, and a skim for rent terms misses all three.',
              raises: ['lease-gaps'],
            },
          ],
        },
        {
          text: 'Start from the market: what similar places cost and what you could do instead',
          ways: [
            {
              text: 'Spend the weekend viewing four comparable places and note their rents, fees and move-in dates',
              grade: 'mistake',
              outcome:
                'You see four decent places, all a bit farther out. Two agents say they can hold a unit for a few days if you apply. The weekend is gone.',
              why: 'Viewing places before you know your deadlines or your rent gap spends a weekend on options you cannot weigh yet, and agents will treat you as ready to apply.',
            },
            {
              text: 'Apply to the two best of them so you have approvals in hand before you reply to him',
              grade: 'mistake',
              outcome:
                'You pay two application fees and both run a credit check. One approves you within days, with an offer that expires in a week.',
              why: 'Applications cost fees and credit checks, and approvals lapse within days. You spend money on a fallback before you know whether you would use it.',
            },
            {
              text: 'Put down a holding deposit on the best of them so it stays available while you decide',
              grade: 'blunder',
              outcome:
                'The agent takes the deposit and holds the unit for ten days. When you ask about getting it back, you learn it is forfeited if you change your mind.',
              why: 'Holding deposits are often non-refundable, so you pay real money to hold a place you may never take. A fallback is only useful if it is cheap to drop.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'A few days later you decide to push back on the increase rather than accept it. What do you want your case to rest on?',
      approaches: [
        {
          text: 'Show him it costs less to keep you than to replace you',
          ways: [
            {
              text: 'Add up what a vacancy would cost him in empty weeks, cleaning and listing, and show a small increase beats losing you',
              grade: 'slip',
              outcome:
                'You work out that two empty months plus cleaning and listing fees would cost him more than a full year of your extra rent. It reads as sound arithmetic.',
              why: 'The turnover cost is real, but he can answer that he will re-let at market. It supports a case; it does not replace evidence of what the unit is worth.',
            },
            {
              text: 'Cite your three years of on-time rent and no complaints, and ask for $1,680 on the strength of that record',
              grade: 'mistake',
              outcome:
                'He agrees your record is spotless and writes that it is appreciated. He adds that rents everywhere are going up and does not move off $1,840.',
              why: 'A good record is expected of a tenant, so it is supporting evidence and not the case. A number backed only by goodwill gives him nothing to agree to.',
            },
            {
              text: 'Offer to take over some upkeep, such as the hallway and minor fixes, in return for a lower rent',
              grade: 'mistake',
              outcome:
                'He likes the idea and says he will think it over. The rent talk drifts, and nobody has said what the upkeep would be worth.',
              why: 'Informal upkeep deals blur who is responsible, can conflict with the lease or his insurance, and put a value on your labor that he sets. The rent should rest on the market.',
            },
          ],
        },
        {
          text: 'Show him what similar apartments nearby are renting for',
          ways: [
            {
              text: 'Take the three closest listings, adjust each for parking, utilities and floor, and note how long each has sat',
              grade: 'best',
              outcome:
                'Adjusted, your three closest comparisons land between about $1,700 and $1,760. One of them cut its asking rent after sitting for several weeks.',
              why: 'Close, adjusted matches are hard to wave away, and time on the market shows what owners really get, since an asking rent is only a hope. A few checkable comps beat a big pile.',
            },
            {
              text: 'Gather about a dozen listings across the neighborhood, adjust each for the same extras, and give their median',
              grade: 'slip',
              outcome:
                'Your median comes out near $1,745, with a few listings of very different size and age mixed in. It looks thorough.',
              why: 'A bigger pool includes units unlike yours, and each one is something he can knock out. A few close comparisons are harder to dispute than a median of many.',
              raises: ['loose-comps'],
            },
            {
              text: 'Quote what a friend pays two streets over for a similar one-bedroom, since it is a signed lease and not an ask',
              grade: 'mistake',
              outcome:
                'She pays $1,560 on a lease signed two years ago. It is a real rent, and it sits well below every listing you found.',
              why: 'One old lease he cannot verify, from a unit he cannot inspect, is easy to dismiss. A real rent only counts as evidence when it is recent and comparable.',
              raises: ['loose-comps'],
            },
          ],
        },
        {
          text: 'Show him what you can pay and why a smaller increase still works for him',
          ways: [
            {
              text: 'Show that $1,840 would take more than the common 30% of your income and ask him to stay inside that guideline',
              grade: 'mistake',
              outcome:
                'Your numbers are clear. He answers that the guideline is for budgeting, not for pricing his unit, and that $1,840 stands.',
              why: 'Affordability is your problem, not a fact about his unit. A guideline about your income gives him no reason to charge less than the market.',
            },
            {
              text: 'Propose phasing it in, half the increase now and the rest in six months, so it is easier to absorb',
              grade: 'mistake',
              outcome:
                'He says that is fine. $1,720 applies for six months, then the full $1,840 from month seven.',
              why: 'A phase-in accepts the full 15% and only changes when you pay it. You bargained over timing before you bargained over the number.',
            },
            {
              text: 'Tell him the highest rent you could manage and ask him to meet you at that number',
              grade: 'blunder',
              outcome:
                "He thanks you for being straight with him and says he'll see what he can do around that figure.",
              why: 'Naming your ceiling tells him where you would stop, so he can aim for it. The top of what you would accept is the one number never to reveal.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'Ten days after the letter, you have a case and a target number. The landlord has said nothing more, and about seven weeks of lease remain. What is your move?',
      approaches: [
        {
          text: 'Talk to him first, in person or by phone, and put what you settle in writing afterward',
          ways: [
            {
              text: 'Call him to float $1,680 for 18 months, then email the same terms with two comps within the hour',
              grade: 'slip',
              outcome:
                'He listens, says a longer lease interests him, and asks you to send it over. The email goes out before lunch.',
              why: 'On a call he reacts to your number before he has seen your evidence, and his first answer sets the frame. Putting the proposal in writing first keeps your terms as the starting point.',
            },
            {
              text: 'Knock on his door, say you want to stay, and agree to settle the numbers over coffee next week',
              grade: 'mistake',
              outcome:
                "He is warm and says 'we'll work something out.' Nothing about rent or term is in writing, and you leave without a number he has agreed to.",
              why: "A friendly agreement in principle, with no number, is not an agreement. Your evidence never reached him, and 'something' will be whatever he decides later.",
            },
            {
              text: 'Phone him to say you are also looking at other places, so he knows you have options, and ask what he can do',
              grade: 'mistake',
              outcome:
                "He says you're free to look and that he'll know soon enough what the unit is worth. He names no number and the call ends cooler than it began.",
              why: 'Mentioning other places invites him to call it a bluff, and if it is real it warns him a vacancy may be coming. With no number and nothing in writing, it only raises his guard.',
            },
          ],
        },
        {
          text: 'Open with a written counteroffer that sets out your number and your reasons',
          ways: [
            {
              text: 'Email one counter, $1,680 for an 18-month lease, attach two adjusted comps, and ask for a reply by a set date',
              grade: 'best',
              outcome:
                "He writes back that 18 months interests him but he'd rather keep 12 for now, and that he'll look at the comps and come back with a number.",
              why: 'One number with one trade he values is easy to say yes to. An opener a little below your target leaves room to settle, and the reply date keeps it moving.',
            },
            {
              text: 'Email $1,680 for 18 months with two comps, plus fresh paint, the leaky tap fixed and a cap on the next increase',
              grade: 'slip',
              outcome:
                'He answers that he will consider the rent and the term and look at the list. He takes four days to reply.',
              why: 'Piling extra asks onto the counter blurs the trade: he can say yes to the term and no to the rest, or read it as a wish list. One number for one trade is easier to accept.',
              ifRaised: {
                flag: 'loose-comps',
                grade: 'mistake',
                outcome:
                  'Within the hour he answers: half the units in your list are bigger or newer, the median is pulled down by outliers, and the extras read as a wish list. The thread is now about your evidence, not your offer.',
                why: 'The loose comparison from decision 2 gave him a reason to dismiss your number, and the long list of asks made the whole counter easy to wave off.',
              },
            },
            {
              text: 'Email $1,740, the middle of the range you found, and say you will sign right away if he agrees',
              grade: 'mistake',
              outcome:
                "He replies that $1,740 is a number he can work with and that he'll confirm the details soon.",
              why: 'Opening at the middle leaves nowhere to go: every concession after it comes out of your pocket. An opener should sit under your target so the settlement lands where you want it.',
            },
          ],
        },
        {
          text: 'Let the calendar do some work: time your move to his deadline and your lease\'s end',
          ways: [
            {
              text: 'Send your counter on the last day of his window, so he has little time to dig in',
              grade: 'mistake',
              outcome:
                'He answers that his window has closed and $1,840 now stands. After two days of back and forth he agrees to talk, but the early weeks are lost.',
              why: 'Waiting hands him the calendar. Your counter lands just as his own deadline passes, and time pressure falls mostly on whoever has a lease ending: you.',
            },
            {
              text: 'Send written notice that you will not renew, to protect your deadline, and say you would reconsider at a fair rent',
              grade: 'blunder',
              outcome:
                "He acknowledges the notice and says he'll start showing the unit. Whether you can take it back is now up to him.",
              why: 'Written notice you cannot simply withdraw is a real decision, not a bargaining chip. He can hold you to it and line up a replacement while you negotiate from weaker ground.',
            },
            {
              text: 'Let the lease run out unsigned and stay month-to-month while you look around and keep talking',
              grade: 'blunder',
              outcome:
                "Nothing happens until the lease ends. Then the bill arrives at the holdover rate, and he notes that either of you can now end the tenancy on 30 days' notice.",
              why: 'A lease that runs out unsigned often turns month-to-month at a holdover rate, and either side can usually end it on short notice. You trade a fixed rent and security for a little time.',
            },
          ],
        },
      ],
    },
    {
      prompt:
        'Three weeks in, the landlord has settled at $1,740 for a 12-month renewal and wants a yes by Friday, three days away, or he will list the unit. A similar one-bedroom listed at $1,590 is 25 minutes farther from work; you have only seen the listing. Moving would cost you about $2,500 all in.',
      approaches: [
        {
          text: 'Try for a better number once more before the deadline',
          ways: [
            {
              text: 'Counter at $1,700 for 12 months and offer to sign the same day if he agrees',
              grade: 'mistake',
              outcome:
                "He answers that $1,740 was the last move he'd make and that Friday still stands. You take it, a little worse for the exchange.",
              why: 'He has already come down $100 from his first number. Pushing again at the deadline risks a settled deal for $40 a month.',
            },
            {
              text: 'Say yes to $1,740 and, in the same email, ask for next year\'s increase to be capped',
              grade: 'mistake',
              outcome:
                'He replies that a cap is not something he does and that your message reads as a counter. He asks whether $1,740 is a yes or a no.',
              why: 'A yes with a new condition attached is practically a counteroffer, so it can undo the offer you meant to accept. Raise the cap separately, at signing or the next renewal.',
            },
            {
              text: 'Show him the $1,590 listing and ask him to match it, saying you would rather stay but the gap is real',
              grade: 'blunder',
              outcome:
                "He answers that you're free to take the other place and begins listing the unit. The $1,740 offer is off the table.",
              why: 'A listing you have only seen online is not an offer, and with $2,500 in moving costs your walk-away is not credible. Asking him to match it at the deadline risks the deal you have.',
            },
          ],
        },
        {
          text: 'Say yes in writing before his Friday deadline',
          ways: [
            {
              text: 'Reply yes in writing today and ask for a one-page extension of your current lease that changes only rent and term',
              grade: 'best',
              outcome:
                'He agrees to a one-page extension: new rent, new end date, everything else as in your current lease. You both sign Thursday, and nothing new has slipped in.',
              why: 'Every new clause in a fresh form is something to find and argue over under a deadline. An extension changes only rent and term, so your existing protections carry over untouched.',
            },
            {
              text: 'Reply yes in writing today, ask for the new lease, and compare it with your current lease line by line',
              grade: 'slip',
              outcome:
                'The form arrives Thursday evening. You read it against the old lease, catch a new $20 monthly package fee, and he drops it when you ask. You sign Friday with an hour to spare.',
              why: 'Comparing can work, but it leaves you hunting for changes against the clock and winning each one. The extension avoids the changes in the first place.',
              ifRaised: {
                flag: 'lease-gaps',
                grade: 'mistake',
                outcome:
                  'The form arrives Thursday evening. You check the rent and dates and sign Friday. Later you see the notice period went from 30 to 60 days and the lease now renews automatically, plus a $20 monthly package fee.',
                why: "You never read your lease's renewal terms in decision 1, so under Friday's deadline you did not know to look for a longer notice period and auto-renewal.",
              },
            },
            {
              text: 'Tell him you will confirm once you have read the renewal lease, and ask him to send it today',
              grade: 'mistake',
              outcome:
                'Friday passes without a yes from you. On Saturday he writes that he has had two viewing requests and that the offer is now $1,775.',
              why: 'A yes that waits on the paperwork is not a yes in his eyes. If the form is late or your reading is slow, the deadline passes with nothing agreed. Lock the number first.',
            },
          ],
        },
        {
          text: 'Use the three days to see whether the other place beats this',
          ways: [
            {
              text: 'Ask him in writing for until Monday, saying you want to see the other place before you sign',
              grade: 'slip',
              outcome:
                'He agrees to Monday but says he will list the unit that morning if he has not heard. The other place turns out to be a floor lower and noisier, and you say yes on Monday.',
              why: 'More time is cheap to ask for, but it tells him you are comparing, and he can refuse or list on Monday. A listing is not an offer, so the extra days rarely produce a real alternative.',
            },
            {
              text: 'Tour the other place Thursday, then give him your answer Friday morning',
              grade: 'mistake',
              outcome:
                'The tour goes well, but the other place wants an application, a credit check and a week to approve. On Friday morning you say yes, and he mentions two viewing requests.',
              why: 'A place you have only seen advertised is not yet an option: you would still need an application, approval and a signed lease. Touring gave you nothing you could act on by Friday.',
            },
            {
              text: 'See the other place and two more over the next three days, and decide once you have the full picture',
              grade: 'blunder',
              outcome:
                'Friday passes while you tour a third place. On Saturday he lists the unit at $1,840, and the $1,740 offer is gone unless he chooses to bring it back.',
              why: 'Letting a deadline pass to widen your search can cost the one concrete offer in hand for places you have not applied to or been approved for. Hold the real offer until a real alternative exists.',
            },
          ],
        },
      ],
    },
  ],
  endings: {
    good: "You renew at $1,740 for twelve months, about 9% above your old rent instead of 15%, on paper that changes nothing else. You knew your own deadlines and fallback from the start, and you never handed him a number or a notice you couldn't take back. You keep the place and about $1,200 over the year.",
    ok: "You stay, but on a price or paper you could have bettered. Either the rent landed higher than your case justified, or a changed clause or a new fee came along with the renewal, or you spent time and money on options you did not need.",
    bad: "The negotiation slipped out of your hands. You showed your limits, gave a notice or a date you couldn't take back, or let his deadline pass. You end up paying close to the full 15%, signing paper you never read, or spending your savings to move for less than it cost.",
  },
}
export default draft
