
export type PracticeModule = {
  id: number
  name: string
  scenarioId: number
  personaId: number
}

export type Student = {
  id: string
  name: string
}

export type ClassGroup = {
  id: string
  courseCode: string
  section: string
  studentIds: string[]
}

export type ModuleAssignment = {
  id: number
  moduleId: number
  classId: string
  studentId: string
  status: 'assigned' | 'in_progress' | 'completed' | 'reviewed'
}

// Temporary sample students for the prototype
export const sampleStudents: Student[] = Array.from(
  { length: 9 },
  (_, index) => ({
    id: String(index + 1),
    name: `Student ${index + 1}`
  })
)

// Temporary scenario and persona options
// These are NOT verified backend records.
export const sampleScenarios = [
  { id: 1, title: 'Initial Patient Assessment' },
  { id: 2, title: 'Patient Communication' },
  { id: 3, title: 'Clinical Interview' }
]

export const samplePersonas = [
  { id: 1, name: 'Patient A' },
  { id: 2, name: 'Patient B' },
  { id: 3, name: 'Patient C' }
]
