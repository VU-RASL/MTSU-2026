import { useState } from 'react'
import PageLayout from '../components/PageLayout'
import ModuleCard from '../components/ModuleCard'
import type { Module } from '../components/ModuleCard'

const modules: Module[] = [
  {
    id: 1,
    title: 'Initial Patient Assessment',
    description: 'Practice evaluating a new patient.',
    difficulty: 'Beginner'
  },
  {
    id: 2,
    title: 'Patient Communication',
    description: 'Practice communicating with patients.',
    difficulty: 'Intermediate'
  },
  {
    id: 3,
    title: 'Clinical Interview',
    description: 'Practice gathering patient history.',
    difficulty: 'Advanced'
  }
]

const students = [
  { id: 1, name: 'Student One' },
  { id: 2, name: 'Student Two' },
  { id: 3, name: 'Student Three' }
]

export default function EducatorReview() {
  const [selectedModule, setSelectedModule] = useState<number | null>(null)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [message, setMessage] = useState('')

  function handleAssign() {
    if (!selectedModule || !selectedStudent) {
      setMessage('Please select a module and student.')
      return
    }

    // Placeholder until backend integration
    setMessage('Assignment created (demo only).')
  }

  return (
    <PageLayout>
      <div className="educator-review">
        <h1>Educator Review</h1>
        <p>
          Assign clinical practice modules to students.
        </p>

        <h2>Available Modules</h2>

        <div className="module-grid">
          {modules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              onSelect={(id) => {
                setSelectedModule(id)
                setMessage('')
              }}
            />
          ))}
        </div>

        <h2>Assign Module</h2>

        <div className="form-group">
          <label htmlFor="student">Student</label>
          <select
            id="student"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">Select Student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="module">Module</label>
          <select
            id="module"
            value={selectedModule ?? ''}
            onChange={(e) => {
              setSelectedModule(Number(e.target.value) || null)
            }}
          >
            <option value="">Select Module</option>
            {modules.map((module) => (
              <option key={module.id} value={module.id}>
                {module.title}
              </option>
            ))}
          </select>
        </div>

        <button type="button" onClick={handleAssign}>
          Assign Module
        </button>

        {message && <p role="status">{message}</p>}
      </div>
    </PageLayout>
  )
}
