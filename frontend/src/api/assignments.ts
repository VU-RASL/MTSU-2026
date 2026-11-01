import { api, jsonBody } from './http'
import type { Status } from './results'

export type Assignment = {
  id: number
  createdAt: string
  scenarioId: number
  studentId: string
  assignedBy: string
  status: Status
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
