import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import ConversationTreeView from '../components/ConversationTreeView'
import { getActiveConversationPath } from '../utils/treeUtils'
import { getCurrentUser } from '../api/auth'
import {
  getConversationTree,
  listConversations,
  type ConversationSummary,
  type SavedConversationTree,
} from '../api/conversations'

/**
 * Conversations (/conversations?assignmentId=N)
 * Shows the saved voice conversation trees for one assignment.
 * Students see their own; educators see the ones they assigned.
 * Nothing on this page changes data: clicking a line only shows
 * the conversation up to that line.
 */
const buttonStyle = {
  background: '#ffffff',
  color: '#111827',
  border: '1px solid #9ca3af',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
}

export default function Conversations() {
  const [params, setParams] = useSearchParams()
  const [idInput, setIdInput] = useState(params.get('assignmentId') ?? '')
  const assignmentId = Number(params.get('assignmentId'))
  const wantedConversation = params.get('conversationId')

  const [attempts, setAttempts] = useState<ConversationSummary[]>([])
  const [tree, setTree] = useState<SavedConversationTree | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isStudent, setIsStudent] = useState(false)

  // Students can continue their own conversation from any line;
  // educators only look.
  useEffect(() => {
    getCurrentUser()
      .then(user => setIsStudent(user?.role === 'student'))
      .catch(() => setIsStudent(false))
  }, [])

  const openTree = useCallback(async (conversationId: string) => {
    setError('')
    try {
      const t = await getConversationTree(conversationId)
      setTree(t)
      setSelectedNodeId(t.activeNodeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const loadAttempts = useCallback(async () => {
    if (!Number.isInteger(assignmentId) || assignmentId < 1) return
    setLoading(true)
    setError('')
    setTree(null)
    try {
      const list = await listConversations(assignmentId)
      setAttempts(list)
      const first = list.find(a => a.id === wantedConversation) ?? list[0]
      if (first) await openTree(first.id)
    } catch (e) {
      setAttempts([])
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [assignmentId, wantedConversation, openTree])

  useEffect(() => {
    void loadAttempts()
  }, [loadAttempts])

  // the conversation from the top down to whichever line is selected
  const path = useMemo(() => {
    if (!tree || !selectedNodeId) return []
    return getActiveConversationPath({ ...tree, activeNodeId: selectedNodeId })
  }, [tree, selectedNodeId])

  return (
    <PageLayout>
      <h1>Saved Conversations</h1>

      <form
        onSubmit={e => {
          e.preventDefault()
          setParams({ assignmentId: idInput.trim() })
        }}
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}
      >
        <label htmlFor="assignment-id">Assignment ID</label>
        <input
          id="assignment-id"
          value={idInput}
          onChange={e => setIdInput(e.target.value)}
          inputMode="numeric"
          style={{ width: 90 }}
        />
        <button type="submit" style={buttonStyle}>Load</button>
        <button type="button" style={buttonStyle} onClick={() => void loadAttempts()} disabled={!assignmentId}>
          Refresh
        </button>
      </form>

      {error && <p role="alert" style={{ color: '#dc2626' }}>{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && assignmentId > 0 && !error && attempts.length === 0 && (
        <p>No saved conversations yet. Do a voice call, end it, then hit Refresh.</p>
      )}

      {attempts.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h2>Attempts</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {attempts.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => void openTree(a.id)}
                style={{
                  ...buttonStyle,
                  fontWeight: tree?.conversationId === a.id ? 700 : 400,
                  border: tree?.conversationId === a.id ? '2px solid #a855f7' : undefined,
                }}
              >
                Attempt {attempts.length - i} · {a.status === 'completed' ? 'Completed' : 'In progress'}
                {' · '}{a.lineCount} lines · {new Date(a.createdAt).toLocaleString()}
              </button>
            ))}
          </div>
        </section>
      )}

      {tree && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 16 }}>
          <section>
            <h2>Tree</h2>
            <p style={{ fontSize: 14 }}>Click any line to see the conversation up to that point.</p>
            <ConversationTreeView
              tree={tree}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
            />
          </section>

          <section>
            <h2>Conversation to this line</h2>
            {isStudent && selectedNodeId && (
              <p>
                <Link
                  to={`/rtc?assignmentId=${tree.assignmentId}&conversationId=${tree.conversationId}&fromNodeId=${selectedNodeId}`}
                  style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none' }}
                >
                  ↩ Continue from this line
                </Link>
              </p>
            )}
            {path.map(node => (
              <p key={node.id} style={{ margin: '6px 0' }}>
                <strong>
                  {node.sender === 'student' ? 'Student' : node.sender === 'persona' ? 'Patient' : '—'}:
                </strong>{' '}
                {node.text}
                {(node as { status?: string }).status === 'interrupted' && (
                  <em style={{ color: '#6b7280' }}> (cut off)</em>
                )}
              </p>
            ))}
          </section>
        </div>
      )}

      {tree && (
        <details style={{ marginTop: 16 }}>
          <summary>Raw tree JSON (for debugging)</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(tree, null, 2)}</pre>
        </details>
      )}
    </PageLayout>
  )
}
