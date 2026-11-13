import { api, jsonBody } from './http'
import type { Status } from './results'

export type Assignment = {
  id: number
  createdAt: string
  scenarioId: number
  personaId: number | null
  studentId: string
  assignedBy: string
  archived: boolean
  status: Status
  classId: number | null   // set when a class gave this out
  moduleId: number | null  // set when it came from a module
}

// GET /api/assignments  (a student only sees their own; optional filters)
export const listAssignments = (filters?: { studentId?: string; status?: Status; scenarioId?: number }) => {
  const params = new URLSearchParams()
  if (filters?.studentId) params.set('studentId', filters.studentId)
  if (filters?.status) params.set('status', filters.status)
  if (filters?.scenarioId !== undefined) params.set('scenarioId', String(filters.scenarioId))
  const qs = params.toString()
  return api<Assignment[]>(`/api/assignments${qs ? `?${qs}` : ''}`)
}

// PUT /api/assignments/<id>  (students may only set "in_progress")
export const startAssignment = (id: number) =>
  api<Assignment>(`/api/assignments/${id}`, jsonBody('PUT', { status: 'in_progress' }))

// Educators create an assignment for a real student profile.
// The backend validates the student's role and the referenced scenario.

export const createAssignment = (
  scenarioId: number,
  personaId: number,
  studentId: string
) =>
  api<Assignment>(
    '/api/assignments',
    jsonBody('POST', {
      scenarioId,
      personaId,
      studentId
    })
  )


// Remove an assignment by ASSIGNMENT ID, not scenario ID.
// Only delete test assignments you are authorized to remove.
export const deleteAssignment = (assignmentId: number) =>
  api<void>(`/api/assignments/${assignmentId}`, { method: 'DELETE' })
