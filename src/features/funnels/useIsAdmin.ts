/**
 * True when the signed-in user has the admin role in this app.
 * The app owner is always admin (DeepSpace pins it at connect time).
 *
 * This only decides what the UI SHOWS. What a user can actually read or write
 * is enforced by the permissions in src/schemas/, on the server.
 */
import { useUser } from 'deepspace'

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, isLoading } = useUser()
  return { isAdmin: user?.role === 'admin', isLoading }
}
