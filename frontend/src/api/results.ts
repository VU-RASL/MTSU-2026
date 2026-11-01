import { api, jsonBody } from './http'

export type Status = 'assigned' | 'in_progress' | 'completed' | 'reviewed'

export type TranscriptLine = { role: 'student' | 'patient'; text: string }

export type Result = {
  id: number
  assignmentId: number
  studentId: string
  createdAt: string
  transcript: TranscriptLine[]
  autoScore: Record<string, unknown> | null
  educatorScore: number | null
  educatorFeedback: string | null
  reviewedBy: string | null
  reviewedAt: string | null
}

// GET /api/assignments/<id>/results  (oldest attempt first)
export const listResults = (assignmentId: number) =>
  api<Result[]>(`/api/assignments/${assignmentId}/results`)

// PUT /api/results/<id>/review  (educator only; sets assignment to "reviewed")
export const reviewResult = (
  resultId: number,
  educatorScore: number,
  educatorFeedback: string
) =>
  api<Result>(
    `/api/results/${resultId}/review`,
    jsonBody('PUT', { educatorScore, educatorFeedback })
  )

// POST /api/assignments/<id>/results  (student saves a practice attempt;
// sets the assignment to "completed"). studentId comes from the assignment.
export const saveAttempt = (
  assignmentId: number,
  transcript: TranscriptLine[],
  autoScore?: Record<string, unknown>
) =>
  api<Result>(
    `/api/assignments/${assignmentId}/results`,
    jsonBody('POST', autoScore ? { transcript, autoScore } : { transcript })
  )
