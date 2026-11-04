import { useEffect, useState } from 'react'
import { listAssignments, type Assignment } from '../api/assignments'
import { listScenarios } from '../api/scenarios'
import AttemptsPanel, { StatusBadge } from './AttemptsPanel'
import './AssignmentReview.css'

// "Review Attempts": assignments a student has finished (completed) or that
// the educator already graded (reviewed). Open one to read its attempts and
// grade them. Data comes from GET /api/assignments and GET /api/scenarios.
export default function AssignmentReview() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [titles, setTitles] = useState<Record<number, string>>({})
  const [openId, setOpenId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      listAssignments({ status: 'completed' }),
      listAssignments({ status: 'reviewed' }),
      listScenarios(),
    ])
      .then(([completed, reviewed, scenarios]) => {
        const all = [...completed, ...reviewed]
          .filter((a) => !a.archived)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setAssignments(all)
        setTitles(Object.fromEntries(scenarios.map((s) => [s.id, s.title])))
      })
      .catch((e: Error) => setError(e.message)) // backend {"error": "..."} text
      .finally(() => setLoading(false))
  }, [])

  // After a grade is saved the backend moves the assignment to "reviewed".
  function markReviewed(assignmentId: number) {
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, status: 'reviewed' } : a))
    )
  }

  return (
    <section className="assignment-review">
      <h2>Review Attempts</h2>

      {loading && <p>Loading assignments...</p>}
      {error && <p className="review-error">Error: {error}</p>}
      {!loading && !error && assignments.length === 0 && (
        <p>No finished attempts to review yet.</p>
      )}

      {assignments.map((a) => (
        <div key={a.id} className="review-row">
          <div className="review-row-header">
            <div>
              <h3>{titles[a.scenarioId] ?? `Scenario #${a.scenarioId}`}</h3>
              <p className="review-meta">
                Student {a.studentId} &middot; Assigned{' '}
                {new Date(a.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="review-row-actions">
              <StatusBadge status={a.status} />
              <button
                type="button"
                onClick={() => setOpenId(openId === a.id ? null : a.id)}
                aria-expanded={openId === a.id}
              >
                {openId === a.id ? 'Hide attempts' : 'View attempts'}
              </button>
            </div>
          </div>

          {openId === a.id && (
            <AttemptsPanel assignmentId={a.id} onReviewed={markReviewed} />
          )}
        </div>
      ))}
    </section>
  )
}
