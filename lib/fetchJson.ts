'use client'

/**
 * fetch() for the app's own JSON APIs, hardened for the iOS-PWA reality:
 * - a 401 means the session went stale while the app slept — reload the page
 *   so the middleware refreshes the session (or routes to login) by itself
 * - a non-JSON body (proxy error page, deploy switch-over) becomes a friendly
 *   retry message instead of Safari's "string did not match" riddle
 */
export async function fetchJson<T = Record<string, unknown>>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error("You're offline — check your connection and try again.")
  }
  const res = await fetch(input, init)
  const data = await res.json().catch(() => null)

  if (res.status === 401) {
    window.location.reload()
    throw new Error('Session expired — refreshing…')
  }
  if (!res.ok || data === null) {
    throw new Error(
      (data as { error?: string } | null)?.error ?? 'Something hiccuped. Give it a second and try again.'
    )
  }
  return data as T
}
