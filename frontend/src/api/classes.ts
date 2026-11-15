import { api, jsonBody } from './http'

// Classes, modules, and the student picker for the Educator Portal (#73).
// Backend: backend/src/class_routes.cpp. Educators/admins only; educators
// only see their own classes and modules.
//
// These replace the localStorage prototype in EducatorPortal.tsx:
//   sampleStudents        -> listStudents()
//   PracticeModule        -> Module        (MODULE_KEY)
//   ClassGroup            -> ClassGroup    (CLASS_KEY)
//   LocalAssignment rows  -> real assignments: listAssignments() rows now have
//                            classId and moduleId, so filter by those.
// Note: class and module ids are numbers now (the prototype used strings).

export type Student = { id: string; email: string; name: string }

export type Module = {
  id: number
  name: string
  scenarioId: number
  personaId: number
  createdAt: string
}

export type ClassGroup = {
  id: number
  courseCode: string
  section: string
  studentIds: string[]
  moduleIds: number[]
  createdAt: string
}

// What add/assign calls return: how many assignments were created.
export type Created = { created: number }

// What remove/delete calls return. Assignments a student already started are
// kept (with their practice history); only unstarted ones are removed.
export type RemovedKept = { removed: number; kept: number }

// ---------------------------------------------------------------- students

// GET /api/students  real student accounts (show email in the picker)
export const listStudents = () => api<Student[]>('/api/students')

// ----------------------------------------------------------------- modules

export const listModules = () => api<Module[]>('/api/modules')

export const createModule = (name: string, scenarioId: number, personaId: number) =>
  api<Module>('/api/modules', jsonBody('POST', { name, scenarioId, personaId }))

// Also takes it away from every class (keeping started assignments).
export const deleteModule = (moduleId: number) =>
  api<RemovedKept>(`/api/modules/${moduleId}`, { method: 'DELETE' })

// ----------------------------------------------------------------- classes

export const listClasses = () => api<ClassGroup[]>('/api/classes')

export const createClass = (courseCode: string, section = '', studentIds: string[] = []) =>
  api<ClassGroup>('/api/classes', jsonBody('POST', { courseCode, section, studentIds }))

export const deleteClass = (classId: number) =>
  api<RemovedKept>(`/api/classes/${classId}`, { method: 'DELETE' })

// Adding a student gives them every module the class already has.
export const addStudentToClass = (classId: number, studentId: string) =>
  api<Created>(`/api/classes/${classId}/students`, jsonBody('POST', { studentId }))

export const removeStudentFromClass = (classId: number, studentId: string) =>
  api<RemovedKept>(`/api/classes/${classId}/students/${studentId}`, { method: 'DELETE' })

// "Assign to class": one real assignment per student. Safe to click twice.
export const assignModuleToClass = (classId: number, moduleId: number) =>
  api<Created>(`/api/classes/${classId}/modules`, jsonBody('POST', { moduleId }))

export const unassignModuleFromClass = (classId: number, moduleId: number) =>
  api<RemovedKept>(`/api/classes/${classId}/modules/${moduleId}`, { method: 'DELETE' })
