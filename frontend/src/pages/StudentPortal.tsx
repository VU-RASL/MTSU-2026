import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { listAssignments, startAssignment, type Assignment } from '../api/assignments'

const STATUS_LABELS: Record<Assignment['status'], string> = {
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  reviewed: 'Reviewed',
}

// The Student Portal now loads the student's ASSIGNMENTS from the backend.
// An assignment only stores a scenarioId (no title/summary), so cards show
// "Scenario #<id>" until the /api/scenarios routes are merged into main.
// When they are, fetch scenarios and look up each title by scenarioId.

const StudentPortal: React.FC = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    listAssignments()
      .then(setAssignments)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = assignments.filter((a) =>
    `scenario ${a.scenarioId} ${a.status}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Start: mark the assignment in progress, then open the voice conversation.
  async function handleStart(id: number) {
    setError('')
    try {
      await startAssignment(id)
      navigate(`/rtc?assignmentId=${id}`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <Header />
      <div className="content">
        <div className="persona-creator">
          <h1>Student Training Portal</h1>
          <p style={{ textAlign: 'center', color: 'var(--text)' }}>
            Select a scenario to begin your AI patient training session.
          </p>

          <div className="form-group">
            <label htmlFor="scenario-search">Search Assignments</label>
            <input
              id="scenario-search"
              type="text"
              placeholder="Search by scenario or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading && <p>Loading assignments...</p>}
          {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
          {!loading && !error && filtered.length === 0 && <p>No assignments yet.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            {filtered.map((a) => (
              <div
                key={a.id}
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
                <h2 style={{ fontSize: '20px', margin: 0 }}>Scenario #{a.scenarioId}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span><strong>Status:</strong> {STATUS_LABELS[a.status] ?? a.status}</span>
                  <span><strong>Assigned:</strong> {new Date(a.createdAt).toLocaleDateString()}</span>
                </div>

                {a.status === 'assigned' && (
                  <button type="button" style={{ marginTop: '12px' }} onClick={() => handleStart(a.id)}>
                    Start Scenario
                  </button>
                )}

                {a.status === 'in_progress' && (
                  <button type="button" style={{ marginTop: '12px' }} onClick={() => navigate(`/rtc?assignmentId=${a.id}`)}>
                    Continue Conversation
                  </button>
                )}

                {(a.status === 'completed' || a.status === 'reviewed') && (
                  <button type="button" style={{ marginTop: '12px' }} onClick={() => navigate(`/rtc?assignmentId=${a.id}`)}>
                    Practice Again
                  </button>
                )}

                {a.status !== 'assigned' && (
                  <button type="button" style={{ marginTop: '8px' }} onClick={() => navigate(`/conversations?assignmentId=${a.id}`)}>
                    View My Conversations
                  </button>
                )}
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