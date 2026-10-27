// =============================================================================
// assignment.cpp — Assignment <-> JSON
// =============================================================================

#include "assignment.h"

#include <limits>

bool isValidAssignmentStatus(const std::string& status) {
    return status == "assigned" || status == "in_progress" ||
           status == "completed" || status == "reviewed";
}

crow::json::wvalue toJson(const Assignment& a) {
    crow::json::wvalue out;
    out["id"] = a.id;
    out["createdAt"] = a.createdAt;
    out["scenarioId"] = a.scenarioId;
    out["studentId"] = a.studentId;
    if (a.assignedBy.empty()) {
        out["assignedBy"] = nullptr;
    } else {
        out["assignedBy"] = a.assignedBy;
    }
    out["status"] = a.status;
    return out;
}

namespace {

bool isWholeNumber(const crow::json::rvalue& v) {
    return v.t() == crow::json::type::Number &&
           (v.nt() == crow::json::num_type::Signed_integer ||
            v.nt() == crow::json::num_type::Unsigned_integer);
}

}  // namespace

bool applyCreateJson(const crow::json::rvalue& body, Assignment& a, std::string& error) {
    if (body.t() != crow::json::type::Object) {
        error = "Request body must be a JSON object";
        return false;
    }

    // scenarioId: required positive whole number
    if (!body.has("scenarioId") || !isWholeNumber(body["scenarioId"]) ||
        body["scenarioId"].i() <= 0 || body["scenarioId"].i() > std::numeric_limits<int>::max()) {
        error = "'scenarioId' must be a positive whole number";
        return false;
    }
    a.scenarioId = static_cast<int>(body["scenarioId"].i());

    // studentId: required; text, or a whole number (the frontend's sample students use 1, 2, 3)
    if (!body.has("studentId")) {
        error = "'studentId' is required";
        return false;
    }
    const auto& student = body["studentId"];
    if (student.t() == crow::json::type::String) {
        a.studentId = std::string(student.s());
    } else if (isWholeNumber(student)) {
        a.studentId = std::to_string(student.i());
    } else {
        error = "'studentId' must be text or a whole number";
        return false;
    }
    if (a.studentId.empty()) {
        error = "'studentId' is required";
        return false;
    }
    return true;
}
