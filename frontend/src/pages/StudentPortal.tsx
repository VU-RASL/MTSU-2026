import React, { useState, useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'

// Scenario interface matching backend Issue #22
interface Scenario {
  id: number
  title: string
  summary: string
  difficulty?: string
  estimatedTime?: number | string
}

// Mock scenario list for graphical preview / offline fallback
const visualScenarios: Scenario[] = [
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
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch scenarios from API with fallback
  useEffect(() => {
    setLoading(true)
    fetch('http://localhost:18080/api/scenarios')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`)
        return res.json()
      })
      .then((data: Scenario[]) => {
        setScenarios(data.length > 0 ? data : visualScenarios)
        setError(null)
      })
      .catch((err) => {
        console.warn('Backend unavailable, using mock scenarios:', err)
        setScenarios(visualScenarios)
        setError('Backend offline: Showing offline sample scenarios.')
      })
      .finally(() => setLoading(false))
  }, [])

  // Filter scenario items by title or summary search term
  const filteredScenarios = scenarios.filter(
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

          {/* Loading and error indicators */}
          {loading && (
            <p style={{ textAlign: 'center', color: 'var(--text)', padding: '12px' }}>
              Loading scenarios...
            </p>
          )}

          {error && !loading && (
            <div
              style={{
                backgroundColor: 'rgba(255, 187, 1, 0.1)',
                border: '1px solid var(--accent)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '14px',
                color: 'var(--text-h)',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {/* Scenario cards container */}
          {!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {filteredScenarios.length > 0 ? (
                filteredScenarios.map((scenario) => (
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
                      <span><strong>Difficulty:</strong> {scenario.difficulty ?? 'Intermediate'}</span>
                      <span><strong>Duration:</strong> {typeof scenario.estimatedTime === 'number' ? `${scenario.estimatedTime} mins` : scenario.estimatedTime}</span>
                    </div>
                    <button type="button" style={{ marginTop: '12px' }}>
                      Start Scenario
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text)', padding: '20px' }}>
                  No scenarios match "{searchTerm}".
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  )
}

export default StudentPortal