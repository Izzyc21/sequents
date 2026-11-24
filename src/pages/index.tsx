/**
 * Landing page, a STATIC page.
 *
 * It lives at the top level of src/pages/ (not under (app)/), so it renders
 * with no DeepSpace providers: no auth session fetch, no records WebSocket.
 * Top-level pages are prerendered to static HTML at build (prerender.ts), so
 * keep it renderable without a browser. `<Seo>` comes first and reads src/seo.ts.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { APP_NAME } from '../constants'
import { seo } from '../seo'

const STEPS = [
  { title: 'Play', text: 'Pick a scenario: asking for a raise, an angry customer on the phone, a rent increase. Make five decisions and watch three meters move.' },
  { title: 'Read the debrief', text: 'See how it ended, how each pick played out and why, and which decision moved things the most.' },
  { title: 'Rewind and compare', text: 'Go back to any decision, choose differently, and see both runs side by side: where they split and how far apart they ended.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">{APP_NAME}</p>
        <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Rehearse a hard moment, then replay it
        </h1>
        <p className="mb-10 max-w-lg text-muted-foreground">
          Practise the conversation before it happens. Every choice moves the outcome, and you can always go back and try
          another way.
        </p>
        <ol className="mb-10 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-lg border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step {i + 1}</p>
              <h2 className="mt-1 font-semibold text-foreground">{step.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <Link
          to="/home"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Start playing
        </Link>
      </div>
    </>
  )
}
