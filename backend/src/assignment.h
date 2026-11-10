// =============================================================================
// assignment.h — a scenario assigned to a student
// =============================================================================
//
// Supabase table `assignments`:
//   id, created_at, scenario_id, student_id, assigned_by, status
//
// JSON (camelCase):
//   { "id": 1, "createdAt": "2026-10-26T15:00:00+00:00", "scenarioId": 2,
//     "studentId": "3", "assignedBy": "dev-educator", "status": "assigned" }
//
// Status flow: assigned -> in_progress -> completed -> reviewed
// =============================================================================

#pragma once

#include <string>
#include "crow.h"

struct Assignment {
    int id = 0;
    std::string createdAt;
    int scenarioId = 0;
    int personaId = 0;
    bool archived = false;
    std::string studentId;              // text until the user tables exist
    std::string assignedBy;             // educator's user id; empty = unknown
    std::string status = "assigned";
};

// True for "assigned", "in_progress", "completed", "reviewed".
bool isValidAssignmentStatus(const std::string& status);

crow::json::wvalue toJson(const Assignment& assignment);

// Reads a new assignment from a POST body: { "scenarioId": 2, "studentId": "3" }.
// studentId may be a string or a whole number (stored as text).
// Returns false and fills `error` if a field is missing or the wrong type.
bool applyCreateJson(const crow::json::rvalue& body, Assignment& assignment, std::string& error);
