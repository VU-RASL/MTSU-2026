import { api, jsonBody } from './http'

// Voice sessions with the AI patient (backend: realtime_routes.cpp).
// The browser never talks to OpenAI with a key: it sends its WebRTC offer
// here, the backend creates the call with its own key and returns the answer.

export type RealtimeSession = {
  sessionId: string
  status: string
  deadlineAt: string   // ISO time the backend ends the call
  sdp?: string         // OpenAI's WebRTC answer (only when starting)
  conversationId?: string // the saved conversation tree this call adds lines to
}

// POST /api/realtime/session  (students only, for their own assignment)
// requestKey: a random UUID per attempt. Sending the same key again returns
// the same session instead of starting a second call.
export const startRealtimeSession = (assignmentId: number, requestKey: string, sdp: string) =>
  api<RealtimeSession>('/api/realtime/session', jsonBody('POST', { assignmentId, requestKey, sdp }))

// GET /api/realtime/session/<id>
export const getRealtimeSession = (sessionId: string) =>
  api<RealtimeSession>(`/api/realtime/session/${sessionId}`)

// POST /api/realtime/session/<id>/end  (safe to call more than once)
// complete: true when the student pressed "End conversation", which marks the
// attempt and the assignment complete. Leaving the page ends without completing.
export const endRealtimeSession = (sessionId: string, complete = false) =>
  api<RealtimeSession & { completed?: boolean }>(
    `/api/realtime/session/${sessionId}/end`,
    complete ? jsonBody('POST', { complete: true }) : { method: 'POST' }
  )
