// =============================================================================
// session_result.h — one attempt at an assignment, plus the educator's review
// =============================================================================
//
// Supabase table `session_results`:
//   id, created_at, assignment_id, student_id, transcript (jsonb),
//   auto_score (jsonb), educator_score, educator_feedback, reviewed_by, reviewed_at
//
// JSON (camelCase):
//   { "id": 7, "createdAt": "...", "assignmentId": 1, "studentId": "3",
//     "transcript": [ { "id": "t1", "role": "student", "text": "Hi", "at": "..." },
//                     { "id": "t2", "role": "patient", "text": "Hello", "at": "..." } ],
//     "autoScore": { "score": 80, "tasksCompleted": ["..."] },   // or null
//     "educatorScore": 90,                                        // or null
//     "educatorFeedback": "Good rapport.",
//     "reviewedBy": "dev-educator",                               // or null
//     "reviewedAt": "2026-10-26T16:00:00Z" }                      // or null
//
// Transcript turns: "role" is "student" or "patient", "text" is required;
// "id" and "at" are optional. The list leaves room for the rewind/delete
// feature later (e.g. a "deleted": true flag on a turn).
// =============================================================================

#pragma once

#include <optional>
#include <string>
#include "crow.h"

struct SessionResult {
    int id = 0;
    std::string createdAt;
    int assignmentId = 0;
    std::string studentId;
    std::string transcriptJson = "[]";      // the transcript, as JSON text
    std::string autoScoreJson;              // JSON text; empty = null
    std::optional<double> educatorScore;    // 0-100, or not graded yet
    std::string educatorFeedback;
    std::string reviewedBy;                 // empty = not reviewed
    std::string reviewedAt;                 // empty = not reviewed
};

crow::json::wvalue toJson(const SessionResult& result);

// Reads a new result from a POST body:
//   { "transcript": [ ...turns... ], "autoScore": { ... } or null }
// transcript is required. Returns false and fills `error` if invalid.
bool applySubmitJson(const crow::json::rvalue& body, SessionResult& result, std::string& error);

// Reads an educator review from a PUT body:
//   { "educatorScore": 90 or null, "educatorFeedback": "..." }
// At least one of the two is required. Returns false and fills `error` if invalid.
bool applyReviewJson(const crow::json::rvalue& body, SessionResult& result, std::string& error);
