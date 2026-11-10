import { supabase } from '../supabase'

// Shared fetch helper. Every backend error looks like {"error": "message"},
// so we turn any non-2xx response into a thrown Error with that message.
// Use relative URLs ("/api/...") so the Vite proxy works.
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(`Could not read the login session: ${error.message}`)
  }

  const headers = new Headers(options?.headers)
  headers.delete('Authorization')
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const res = await fetch(url, { ...options, headers })

  // DELETE returns 204 with no body.
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`)
  }
  return data as T
}

export function jsonBody(method: 'POST' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
