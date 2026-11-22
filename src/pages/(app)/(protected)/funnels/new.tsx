/**
 * /funnels/new: admin-only form to create a funnel.
 * Non-admins see a message instead. Even if someone bypassed this page, the
 * server would refuse the write: only `admin` has create on `funnels`.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutations } from 'deepspace'
import { Button, Input, Label, Textarea, useToast } from '@/components/ui'
import type { Funnel, FunnelStep } from '../../../../schemas/funnels-schema'
import { newStepId } from '../../../../features/funnels/stats'
import { useIsAdmin } from '../../../../features/funnels/useIsAdmin'

/** Pre-filled with DeepSpace's own onboarding so the demo starts useful. */
const STARTER_STEPS: FunnelStep[] = [
  { id: newStepId(), title: 'Install Node and npm', hint: 'Node 22.15+ and npm 11.6+' },
  { id: newStepId(), title: 'Scaffold an app', hint: 'npm create deepspace@latest my-app' },
  { id: newStepId(), title: 'Sign in to the CLI', hint: 'npx deepspace auth login' },
  { id: newStepId(), title: 'Run it locally', hint: 'npx deepspace dev start' },
  { id: newStepId(), title: 'Deploy', hint: 'npx deepspace deploy' },
]

export default function NewFunnelPage() {
  const { isAdmin, isLoading } = useIsAdmin()
  const { createConfirmed, ready } = useMutations<Funnel>('funnels')
  const navigate = useNavigate()
  const { error } = useToast()
  const [name, setName] = useState('DeepSpace first deploy')
  const [description, setDescription] = useState('From zero to a live app.space URL.')
  const [steps, setSteps] = useState<FunnelStep[]>(STARTER_STEPS)
  const [saving, setSaving] = useState(false)

  if (isLoading) return null
  if (!isAdmin) {
    return <p className="px-6 py-10 text-sm text-muted-foreground">Only the team (admins) can create funnels.</p>
  }

  const update = (id: string, patch: Partial<FunnelStep>) =>
    setSteps((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const move = (index: number, by: number) =>
    setSteps((all) => {
      const next = [...all]
      const [item] = next.splice(index, 1)
      next.splice(index + by, 0, item)
      return next
    })

  async function save() {
    const clean = steps.filter((s) => s.title.trim() !== '')
    if (!name.trim() || clean.length === 0) {
      error('Add a name and at least one step')
      return
    }
    setSaving(true)
    try {
      // Confirmed create: we only navigate once the server has accepted it.
      const id = await createConfirmed({ name: name.trim(), description: description.trim(), steps: clean })
      navigate(`/dashboard/${id}`)
    } catch (e) {
      error('Could not create the funnel', String(e))
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">New funnel</h1>
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Steps, in order</p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2 rounded-md border border-border p-3">
                <span className="mt-2 w-5 text-sm text-muted-foreground">{i + 1}.</span>
                <div className="flex-1 space-y-2">
                  <Input aria-label={`Step ${i + 1} title`} value={s.title} onChange={(e) => update(s.id, { title: e.target.value })} />
                  <Input
                    aria-label={`Step ${i + 1} hint`}
                    placeholder="Hint for testers (optional)"
                    value={s.hint ?? ''}
                    onChange={(e) => update(s.id, { hint: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</Button>
                  <Button variant="ghost" size="sm" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSteps((all) => all.filter((x) => x.id !== s.id))} aria-label="Remove step">✕</Button>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="outline" className="mt-2" onClick={() => setSteps((all) => [...all, { id: newStepId(), title: '' }])}>
            Add step
          </Button>
        </div>

        <Button data-testid="save-funnel" disabled={!ready || saving} onClick={save}>
          {saving ? 'Saving…' : 'Create funnel'}
        </Button>
      </div>
    </div>
  )
}
