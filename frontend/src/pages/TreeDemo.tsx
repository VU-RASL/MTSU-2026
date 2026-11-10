import React, { useState, useMemo, useRef, useEffect } from 'react'
import PageLayout from '../components/PageLayout'
import ConversationTreeView from '../components/ConversationTreeView'
import type { ConversationTree } from '../types/tree'
import {
  loadTreeFromStorage,
  saveTreeToStorage,
  getActiveConversationPath,
  addDialogueNode,
  rewindToNode
} from '../utils/treeUtils'

/**
 * TreeDemo (Issue #29)
 * Verification fixture connecting the interactive Student Chat to the new ConversationTreeView.
 */
export default function TreeDemo() {
  const [tree, setTree] = useState<ConversationTree>(() => loadTreeFromStorage(101))
  const [inputMessage, setInputMessage] = useState('')
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const activePath = useMemo(() => getActiveConversationPath(tree), [tree])

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [activePath])

  const handleStudentSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return

    const updated = addDialogueNode(tree, 'student', inputMessage.trim())
    setTree(updated)
    saveTreeToStorage(updated)
    setInputMessage('')
  }

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

  const handleRetryFromNode = (nodeId: string) => {
    const updated = rewindToNode(tree, nodeId)
    setTree(updated)
    saveTreeToStorage(updated)
  }

  const handleReset = () => {
    localStorage.removeItem('vera_conversation_tree_101')
    setTree(loadTreeFromStorage(101))
  }

  const handleNodeSelect = (nodeId: string) => {
    const updated = { ...tree, activeNodeId: nodeId }
    setTree(updated)
    saveTreeToStorage(updated)
  }

  const codeBadgeStyle: React.CSSProperties = {
    background: '#e2e8f0',
    color: '#0f172a',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace'
  }

  return (
    <PageLayout>
      <div style={{ maxWidth: '1240px', margin: '30px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Conversation Tree &amp; Revision Visualizer (Issue #29)
        </h2>
        <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '24px' }}>
          Maintains a clean linear path for students while preserving full branching history in a Git-style pipeline for educator review.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Panel: Student Chat */}
          <div style={{ border: '1px solid #d1d5db', borderRadius: '10px', padding: '20px', background: '#f9fafb' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#111827' }}>Student Chat View</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
              Linear path rendered via <code style={codeBadgeStyle}>getActiveConversationPath()</code>.
            </p>

            <div
              ref={chatScrollRef}
              style={{
                minHeight: '380px',
                maxHeight: '480px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}
            >
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
                          onClick={() => handleRetryFromNode(node.parentId || tree.rootNodeId || '')}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#b91c1c',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                          <span style={{ textDecoration: 'underline' }}>Retry Turn</span>
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
                style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #9ca3af', fontSize: '14px', color: '#111827', background: '#ffffff', outline: 'none' }}
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

          {/* Right Panel: Reusable ConversationTreeView Component */}
          <ConversationTreeView
            tree={tree}
            selectedNodeId={tree.activeNodeId}
            onNodeSelect={handleNodeSelect}
          />
        </div>
      </div>
    </PageLayout>
  )
}