/**
 * "Write your own": the user describes a situation, the makeScenario action
 * has Claude write a scenario from it, and a first run of it starts at once.
 * The new scenario is private to its author and also appears under "Yours".
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Label, Textarea, useToast } from '@/components/ui'
import { runAction } from './runAction'

const MIN = 10
const MAX = 400

export function WriteYourOwn() {
  const navigate = useNavigate()
  const toast = useToast()
  const [situation, setSituation] = useState('')
  const [busy, setBusy] = useState(false)
  const length = situation.trim().length
  const valid = length >= MIN && length <= MAX

  async function write() {
    setBusy(true)
    try {
      const { scenarioId } = await runAction<{ scenarioId: string }>('makeScenario', { situation })
      const { runId } = await runAction<{ runId: string }>('startRun', { scenarioId })
      navigate(`/run/${runId}`)
    } catch (e) {
      toast.error('Could not write that one', (e as Error).message)
      setBusy(false)
    }
  }

  return (
    <section className="mb-10 rounded-lg border border-border bg-card p-5" data-testid="write-your-own">
      <Label htmlFor="situation" className="text-base font-semibold text-foreground">
        Write your own
      </Label>
      <p className="mt-1 text-sm text-muted-foreground">
        Describe a moment you want to rehearse, like "telling my roommate they owe me rent" or "my first client call
        after a missed deadline".
      </p>
      <Textarea
        id="situation"
        className="mt-3"
        rows={3}
        maxLength={MAX}
        value={situation}
        disabled={busy}
        onChange={(e) => setSituation(e.target.value)}
        placeholder="The situation, in a sentence or two"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Your text is sent to Claude (Anthropic) to write the scenario. Leave out private details. {length}/{MAX}
        </p>
        <Button size="sm" loading={busy} disabled={!valid || busy} onClick={write}>
          {busy ? 'Writing (up to a minute)…' : 'Write and play'}
        </Button>
      </div>
    </section>
  )
}
