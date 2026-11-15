import React, { useMemo } from 'react'
import type { ConversationTree, DialogueNode } from '../types/tree'
import { getActiveConversationPath, getChildNodes } from '../utils/treeUtils'

const TRACK_COLORS = [
  '#a855f7', // Primary conversation path (Purple)
  '#3b82f6', // Revision branch 1 (Blue)
  '#f97316', // Revision branch 2 (Orange)
  '#14b8a6', // Revision branch 3 (Teal)
  '#ec4899', // Revision branch 4 (Pink)
  '#eab308'  // Revision branch 5 (Yellow)
]

export interface ConversationTreeViewProps {
  tree: ConversationTree
  selectedNodeId?: string
  onNodeSelect?: (nodeId: string) => void
  readOnly?: boolean
}

/**
 * ConversationTreeView
 * Visualizes a ConversationTree as a Git-style pipeline with distinct branch rails,
 * commit markers, and educator audit badges.
 */
export default function ConversationTreeView({
  tree,
  selectedNodeId,
  onNodeSelect,
  readOnly = false
}: ConversationTreeViewProps) {
  const currentActiveId = selectedNodeId ?? tree.activeNodeId

  // Calculate active lineage path
  const activePath = useMemo(() => getActiveConversationPath(tree), [tree])
  const activePathIds = useMemo(() => new Set(activePath.map(n => n.id)), [activePath])

  // Sequential order of nodes to maintain stable layout
  const orderedNodes = useMemo(() => {
    const list: DialogueNode[] = []
    const visited = new Set<string>()

    const traverse = (nodeId: string | null) => {
      if (!nodeId || visited.has(nodeId) || !tree.nodes[nodeId]) return
      visited.add(nodeId)
      list.push(tree.nodes[nodeId])
      const children = getChildNodes(tree, nodeId)
      children.forEach(c => traverse(c.id))
    }

    if (tree.rootNodeId) {
      traverse(tree.rootNodeId)
    }

    Object.keys(tree.nodes).forEach(id => {
      if (!visited.has(id)) {
        visited.add(id)
        list.push(tree.nodes[id])
      }
    })

    return list
  }, [tree])

  // Assign track lanes and descriptive branch labels
  const { nodeLanes, branchLabels, maxLane } = useMemo(() => {
    const lanes: Record<string, number> = {}
    const labels: Record<string, string> = {}
    let nextAvailableLane = 0

    orderedNodes.forEach(node => {
      if (!node.parentId) {
        lanes[node.id] = 0
        labels[node.id] = 'Opening Statement'
        nextAvailableLane = 1
      } else {
        const parentLane = lanes[node.parentId] ?? 0
        const parentNode = tree.nodes[node.parentId]
        const isFirstChild = parentNode?.childrenIds?.[0] === node.id

        if (isFirstChild) {
          lanes[node.id] = parentLane
          labels[node.id] = parentLane === 0 ? 'Primary Branch' : `Revision Path ${parentLane}`
        } else {
          if (lanes[node.id] === undefined) {
            const lane = nextAvailableLane++
            lanes[node.id] = lane
            labels[node.id] = `Revision Branch ${lane}`
          }
        }
      }
    })

    const calculatedMax = Math.max(0, ...Object.values(lanes))
    return { nodeLanes: lanes, branchLabels: labels, maxLane: calculatedMax }
  }, [orderedNodes, tree.nodes])

  // Geometry dimensions
  const rowHeight = 48
  const laneWidth = 24
  const xOffset = 22
  const svgWidth = (maxLane + 1) * laneWidth + xOffset + 12
  const svgHeight = orderedNodes.length * rowHeight

  const codeBadgeStyle: React.CSSProperties = {
    background: '#e2e8f0',
    color: '#0f172a',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace'
  }

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '10px', padding: '20px', background: '#f9fafb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Educator Conversation Graph</h3>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>Branch Visualizer</span>
      </div>
      <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px 0' }}>
        Visual audit of conversation paths, retried attempts, and branching history.
      </p>

      <div style={{ background: '#181a20', borderRadius: '8px', border: '1px solid #2e3340', overflow: 'hidden', color: '#e2e8f0' }}>
        <div style={{ background: '#131418', padding: '8px 14px', borderBottom: '1px solid #2e3340', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <strong>Branch History &amp; Forks</strong>
          </div>
          <span>{readOnly ? 'Read-only View' : 'Click any turn to inspect or resume'}</span>
        </div>

        <div style={{ position: 'relative', maxHeight: '480px', overflowY: 'auto', overflowX: 'auto', padding: '10px 0' }}>
          {/* SVG Rails & Connections */}
          <svg width={svgWidth} height={svgHeight} style={{ position: 'absolute', top: '10px', left: '12px', pointerEvents: 'none', zIndex: 1 }}>
            {orderedNodes.map((node, nodeIdx) => {
              const lane = nodeLanes[node.id] ?? 0
              const x = xOffset + lane * laneWidth
              const y = nodeIdx * rowHeight + rowHeight / 2

              return (node.childrenIds || []).map((childId) => {
                const childIdx = orderedNodes.findIndex(r => r.id === childId)
                if (childIdx === -1) return null

                const childLane = nodeLanes[childId] ?? 0
                const childX = xOffset + childLane * laneWidth
                const childY = childIdx * rowHeight + rowHeight / 2
                const strokeColor = TRACK_COLORS[childLane % TRACK_COLORS.length]

                if (childLane === lane) {
                  return (
                    <line
                      key={`${node.id}-${childId}`}
                      x1={x}
                      y1={y}
                      x2={childX}
                      y2={childY}
                      stroke={strokeColor}
                      strokeWidth="2.5"
                    />
                  )
                }

                const d = `M ${x} ${y} C ${x} ${y + rowHeight * 0.55}, ${childX} ${y + rowHeight * 0.25}, ${childX} ${childY}`
                return (
                  <path
                    key={`${node.id}-${childId}`}
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2.5"
                  />
                )
              })
            })}

            {/* Circular Commit Nodes */}
            {orderedNodes.map((node, nodeIdx) => {
              const lane = nodeLanes[node.id] ?? 0
              const x = xOffset + lane * laneWidth
              const y = nodeIdx * rowHeight + rowHeight / 2
              const color = TRACK_COLORS[lane % TRACK_COLORS.length]
              const isHead = node.id === currentActiveId

              return (
                <g key={`point-${node.id}`}>
                  {isHead && (
                    <circle cx={x} cy={y} r="8" fill="none" stroke={color} strokeWidth="2" />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHead ? '5' : '5.5'}
                    fill={isHead ? color : '#181a20'}
                    stroke={color}
                    strokeWidth="2.5"
                  />
                </g>
              )
            })}
          </svg>

          {/* Rows */}
          {orderedNodes.map((node) => {
            const isActive = activePathIds.has(node.id)
            const isCurrentHead = node.id === currentActiveId
            const isPersona = node.sender === 'persona'
            const branchLabel = branchLabels[node.id]

            return (
              <div
                key={node.id}
                onClick={() => {
                  if (!readOnly && onNodeSelect) {
                    onNodeSelect(node.id)
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: `${rowHeight}px`,
                  padding: '0 12px',
                  cursor: readOnly ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                  background: isCurrentHead ? 'rgba(59, 130, 246, 0.14)' : 'transparent'
                }}
              >
                <div style={{ width: `${svgWidth}px`, flexShrink: 0 }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '13px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      background: isPersona ? '#064e3b' : '#1e3a8a',
                      color: isPersona ? '#6ee7b7' : '#93c5fd',
                      flexShrink: 0
                    }}
                  >
                    {node.sender}
                  </span>

                  {isCurrentHead && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: '#1e3a8a',
                        color: '#93c5fd',
                        border: '1px solid #3b82f6',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      Current Conversation
                    </span>
                  )}

                  {!isActive && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: '#2a2c35',
                        color: '#94a3b8',
                        border: '1px dashed #64748b',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                      Previous Attempt
                    </span>
                  )}

                  <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', flexShrink: 0 }}>
                    ({branchLabel})
                  </span>

                  <span style={{ color: isActive ? '#f8fafc' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    "{node.text}"
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: '16px', fontSize: '13px', color: '#374151', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <strong>Active Point:</strong> <code style={codeBadgeStyle}>{currentActiveId}</code>
        </div>
        <div>
          <strong>Total Messages:</strong> <strong>{Object.keys(tree.nodes).length}</strong> | <strong>Paths Explored:</strong> <strong>{maxLane + 1}</strong>
        </div>
      </div>
    </div>
  )
}