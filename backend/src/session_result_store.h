// =============================================================================
// session_result_store.h — reading and writing session results in Supabase
// =============================================================================

#pragma once

#include <optional>
#include <vector>

#include "session_result.h"
#include "supabase_client.h"

class SessionResultStore {
public:
    // Every attempt for one assignment, oldest first.
    std::vector<SessionResult> listForAssignment(int assignmentId) const;

    // One result, or std::nullopt if no result has that id.
    std::optional<SessionResult> get(int id) const;

    // Saves a new attempt (transcript + auto score). Returns the saved copy.
    SessionResult create(const SessionResult& result);

    // Saves the educator's score, feedback, reviewer and review time.
    // Returns false if the id doesn't exist.
    bool saveReview(const SessionResult& result);

private:
    SupabaseClient db_;
};
