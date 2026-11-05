import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import AssignmentReview from '../components/AssignmentReview'
import { StatusBadge } from '../components/AttemptsPanel'
import {
  createAssignment,
  deleteAssignment,
  listAssignments,
  type Assignment,
} from '../api/assignments'
import { listScenarios, type Scenario } from '../api/scenarios'
import type { Status } from '../api/results'

const statuses: Status[] = ['assigned', 'in_progress', 'completed', 'reviewed']

export default function EducatorPortal() {
  const navigate = useNavigate()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [studentId, setStudentId] = useState('')
  const [scenarioId, setScenarioId] = useState('')
  const [filterStudentId, setFilterStudentId] = useState('')
  const [filterStatus, setFilterStatus] = useState<Status | ''>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async (student = '', status: Status | '' = '') => {
    const rows = await listAssignments({
      ...(student.trim() ? { studentId: student.trim() } : {}),
      ...(status ? { status } : {}),
    })
    setAssignments(rows)
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([listScenarios(), listAssignments()])
      .then(([available, rows]) => {
        if (!active) return
        setScenarios(available)
        setAssignments(rows)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load educator data')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const id = Number(scenarioId)
    if (!Number.isSafeInteger(id) || id <= 0 || !studentId.trim()) {
      setError('Choose a scenario and enter a valid student profile ID.')
      return
    }
    setSaving(true)
    try {
      await createAssignment(id, studentId.trim())
      setNotice('Assignment created successfully.')
      setStudentId('')
      setScenarioId('')
      await refresh(filterStudentId, filterStatus)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create assignment')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnassign(row: Assignment) {
    if (!window.confirm(`Unassign ${getTitle(row.scenarioId)} from student ${row.studentId}? Associated attempt data may also be affected.`)) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await deleteAssignment(row.id)
      setNotice(`Assignment #${row.id} removed.`)
      await refresh(filterStudentId, filterStatus)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove assignment')
    } finally {
      setSaving(false)
    }
  }

  function getTitle(id: number) {
    return scenarios.find((s) => s.id === id)?.title ?? `Scenario #${id}`
  }

  async function applyFilters() {
    setLoading(true)
    setError('')
    try {
      await refresh(filterStudentId, filterStatus)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load assignments')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageLayout>
      <main className="educator-portal educator-stable">
        <h1>Educator Portal</h1>
        <p>Assign clinical scenarios to students, track progress, and review practice attempts.</p>

        <section className="educator-stable-panel" aria-labelledby="create-assignment-title">
          <h2 id="create-assignment-title">Assign Scenario</h2>
          <form onSubmit={handleAssign} className="educator-stable-form">
            <div className="form-group">
              <label htmlFor="educator-student-id">Student profile ID</label>
              <input
                id="educator-student-id"
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="Enter a valid student ID"
                inputMode="numeric"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="educator-scenario">Scenario</label>
              <select id="educator-scenario" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} required>
                <option value="">Choose a scenario</option>
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>{scenario.title}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={saving || loading || scenarios.length === 0}>Assign scenario</button>
          </form>
          <p className="educator-stable-note">Only real student profiles can receive assignments. This stable page assigns scenarios individually; class-wide modules are part of the separate prototype.</p>
        </section>

        <section className="educator-stable-panel" aria-labelledby="assignments-title">
          <h2 id="assignments-title">Current Assignments</h2>
          <div className="educator-stable-filters">
            <div className="form-group">
              <label htmlFor="educator-filter-student">Student ID filter</label>
              <input id="educator-filter-student" value={filterStudentId} onChange={(event) => setFilterStudentId(event.target.value)} placeholder="All students" />
            </div>
            <div className="form-group">
              <label htmlFor="educator-filter-status">Status filter</label>
              <select id="educator-filter-status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as Status | '')}>
                <option value="">All statuses</option>
                {statuses.map((status) => <option value={status} key={status}>{status.replace('_', ' ')}</option>)}
              </select>
            </div>
            <button type="button" disabled={loading || saving} onClick={applyFilters}>Apply filters / Refresh</button>
          </div>
          {loading && <p>Loading assignments...</p>}
          {!loading && assignments.length === 0 && !error && <p>No assignments found.</p>}
          {!loading && assignments.length > 0 && (
            <div className="educator-stable-scroll">
              <table className="educator-stable-table">
                <thead><tr><th>Assignment</th><th>Student</th><th>Scenario</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {assignments.map((row) => (
                    <tr key={row.id}>
                      <td>#{row.id}</td>
                      <td>{row.studentId}</td>
                      <td>{getTitle(row.scenarioId)}</td>
                      <td><StatusBadge status={row.status} />{row.archived && <span> (Archived)</span>}</td>
                      <td><button type="button" disabled={saving} onClick={() => handleUnassign(row)}>Unassign</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && <p className="educator-stable-error" role="alert">{error}</p>}
        {notice && <p className="educator-stable-notice" role="status">{notice}</p>}

        <AssignmentReview />

        <section className="educator-stable-panel" aria-labelledby="preview-scenarios-title">
          <h2 id="preview-scenarios-title">Preview Scenarios</h2>
          <p>Starting a scenario opens the existing RTC placeholder.</p>
          <div className="educator-stable-scenarios">
            {scenarios.map((scenario) => (
              <article key={scenario.id} className="educator-stable-scenario">
                <h3>{scenario.title}</h3>
                <p>{scenario.summary}</p>
                <p>Difficulty: {scenario.difficulty}</p>
                <button type="button" onClick={() => navigate('/rtc')}>Start</button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </PageLayout>
  )
}
