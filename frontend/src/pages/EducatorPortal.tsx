import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import ModuleCard from '../components/ModuleCard'
import type { Module } from '../components/ModuleCard'

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
