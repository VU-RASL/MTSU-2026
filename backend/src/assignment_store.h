// =============================================================================
// assignment_store.h — reading and writing assignments in Supabase
// =============================================================================

#pragma once

#include <optional>
#include <string>
#include <vector>

#include "assignment.h"
#include "supabase_client.h"

// Optional filters for list(). Empty / 0 means "don't filter on this".
struct AssignmentFilter {
    std::string studentId;
    std::string status;
    int scenarioId = 0;
    std::string assignedBy;
};

class AssignmentStore {
public:
    // Newest first. Only assignments matching every filter that's set.
    std::vector<Assignment> list(const AssignmentFilter& filter = {}) const;

    // One assignment, or std::nullopt if no assignment has that id.
    std::optional<Assignment> get(int id) const;

    // Saves a new assignment (status "assigned"). Returns the saved copy.
    Assignment create(const Assignment& assignment);

    // Changes only the status. Returns false if the id doesn't exist.
    bool setStatus(int id, const std::string& status);

    // Deletes the assignment when db constraints permit
    // Returns false if the assignment doesn't exist
    bool remove(int id);

private:
    SupabaseClient db_;
};
