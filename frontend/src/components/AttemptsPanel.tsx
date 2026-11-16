import { useEffect, useState } from 'react'
import { listResults, reviewResult, type Result, type Status } from '../api/results'
import {
  getConversationTree,
  listConversations,
  type ConversationSummary,
  type SavedConversationTree,
} from '../api/conversations'
import ConversationTreeView from './ConversationTreeView'
import './AssignmentReview.css'

const STATUS_LABELS: Record<Status, string> = {
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  reviewed: 'Reviewed',
}

// Shows an assignment's status: assigned / in_progress / completed / reviewed.
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] ?? status}</span>
}

// Lists every attempt for one assignment and lets the educator grade it.
// Usage: <AttemptsPanel assignmentId={assignment.id} onReviewed={(id) => ...} />
// onReviewed (optional) runs after a grade is saved, so the parent can update
// its status badge (the backend sets the assignment to "reviewed").
export default function AttemptsPanel({
  assignmentId,
  onReviewed,
}: {
  assignmentId: number
  onReviewed?: (assignmentId: number) => void
}) {
  const [results, setResults] = useState<Result[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [tree, setTree] = useState<SavedConversationTree | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [score, setScore] = useState<Record<number, string>>({})
  const [feedback, setFeedback] = useState<Record<number, string>>({})

  async function openTree(conversationId: string) {
    try {
      const loaded = await getConversationTree(conversationId)
      setTree(loaded)
      setSelectedNodeId(loaded.activeNodeId)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listResults(assignmentId),
      listConversations(assignmentId).catch(() => [] as ConversationSummary[]),
    ])
      .then(async ([res, convs]) => {
        setResults(res)
        setConversations(convs)
        if (convs.length > 0) {
          const loaded = await getConversationTree(convs[0].id)
          setTree(loaded)
          setSelectedNodeId(loaded.activeNodeId)
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [assignmentId])

  async function submitReview(r: Result) {
    setError('')
    const n = Number(score[r.id])
    if (score[r.id] === undefined || score[r.id] === '' || Number.isNaN(n) || n < 0 || n > 100) {
      setError('Score must be a number from 0 to 100.')
      return
    }
    try {
      const updated = await reviewResult(r.id, n, feedback[r.id] ?? '')
      setResults((prev) => prev.map((x) => (x.id === r.id ? updated : x)))
      onReviewed?.(assignmentId)
    } catch (e) {
      setError((e as Error).message) // shows the backend's 400 / 401 / 403 / 404 message
    }
  }

  if (loading) return <p>Loading attempts...</p>

  return (
    <div>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {results.length === 0 && conversations.length === 0 && !error && <p>No attempts yet.</p>}

      {conversations.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {conversations.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openTree(c.id)}
                style={{
                  fontWeight: tree?.conversationId === c.id ? 700 : 400,
                  border: tree?.conversationId === c.id ? '2px solid #a855f7' : undefined,
                }}
              >
                Attempt {conversations.length - i} · {c.status === 'completed' ? 'Completed' : 'In progress'} ({c.lineCount} lines)
              </button>
            ))}
          </div>
          {tree && (
            <ConversationTreeView
              tree={tree}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
              readOnly
            />
          )}
        </div>
      )}

      {results.map((r) => (
        <div
          key={r.id}
          style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 12 }}
        >
          <h4 style={{ margin: 0 }}>Attempt from {new Date(r.createdAt).toLocaleString()}</h4>

          {r.transcript.map((line, i) => (
            <p key={i} style={{ margin: '4px 0' }}>
              <strong>{line.role}:</strong> {line.text}
            </p>
          ))}

          <p>Auto score: {r.autoScore ? JSON.stringify(r.autoScore) : 'none'}</p>
          <p>Grade: {r.educatorScore ?? 'not graded'}</p>
          <p>Feedback: {r.educatorFeedback || 'none'}</p>

          <div className="form-group">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Score (0-100)"
              value={score[r.id] ?? ''}
              onChange={(e) => setScore({ ...score, [r.id]: e.target.value })}
            />
            <textarea
              placeholder="Feedback"
              value={feedback[r.id] ?? ''}
              onChange={(e) => setFeedback({ ...feedback, [r.id]: e.target.value })}
            />
            <button type="button" onClick={() => submitReview(r)}>
              Save review
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}