
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import PageLayout from '../components/PageLayout'

import {
  sampleScenarios,
  samplePersonas,
  sampleStudents
} from '../data/educatorPrototype'

import type {
  PracticeModule,
  ClassGroup
} from '../data/educatorPrototype'


export default function EducatorPortalPrototype() {
 const [modules, setModules] = useState<PracticeModule[]>(() => {
  try {
    const saved = localStorage.getItem('vera-prototype-modules')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
})

  const [moduleName, setModuleName] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [personaId, setPersonaId] = useState('')

  const [classes, setClasses] = useState<ClassGroup[]>(() => {
  try {
    const saved = localStorage.getItem('vera-prototype-classes-v2')
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
})

  const [courseCode, setCourseCode] = useState('')
  const [section, setSection] = useState('')
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [classError, setClassError] = useState('')

    useEffect(() => {
  localStorage.setItem('vera-prototype-modules', JSON.stringify(modules))
}, [modules])

useEffect(() => {
  localStorage.setItem('vera-prototype-classes-v2', JSON.stringify(classes))
}, [classes])

  function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!moduleName.trim() || !scenarioId || !personaId) {
      return
    }

    const newModule: PracticeModule = {
      id: Math.max(0, ...modules.map(m => m.id)) + 1,
      name: moduleName.trim(),
      scenarioId: Number(scenarioId),
      personaId: Number(personaId)
    }

    setModules(previous => [...previous, newModule])

    // Reset form after creation
    setModuleName('')
    setScenarioId('')
    setPersonaId('')
  }

  
function toggleStudent(studentId: string) {
  setSelectedStudents(previous =>
    previous.includes(studentId)
      ? previous.filter(id => id !== studentId)
      : [...previous, studentId]
  )
}


function createClass(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()

  const course = courseCode.trim().toUpperCase()
  const sectionCode = section.trim().toUpperCase()

  if (!course || !sectionCode) {
    setClassError('Enter a course code and section.')
    return
  }

  if (selectedStudents.length === 0) {
    setClassError('Select at least one student.')
    return
  }

  const id = `${course}-${sectionCode}`

  if (classes.some(group => group.id === id)) {
    setClassError('This course section already exists.')
    return
  }

  const newClass: ClassGroup = {
    id,
    courseCode: course,
    section: sectionCode,
    studentIds: [...selectedStudents]
  }

  setClasses(previous => [...previous, newClass])
  setCourseCode('')
  setSection('')
  setSelectedStudents([])
  setClassError('')
}



  return (
    <PageLayout>
      <main className="educator-portal-prototype">
        <h1>Educator Portal</h1>
        <p>Module and class management prototype.</p>

        <section className="module-assignment">
          <h2>Create Module</h2>

          <form onSubmit={createModule}>
            <div className="form-group">
              <label htmlFor="module-name">Module Name</label>
              <input
                id="module-name"
                value={moduleName}
                onChange={e => setModuleName(e.target.value)}
                placeholder="Enter module name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="scenario-select">Scenario</label>
              <select
                id="scenario-select"
                value={scenarioId}
                onChange={e => setScenarioId(e.target.value)}
                required
              >
                <option value="">Select Scenario</option>
                {sampleScenarios.map(scenario => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="persona-select">Persona</label>
              <select
                id="persona-select"
                value={personaId}
                onChange={e => setPersonaId(e.target.value)}
                required
              >
                <option value="">Select Persona</option>
                {samplePersonas.map(persona => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit">
              Create Module
            </button>
          </form>
        </section>

        <section className="module-assignment">
          <h2>Created Modules</h2>

          {modules.length === 0 ? (
            <p>No modules have been created yet.</p>
          ) : (
            <ul>
              {modules.map(module => (
                <li key={module.id}>
                  <strong>{module.name}</strong>
                  {' — '}
                  Scenario #{module.scenarioId},
                  Persona #{module.personaId}
                </li>
              ))}
            </ul>
          )}
        </section>
        
        
        <section className="module-assignment class-management">
  <h2>Class Management</h2>

  <form onSubmit={createClass}>
    <div className="class-fields">
         <div className="form-group">
            <label htmlFor="course-code">Course Code</label>

            <input
            id="course-code"
            value={courseCode}
            onChange={event => setCourseCode(event.target.value)}
            placeholder="Example: HLTH-3210"
            required
        />
    </div>

    <div className="form-group">
        <label htmlFor="section-code">Section</label>

        <input
        id="section-code"
        value={section}
        onChange={event => setSection(event.target.value)}
        placeholder="Example: D01"
        required
        />
     </div>
    </div>


        <fieldset className="student-selection">
         <legend>Select Students</legend>

          <div className="student-grid">
            {sampleStudents.map(student => (
            <label key={student.id} className="student-option">
             <input
              type="checkbox"
              checked={selectedStudents.includes(student.id)}
              onChange={() => toggleStudent(student.id)}
            />

            <span>{student.name}</span>
          </label>
        ))}
      </div>
    </fieldset>

    <p className="selection-count">
      {selectedStudents.length} students selected
    </p>

    {classError && (
      <p className="class-error" role="alert">
        {classError}
      </p>
    )}

    <button type="submit">Create Class</button>
  </form>
</section>

<section className="module-assignment">
  <h2>Created Classes</h2>

  {classes.length === 0 ? (
    <p>No classes have been created yet.</p>
  ) : (
    <div className="created-classes">
      {classes.map(group => (
        <div key={group.id} className="class-card">
          <h3> {group.courseCode} — Section {group.section} </h3>

          <p>{group.studentIds.length} students enrolled</p>

          <ul>
            {group.studentIds.map(studentId => (
              <li key={studentId}>
                Student {studentId}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )}
</section>

      </main>
    </PageLayout>
  )
}
