/**
 * /team: admins promote people to admin (the team) or back to member (tester).
 *
 * Uses DeepSpace's built-in role system: useUsers().setRole. The server refuses
 * the change unless the caller is already an admin, so this page cannot be
 * abused by a member even if they reach it.
 */
import { useAuth, useUsers } from 'deepspace'
import { Badge, Button } from '@/components/ui'
import { useIsAdmin } from '../../../features/funnels/useIsAdmin'

export default function TeamPage() {
  const { isAdmin, isLoading } = useIsAdmin()
  const { users, usersLoaded, setRole } = useUsers()
  const { userId } = useAuth()

  if (isLoading) return null
  if (!isAdmin) return <p className="px-6 py-10 text-sm text-muted-foreground">Only admins can manage the team.</p>

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-foreground">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Admins see every tester's reports and can create funnels. Everyone else is a tester.
      </p>
      {!usersLoaded && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      <ul className="mt-6 space-y-2">
        {users.map((u) => (
          <li key={u.id} data-testid="team-row" className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{u.name || u.email || u.id}</p>
              {u.email && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={u.role === 'admin' ? 'info' : 'secondary'}>{u.role === 'admin' ? 'Team' : 'Tester'}</Badge>
              {u.id !== userId && (
                <Button size="sm" variant="outline" onClick={() => setRole(u.id, u.role === 'admin' ? 'member' : 'admin')}>
                  {u.role === 'admin' ? 'Make tester' : 'Make team'}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
