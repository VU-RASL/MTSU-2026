import React, { useState } from 'react'
import PageLayout from '../components/PageLayout'
import type { ConversationTree, DialogueNode } from '../types/tree'
import {
  loadTreeFromStorage,
  saveTreeToStorage,
  getActiveConversationPath,
  addDialogueNode,
  rewindToNode,
  getChildNodes
} from '../utils/treeUtils'

/**
 * TreeDemo: Standalone verification fixture for Issue #29.
 * Demonstrates student linear traversal alongside a hierarchical educator branch audit.
 */
export default function TreeDemo() {
  const [tree, setTree] = useState<ConversationTree>(() => loadTreeFromStorage(101))
  const [inputMessage, setInputMessage] = useState('')

  // Linear path currently visible to the student
  const activePath = getActiveConversationPath(tree)
  const activePathIds = new Set(activePath.map(n => n.id))

  // Appends a new turn under activeNodeId and advances the active pointer
  const handleStudentSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return

    const updated = addDialogueNode(tree, 'student', inputMessage.trim())
    setTree(updated)
    saveTreeToStorage(updated)
    setInputMessage('')
  }

  // Simulates an automated patient response under the active conversation path
  const handleSimulateReply = () => {
    const replies = [
      'It radiates down my shoulder when I walk up stairs.',
      'It feels like pressure in the center of my chest.',
      'No, I have not noticed any shortness of breath, just tightness.'
    ]
    const randomReply = replies[Math.floor(Math.random() * replies.length)]
    const updated = addDialogueNode(tree, 'persona', randomReply)
    setTree(updated)
    saveTreeToStorage(updated)
  }

  // Non-destructive turn reversal: resets active pointer without deleting discarded attempts
  const handleRetryFromNode = (nodeId: string) => {
    const updated = rewindToNode(tree, nodeId)
    setTree(updated)
    saveTreeToStorage(updated)
  }

  // Resets test session back to original mock fixture
  const handleReset = () => {
    localStorage.removeItem('vera_conversation_tree_101')
    setTree(loadTreeFromStorage(101))
  }

  const codeBadgeStyle: React.CSSProperties = {
    background: '#e2e8f0',
    color: '#0f172a',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace'
  }

  /**
   * Recursive tree branch renderer for the Educator View.
   * Visually maps hierarchy, fork origins, and active vs. abandoned attempts.
   */
  const renderTreeNode = (nodeId: string, depth = 0, branchLabel = ''): React.ReactNode => {
    const node: DialogueNode | undefined = tree.nodes[nodeId]
    if (!node) return null

    const children = getChildNodes(tree, nodeId)
    const isFork = children.length > 1
    const isActive = node.id === tree.activeNodeId
    const isOnActivePath = activePathIds.has(node.id)

    return (
      <div
        key={node.id}
        style={{
          marginLeft: depth === 0 ? '0' : '20px',
          paddingLeft: depth === 0 ? '0' : '14px',
          borderLeft: depth === 0 ? 'none' : isOnActivePath ? '2px solid #2563eb' : '2px dashed #cbd5e1',
          position: 'relative',
          marginTop: '8px'
        }}
      >
        {branchLabel && (
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: isOnActivePath ? '#1d4ed8' : '#64748b',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>↳ {branchLabel}</span>
            {isOnActivePath ? (
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>
                Active Path
              </span>
            ) : (
              <span style={{ background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>
                Abandoned Branch
              </span>
            )}
          </div>
        )}

        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            border: isActive ? '2px solid #16a34a' : '1px solid #e2e8f0',
            background: isActive ? '#f0fdf4' : isOnActivePath ? '#ffffff' : '#f8fafc',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: node.sender === 'student' ? '#1d4ed8' : '#15803d' }}>
              [{node.sender.toUpperCase()}] <span style={{ color: '#64748b', fontWeight: 400 }}>{node.id}</span>
            </span>

            {isActive ? (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>
                ● CURRENT TIP
              </span>
            ) : isFork ? (
              <span style={{ fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px' }}>
                FORK POINT ({children.length} BRANCHES)
              </span>
            ) : null}
          </div>

          <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.4 }}>
            "{node.text}"
          </div>
        </div>

        {/* Recursive render for all branching children */}
        {children.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            {children.map((child, index) =>
              renderTreeNode(
                child.id,
                depth + 1,
                isFork ? `Branch ${index + 1} of ${children.length}` : ''
              )
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <PageLayout>
      <div style={{ maxWidth: '1150px', margin: '30px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Conversation Tree and Turn-Reversal Demo (Issue #29)
        </h2>
        <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '24px' }}>
          Demonstrates how the tree maintains a linear view for students while preserving full branching history in the background for educators.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', gap: '24px', alignItems: 'start' }}>
          
          {/* STUDENT CHAT VIEW */}
          <div style={{ border: '1px solid #d1d5db', borderRadius: '10px', padding: '20px', background: '#f9fafb' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#111827' }}>Student Chat View</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
              Linear path rendered via <code style={codeBadgeStyle}>getActiveConversationPath()</code>.
            </p>

            <div style={{ minHeight: '360px', maxHeight: '460px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              {activePath.map((node) => {
                const isStudent = node.sender === 'student'
                return (
                  <div
                    key={node.id}
                    style={{
                      alignSelf: isStudent ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      background: isStudent ? '#eff6ff' : '#f0fdf4',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: isStudent ? '1px solid #bfdbfe' : '1px solid #bbf7d0'
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                      <span style={{ color: isStudent ? '#1d4ed8' : '#15803d' }}>{node.sender.toUpperCase()}</span>
                      {isStudent && (
                        <button
                          type="button"
                          onClick={() => handleRetryFromNode(node.parentId || tree.rootNodeId)}
                          style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: 0 }}
                        >
                          ↺ Retry Turn
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: '#111827', lineHeight: 1.4 }}>{node.text}</div>
                  </div>
                )
              })}
            </div>

            <form onSubmit={handleStudentSend} style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question..."
                style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #9ca3af', fontSize: '14px', color: '#111827', background: '#ffffff' }}
              />
              <button type="submit" style={{ padding: '10px 18px', borderRadius: '6px', background: '#2563eb', color: '#ffffff', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '14px' }}>
                Send
              </button>
            </form>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={handleSimulateReply}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '4px', border: '1px solid #9ca3af', cursor: 'pointer', background: '#ffffff', color: '#1f2937' }}
              >
                Simulate Persona Reply
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '4px', border: '1px solid #fca5a5', color: '#dc2626', cursor: 'pointer', background: '#ffffff' }}
              >
                Reset to Mock State
              </button>
            </div>
          </div>

          {/* EDUCATOR AUDIT VIEW: Tree hierarchy with visual forks */}
          <div style={{ border: '1px solid #d1d5db', borderRadius: '10px', padding: '20px', background: '#f9fafb' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#111827' }}>Educator Background Audit</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
              Hierarchical view of <code style={codeBadgeStyle}>tree.nodes</code>. Traces diverging attempts and forks.
            </p>

            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', maxHeight: '460px', overflowY: 'auto' }}>
              {renderTreeNode(tree.rootNodeId)}
            </div>

            <div style={{ marginTop: '16px', fontSize: '13px', color: '#374151', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>
                <strong>Active Node:</strong> <code style={codeBadgeStyle}>{tree.activeNodeId}</code>
              </div>
              <div>
                <strong>Total Turns in Tree:</strong> <strong>{Object.keys(tree.nodes).length}</strong>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PageLayout>
  )
}