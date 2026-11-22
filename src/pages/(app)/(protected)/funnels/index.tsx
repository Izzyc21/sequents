/**
 * /funnels: the list of funnels.
 * Testers see "Start" for each one. Admins also get "Dashboard" and "New funnel".
 */
import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { Button, EmptyState } from '@/components/ui'
import type { Funnel } from '../../../../schemas/funnels-schema'
import { useIsAdmin } from '../../../../features/funnels/useIsAdmin'

export default function FunnelsPage() {
  const { records, status } = useQuery<Funnel>('funnels', { orderBy: 'createdAt', orderDir: 'desc' })
  const { isAdmin } = useIsAdmin()

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Funnels</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? 'Each funnel is a list of steps you want people to get through. Share the Start link with testers.'
              : 'Pick a funnel, follow the steps, and tell the team where you got stuck.'}
          </p>
        </div>
        {isAdmin && (
          <Link to="/funnels/new">
            <Button data-testid="new-funnel">New funnel</Button>
          </Link>
        )}
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">Loading…</p>}
      {status === 'ready' && records.length === 0 && (
        <EmptyState
          title="No funnels yet"
          description={isAdmin ? 'Create the first one.' : 'The team has not published a funnel yet.'}
        />
      )}

      <ul className="space-y-3">
        {records.map((f) => (
          <li
            key={f.recordId}
            data-testid="funnel-row"
            className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{f.data.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {(f.data.steps ?? []).length} steps
                {f.data.description ? ` · ${f.data.description}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link to={`/try/${f.recordId}`}>
                <Button variant="outline">Start</Button>
              </Link>
              {isAdmin && (
                <Link to={`/dashboard/${f.recordId}`}>
                  <Button>Dashboard</Button>
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
