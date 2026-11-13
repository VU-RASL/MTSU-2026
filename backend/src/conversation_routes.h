// =============================================================================
// conversation_routes.h — saved conversation trees (practice attempts)
// =============================================================================
//
// One conversation = one practice attempt at an assignment. Its lines form a
// tree: rewinding to an earlier line and saying something new makes a branch.
// Tables and SQL functions: database/15_conversation_tree.sql
//
// Routes (read-only; voice calls fill the tree, see realtime_setup.cpp):
//   GET /api/assignments/<id>/conversations   every attempt, newest first
//   GET /api/conversations/<id>/tree          one attempt as a ConversationTree
//
// Who can read: the student who owns the assignment, and the educator who
// assigned it (admins too). Same rule as assignment results.
//
// The tree JSON matches frontend/src/types/tree.ts:
//   { conversationId, assignmentId, scenarioId, status, createdAt,
//     completedAt, rootNodeId, activeNodeId,
//     nodes: { "<id>": { id, parentId, sender, text, timestamp,
//                         childrenIds, status } } }
//   sender is "student", "persona", or "system" (the root line).
//   node status is "completed" or "interrupted" (cut off mid-sentence).
// =============================================================================

#pragma once

#include "educator_routes.h"

class AssignmentStore;

void registerConversationRoutes(EducatorApp& app, AssignmentStore& assignments);
