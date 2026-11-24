/**
 * Calls a server action (src/actions) as the signed-in user.
 *
 * Actions answer `{ success: true, data }` or `{ success: false, error }`;
 * this returns `data` or throws an Error carrying the message to show.
 */
import { getAuthToken } from 'deepspace'

type Answer<T> = { success: true; data: T } | { success: false; error?: string }

export async function runAction<T = Record<string, unknown>>(
  name: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Your session ended. Sign in again to continue.')
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const body = (await res.json().catch(() => null)) as Answer<T> | { error?: string } | null
  if (body && 'success' in body && body.success) return body.data
  throw new Error(body?.error || `Something went wrong (${res.status}). Try again.`)
}
