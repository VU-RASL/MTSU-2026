import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import ModuleCard from '../components/ModuleCard'
import type { Module } from '../components/ModuleCard'
import { useState } from 'react'

// Frontend sample data. Replace with API data when the backend is ready.
const modules: Module[] = [
  {
    id: 1,
    title: 'Initial Patient Assessment',
    description: 'Practice evaluating a new patient.',
    difficulty: 'Beginner',
    objectives: ['Practice an initial assessment', 'Record observations']
  },
  {
    id: 2,
    title: 'Patient Communication',
    description: 'Practice communicating with patients.',
    difficulty: 'Intermediate',
    objectives: ['Practice clear communication', 'Respond to patient concerns']
  },
  {
    id: 3,
    title: 'Clinical Interview',
    description: 'Practice gathering patient history.',
    difficulty: 'Advanced',
    objectives: ['Gather a patient history', 'Summarize key findings']
  }
]

export default function EducatorPortal() {
  
const [selectedStudent, setSelectedStudent] = useState('')
const [selectedModule, setSelectedModule] = useState('')

const students = [
    { id: 1, name: 'Student One' },
    { id: 2, name: 'Student Two' },
    { id: 3, name: 'Student Three' }
]

function handleAssign() {
    if (!selectedStudent || !selectedModule) {
        alert('Please select a student and module.')
        return
    }

    alert('Module assigned successfully (demo only).')
}

  
  const navigate = useNavigate()

  function startModule(_moduleId: number) {
    // For now all scenarios open the existing RTC placeholder.
    // Later, the module ID can be passed when RTC supports scenarios.
    navigate('/rtc')
  }

  return (
    <PageLayout>
      <section className="educator-portal">
        <h1>Educator Portal</h1>
        <p>Review clinical practice modules or start a scenario.</p>

        
<section className="module-assignment">
    <h2>Assign Module</h2>

    <div className="assignment-fields">
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
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
            >
                <option value="">Select Module</option>

                {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                        {module.title}
                    </option>
                ))}
            </select>
        </div>
    </div>

    <button type="button" onClick={handleAssign}>
        Assign Module
    </button>
</section>

        <h2>Review Modules</h2>
        <div className="module-grid">
          {modules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              onStart={startModule}
            />
          ))}
        </div>
      </section>
    </PageLayout>
  )
}
