import { api } from './http'
import type { ConversationTree } from '../types/tree'

// One practice attempt at an assignment. Students can have many.
export type ConversationSummary = {
  id: string
  assignmentId: number
  status: 'in_progress' | 'completed'
  createdAt: string
  updatedAt: string
  completedAt: string | null
  lineCount: number
}

// The saved tree. Same shape as ConversationTree, plus a few extras,
// so it can go straight into <ConversationTreeView readOnly />.
export type SavedConversationTree = ConversationTree & {
  conversationId: string
  assignmentId: number
  status: 'in_progress' | 'completed'
  createdAt: string
  completedAt: string | null
}

// GET /api/assignments/<id>/conversations  (newest attempt first)
// The student who owns the assignment, or the educator who assigned it.
export const listConversations = (assignmentId: number) =>
  api<ConversationSummary[]>(`/api/assignments/${assignmentId}/conversations`)

// GET /api/conversations/<id>/tree
// Each node also has status: 'completed' | 'interrupted' (cut off mid-sentence).
export const getConversationTree = (conversationId: string) =>
  api<SavedConversationTree>(`/api/conversations/${conversationId}/tree`)
