// Defines who sent the message turn
export type SenderType = 'student' | 'persona' | 'system'

// Individual turn in the conversation
export interface DialogueNode {
  id: string              // Unique identifier (e.g., "node_1", "node_2a")
  parentId: string | null // null for initial root greeting
  sender: SenderType
  text: string
  timestamp: string
  childrenIds: string[]   // Branching turns forked from this node
}

// Full conversation structure
export interface ConversationTree {
  scenarioId: number
  rootNodeId: string
  activeNodeId: string    // Tracks current turn in the chat view
  nodes: Record<string, DialogueNode> // Fast lookup map: nodeId -> DialogueNode
}