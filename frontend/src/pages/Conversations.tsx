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
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
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
      <div style={{ maxWidth: 1240, margin: '30px auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 30 }}>Saved Conversations</h1>

          <form
            onSubmit={e => {
              e.preventDefault()
              setParams({ assignmentId: idInput.trim() })
            }}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: '#ffffff',
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <label htmlFor="assignment-id" style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: 0 }}>
              Assignment ID
            </label>
            <input
              id="assignment-id"
              value={idInput}
              onChange={e => setIdInput(e.target.value)}
              inputMode="numeric"
              style={{
                width: 84,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                ...buttonStyle,
                background: 'var(--accent, #CFAE70)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              Load
            </button>
            <button
              type="button"
              style={{
                ...buttonStyle,
                opacity: !assignmentId ? 0.55 : 1,
                cursor: !assignmentId ? 'not-allowed' : 'pointer',
              }}
              onClick={() => void loadAttempts()}
              disabled={!assignmentId}
            >
              Refresh
            </button>
          </form>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            {error}
          </p>
        )}

        {loading && (
          <p style={{ color: '#6b7280', fontSize: 15, padding: '12px 0' }}>Loading...</p>
        )}

        {!loading && assignmentId > 0 && !error && attempts.length === 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 24,
              color: '#4b5563',
            }}
          >
            <p style={{ margin: 0 }}>No saved conversations yet. Do a voice call, end it, then hit Refresh.</p>
          </div>
        )}

        {attempts.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>Attempts</h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {attempts.map((a, i) => {
                const isSelected = tree?.conversationId === a.id
                const isCompleted = a.status === 'completed'
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => void openTree(a.id)}
                    style={{
                      ...buttonStyle,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: isSelected ? '#faf5ff' : '#ffffff',
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '2px solid #a855f7' : '1px solid #d1d5db',
                      boxShadow: isSelected ? '0 2px 6px rgba(168, 85, 247, 0.15)' : '0 1px 2px rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <span>Attempt {attempts.length - i}</span>
                    <span style={{ color: '#9ca3af' }}>·</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isCompleted ? '#dcfce7' : '#fef3c7',
                        color: isCompleted ? '#166534' : '#92400e',
                      }}
                    >
                      {isCompleted ? 'Completed' : 'In progress'}
                    </span>
                    <span style={{ color: '#9ca3af' }}>·</span>
                    <span style={{ fontSize: 12, color: '#4b5563', fontWeight: 400 }}>
                      {a.lineCount} lines · {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {tree && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 24, alignItems: 'start' }}>
            <section>
              <h2 style={{ fontSize: 20, marginBottom: 4 }}>Tree</h2>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 14 }}>
                Click any line to see the conversation up to that point.
              </p>
              <ConversationTreeView
                tree={tree}
                selectedNodeId={selectedNodeId}
                onNodeSelect={setSelectedNodeId}
              />
            </section>

            <section style={{ border: '1px solid #d1d5db', borderRadius: 10, padding: 20, background: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <h2 style={{ fontSize: 18, margin: 0 }}>Conversation to this line</h2>
                {isStudent && selectedNodeId && (
                  <Link
                    to={`/rtc?assignmentId=${tree.assignmentId}&conversationId=${tree.conversationId}&fromNodeId=${selectedNodeId}`}
                    style={{
                      ...buttonStyle,
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      textDecoration: 'none',
                    }}
                  >
                    ↩ Continue from this line
                  </Link>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 14,
                  maxHeight: 540,
                  overflowY: 'auto',
                }}
              >
                {path.map(node => {
                  const isStudentMsg = node.sender === 'student'
                  const isSystemMsg = node.sender === 'system'
                  const isInterrupted = (node as { status?: string }).status === 'interrupted'

                  if (isSystemMsg) {
                    return (
                      <div
                        key={node.id}
                        style={{
                          alignSelf: 'center',
                          fontSize: 12,
                          color: '#6b7280',
                          background: '#f3f4f6',
                          padding: '4px 12px',
                          borderRadius: 999,
                          fontStyle: 'italic',
                        }}
                      >
                        <strong>—:</strong> {node.text}
                      </div>
                    )
                  }

                  return (
                    <div
                      key={node.id}
                      style={{
                        alignSelf: isStudentMsg ? 'flex-end' : 'flex-start',
                        maxWidth: '88%',
                        background: isStudentMsg ? '#eff6ff' : '#f0fdf4',
                        border: isStudentMsg ? '1px solid #bfdbfe' : '1px solid #bbf7d0',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: '#111827',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: isStudentMsg ? '#1d4ed8' : '#15803d', textTransform: 'uppercase' }}>
                        {node.sender === 'student' ? 'Student' : node.sender === 'persona' ? 'Patient' : '—'}:
                      </div>
                      <div>
                        {node.text}
                        {isInterrupted && (
                          <em
                            style={{
                              color: '#92400e',
                              background: '#fef3c7',
                              border: '1px solid #fde68a',
                              borderRadius: 4,
                              padding: '1px 6px',
                              fontSize: 11,
                              marginLeft: 6,
                              fontStyle: 'normal',
                              fontWeight: 600,
                            }}
                          >
                            (cut off)
                          </em>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {tree && (
          <details
            style={{
              marginTop: 24,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4b5563' }}>
              Raw tree JSON (for debugging)
            </summary>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontSize: 12,
                marginTop: 12,
                background: '#f8fafc',
                padding: 12,
                borderRadius: 6,
                color: '#0f172a',
              }}
            >
              {JSON.stringify(tree, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </PageLayout>
  )
}
