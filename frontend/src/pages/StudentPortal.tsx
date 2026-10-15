import React, { useState } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

// Mock scenario list for graphical preview
const visualScenarios = [
  {
    id: 1,
    title: 'Pediatric MMR Vaccination and Anaphylaxis Response',
    summary: 'A grandmother who is hesitant about vaccinating her 5 year old grandson.',
    difficulty: 'Intermediate',
    estimatedTime: '15 mins',
  },
  {
    id: 2,
    title: 'Autism Diagnosis Consultation',
    summary: 'Initial consultation and behavioral evaluation scenario with a young child and family.',
    difficulty: 'Advanced',
    estimatedTime: '30 mins',
  },
  {
    id: 3,
    title: 'Behavioral Intervention Practice',
    summary: 'Practicing communication strategies and managing sensory overload situations.',
    difficulty: 'Beginner',
    estimatedTime: '20 mins',
  },
]

const StudentPortal: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter scenario items by title or summary search term
  const filteredScenarios = visualScenarios.filter(
    (s) =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.summary.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
      <Header />
      <div className="content">
        <div className="persona-creator">
          <h1>Student Training Portal</h1>
          <p style={{ textAlign: 'center', color: 'var(--text)' }}>
            Select a scenario to begin your AI patient training session.
          </p>

          {/* Search bar */}
          <div className="form-group">
            <label htmlFor="scenario-search">Search Scenarios</label>
            <input
              id="scenario-search"
              type="text"
              placeholder="Search by title or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Scenario cards container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            {filteredScenarios.map((scenario) => (
              <div
                key={scenario.id}
                style={{
                  padding: '16px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <h2 style={{ fontSize: '20px', margin: 0 }}>{scenario.title}</h2>
                <p style={{ margin: 0, color: 'var(--text)' }}>{scenario.summary}</p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: 'var(--text)',
                    marginTop: '8px',
                  }}
                >
                  <span><strong>Difficulty:</strong> {scenario.difficulty}</span>
                  <span><strong>Duration:</strong> {scenario.estimatedTime}</span>
                </div>
                <button type="button" style={{ marginTop: '12px' }}>
                  Start Scenario
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}

export default StudentPortal