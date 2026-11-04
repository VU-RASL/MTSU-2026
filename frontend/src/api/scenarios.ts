import { api } from './http'

export type Scenario = {
  id: number
  createdAt: string
  title: string
  difficulty: string
  estimatedTime: number
  summary: string
  setting: string
  patientSituation: string
  instructions: string
  learningObjectives: string[]
  requiredTasks: string[]
}

// GET /api/scenarios
export const listScenarios = () => api<Scenario[]>('/api/scenarios')