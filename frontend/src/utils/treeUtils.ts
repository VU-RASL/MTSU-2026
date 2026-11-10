import type { ConversationTree, DialogueNode, SenderType } from '../types/tree'

const STORAGE_KEY_PREFIX = 'vera_conversation_tree_'

/**
 * Traverses parent pointers from active node to root.
 * Returns chronological array (root -> leaf) for the active chat view.
 */
export function getActiveConversationPath(tree: ConversationTree): DialogueNode[] {
  const path: DialogueNode[] = []
  let currentId: string | null = tree.activeNodeId

  while (currentId && tree.nodes[currentId]) {
    const node: DialogueNode = tree.nodes[currentId]
    path.unshift(node)
    currentId = node.parentId
  }

  return path
}

/**
 * Appends a turn under activeNodeId, updates parent childrenIds,
 * and advances activeNodeId to the new node.
 */
export function addDialogueNode(
  tree: ConversationTree,
  sender: SenderType,
  text: string
): ConversationTree {
  const newNodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const parentId = tree.activeNodeId

  const newNode: DialogueNode = {
    id: newNodeId,
    parentId,
    sender,
    text,
    timestamp: new Date().toISOString(),
    childrenIds: []
  }

  const updatedNodes: Record<string, DialogueNode> = {
    ...tree.nodes,
    [newNodeId]: newNode
  }

  if (parentId && updatedNodes[parentId]) {
    const parentNode: DialogueNode = updatedNodes[parentId]
    updatedNodes[parentId] = {
      ...parentNode,
      childrenIds: [...parentNode.childrenIds, newNodeId]
    }
  }

  return {
    ...tree,
    rootNodeId: tree.rootNodeId || newNodeId,
    activeNodeId: newNodeId,
    nodes: updatedNodes
  }
}

/**
 * Sets active pointer to a prior node to branch off without deleting history.
 */
export function rewindToNode(tree: ConversationTree, targetNodeId: string): ConversationTree {
  if (!tree.nodes[targetNodeId]) {
    console.warn(`Node "${targetNodeId}" not found in conversation tree.`)
    return tree
  }

  return {
    ...tree,
    activeNodeId: targetNodeId
  }
}

/**
 * Returns child branches originating from a specific node for educator review.
 */
export function getChildNodes(tree: ConversationTree, nodeId: string): DialogueNode[] {
  const node: DialogueNode | undefined = tree.nodes[nodeId]
  if (!node) return []

  return node.childrenIds
    .map((childId: string) => tree.nodes[childId])
    .filter((child): child is DialogueNode => Boolean(child))
}

/**
 * Initializes a new conversation tree with the starting persona/system greeting.
 */
export function createConversationTree(
  scenarioId: number,
  initialGreeting: string,
  sender: SenderType = 'persona'
): ConversationTree {
  const rootId = `root_${Date.now()}`
  const rootNode: DialogueNode = {
    id: rootId,
    parentId: null,
    sender,
    text: initialGreeting,
    timestamp: new Date().toISOString(),
    childrenIds: []
  }

  return {
    scenarioId,
    rootNodeId: rootId,
    activeNodeId: rootId,
    nodes: {
      [rootId]: rootNode
    }
  }
}

/* -------------------------------------------------------------------------- */
/* FALLBACK & OFFLINE PERSISTENCE HELPERS                                     */
/* -------------------------------------------------------------------------- */

/**
 * Static mock fixture with an existing branched retry for offline demos.
 */
export const mockConversationTree: ConversationTree = {
  scenarioId: 101,
  rootNodeId: 'node_root',
  activeNodeId: 'node_branch_2',
  nodes: {
    node_root: {
      id: 'node_root',
      parentId: null,
      sender: 'persona',
      text: 'Good morning. I have had a dull ache in my chest since breakfast.',
      timestamp: '2026-03-31T09:00:00.000Z',
      childrenIds: ['node_branch_1', 'node_retry_1']
    },
    node_branch_1: {
      id: 'node_branch_1',
      parentId: 'node_root',
      sender: 'student',
      text: 'Is the pain sharp or dull?',
      timestamp: '2026-03-31T09:01:00.000Z',
      childrenIds: ['node_branch_1_reply']
    },
    node_branch_1_reply: {
      id: 'node_branch_1_reply',
      parentId: 'node_branch_1',
      sender: 'persona',
      text: 'I just told you it feels like a dull ache.',
      timestamp: '2026-03-31T09:01:30.000Z',
      childrenIds: []
    },
    node_retry_1: {
      id: 'node_retry_1',
      parentId: 'node_root',
      sender: 'student',
      text: 'Does the pain spread to your left arm or jaw?',
      timestamp: '2026-03-31T09:02:15.000Z',
      childrenIds: ['node_branch_2']
    },
    node_branch_2: {
      id: 'node_branch_2',
      parentId: 'node_retry_1',
      sender: 'persona',
      text: 'Yes, actually. It feels tight down my left arm.',
      timestamp: '2026-03-31T09:02:45.000Z',
      childrenIds: []
    }
  }
}

/**
 * Persists a conversation tree to localStorage for offline testing and state recovery.
 */
export function saveTreeToStorage(tree: ConversationTree): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${tree.scenarioId}`
    localStorage.setItem(key, JSON.stringify(tree))
  } catch (err) {
    console.error('Failed to save tree to localStorage:', err)
  }
}

/**
 * Loads a tree from localStorage. If none is saved, falls back to the mock tree.
 */
export function loadTreeFromStorage(scenarioId: number): ConversationTree {
  try {
    const key = `${STORAGE_KEY_PREFIX}${scenarioId}`
    const rawData = localStorage.getItem(key)
    if (rawData) {
      return JSON.parse(rawData) as ConversationTree
    }
  } catch (err) {
    console.warn(`Failed reading tree for scenario ${scenarioId}:`, err)
  }
  return { ...mockConversationTree, scenarioId }
}