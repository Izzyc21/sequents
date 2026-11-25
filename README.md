# sequents

Rehearse a hard everyday moment before it happens. A scenario is four decisions. At each one you first commit to one of three approaches, then pick one of three ways to carry it out. When the run ends you look back at what happened at each decision, without a score, and can rewind any decision to try a different choice (the later choices stay as you played them). Asking for the exact score opens the debrief: your score, every point you lost, the single biggest fix, how many of the possible paths you beat and how your choices narrowed what came next. Two runs can be compared side by side from there.

Two scenarios are illustrated with flat pictures drawn in HTML, CSS and SVG (`src/features/frames/`), one per decision, every word in them real text. In each, at least one decision turns on a detail only the pictures show. The password email scenario has two hidden versions whose text is identical, a real IT notice and an attack; the server picks one at random when a run starts, a rewind keeps it, and only the pictures tell them apart. Each picture also shows, in thought bubbles, what the people around you think but do not say; in the password email scenario these are the same in both versions.

Live app: https://sequents.app.space

Source: https://github.com/Izzyc21/sequents

Built on the [DeepSpace SDK](https://docs.deep.space): Cloudflare Workers, a Vite + React frontend and a Hono worker. It uses DeepSpace records, server actions, auth and `useQuery` live sync; the scenario writer (switched off, see below) calls `createDeepSpaceAI`.

## How a run is scored

- The score starts at 100. Every way has a hidden grade: best 0, slip -5, mistake -12, blunder -20 (lowest score 20; 90+ is good, 70+ is ok, anything lower is bad).
- Some choices raise a flag that makes a later choice play worse (a delayed consequence).
- The reason a choice cost points unlocks only after you have finished runs with two different choices at that decision.
- Six built-in scenarios ship with the app.

## Run it locally

Requires Node `>=22.15.0 <23`, `>=24 <25` or `>=26 <27`, and npm `>=11.6.0` (from `engines` in `package.json`).

```
npm install
npm run login        # deepspace auth login
npm run dev          # deepspace dev start
```

Other scripts:

```
npm run build        # vite build
npm run lint         # eslint .
npm run type-check   # tsc --noEmit
npm run test:unit    # vitest run --passWithNoTests
npm run test         # deepspace test run (all Playwright suites)
npm run test:smoke   # deepspace test run smoke
npm run test:api     # deepspace test run api
npm run test:e2e     # deepspace test run e2e
npm run validate     # tsc --noEmit && vitest run
npm run verify       # build, type-check, lint and unit tests (REQUIRE_BUNDLE=1)
```

`deepspace dev kill` stops the local dev server and any leftover workerd processes. `bundle.test.ts` scans the built client, so run `npm run build` before `npm run test:unit` to include it; `npm run verify` does this in order.

## Project layout

```
worker.ts                      Worker entry (Hono app, DeepSpace record rooms)
wrangler.toml                  Worker and asset configuration
src/
  schemas.ts                   Registers every collection
  schemas/                     One file per collection
    scenarios-schema.ts          readable half of a scenario
    scenario-answers-schema.ts   hidden half of a scenario
    runs-schema.ts               one play-through
    generations-schema.ts        ledger of AI calls (daily caps)
    users-schema.ts, admin-schema.ts
  actions/                     Server actions, POST /api/actions/<name>
    play.ts                      seedStarters, startRun, commit, choose, rewind, explain; SEED_VERSION
    generate.ts                  makeScenario (the AI scenario writer)
    visibility.ts                setVisibility, unpublish
    shared.ts                    parsing, loaders, canPlay
  features/play/
    engine.ts                    scoring, replay, path analysis, biggest fix, scenario checks
    types.ts                     shared types, constants, WRITING_ENABLED
    labels.ts, runAction.ts      labels; browser helper that calls the actions
    WriteYourOwn.tsx             the writer's input box (hidden while writing is off)
  features/frames/             the pictures: drawing kit, one file per illustrated
                               scenario, registry.ts maps scenario and version to its pictures
  seeds/
    starters.ts                  the six built-in scenarios
    variants.ts                  hidden versions (the password email's second version)
    scenarios/                   one file each: angry-customer, group-project,
                                 phishing, raise, rent-increase, wifi-deadline
  pages/
    index.tsx                    landing page
    (app)/(protected)/home.tsx   /home: recent runs and the scenario gallery
    (app)/(protected)/run/[id].tsx      /run/:id: commit, choose, look back, hint, debrief, rewind
    (app)/(protected)/compare/[id].tsx  /compare/:id: two runs side by side
  server/                      action, HTTP and realtime routes
tests/                         Playwright suites: sequents.spec.ts (two-user play,
                               rewind, compare, privacy), generate.spec.ts,
                               smoke.spec.ts, api.spec.ts, collab.spec.ts
bundle.test.ts                 scans the built client for any hidden scenario text
src/**/*.test.ts               unit tests next to the code (engine, actions, schemas)
```

## Key design

- Each scenario is split in two. The readable half (`scenarios`) holds the situation, the decisions and the option texts. The hidden half (`scenario_answers`) holds every way's grade, outcome and reason, the flags and the endings. No browser role can read or write `scenario_answers`, so the answers never reach the client; only server actions open it. `bundle.test.ts` and `tests/sequents.spec.ts` check that hidden text appears in no bundle, HTTP response or WebSocket frame before a run ends.
- Moves are validated and scored on the server. `commit` stores the approach on the run, `choose` accepts only a way inside the committed approach, and the last choice scores the run using `scoreRun` from `engine.ts`. The browser cannot write runs.
- `SEED_VERSION` in `src/actions/play.ts` governs built-in scenario updates. The `seedStarters` action writes each starter's answers under an id that includes the version (`<scenario>@v<N>`). Change any starter text, then bump `SEED_VERSION` so the rows are rewritten. A run keeps the answers it started with. A scenario with hidden versions keeps one readable row, identical for every version, and one answers row per version (`<scenario>@v<N>.<n>` for version n above 0), and the seed never writes an older version over a newer one.
- The AI scenario writer (`makeScenario` in `src/actions/generate.ts`) is switched off with `WRITING_ENABLED = false` in `src/features/play/types.ts`. While it is false, `makeScenario` refuses before any AI call, publishing is refused, other players' scenarios cannot be played, and the home page hides the write box. The writer and its checks stay in the code and in the unit tests.
