// Shared fetch helper. Every backend error looks like {"error": "message"},
// so we turn any non-2xx response into a thrown Error with that message.
// Use relative URLs ("/api/...") so the Vite proxy works.
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)

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
