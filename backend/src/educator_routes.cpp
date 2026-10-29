// =============================================================================
// educator_routes.cpp — the Educator Portal API
// =============================================================================
//
// WHO CAN DO WHAT (checked with currentUser() from auth.h; the role comes
// from the profiles table, and admins count as educators):
//
//   route                           educator/admin   student
//   list assignments                all              only their own (filter forced)
//   create / delete assignment      yes              no (403)
//   get assignment                  yes              only their own
//   change status                   any status       only their own -> "in_progress"
//   list / get results              yes              only their own
//   save a result (attempt)         yes              only their own
//   review a result                 yes              no (403)
//
// STATUS FLOW (set automatically where noted):
//   assigned -> in_progress -> completed (when a result is saved)
//            -> reviewed (when an educator reviews a result)
//
// Error responses are always {"error": "message"}:
//   400 bad input, 401 not logged in, 403 not allowed, 404 not found.
// =============================================================================

// TODO: replace the above comment block where appropriate.

#include "educator_routes.h"

#include <ctime>
#include <stdexcept>
#include <string>
#include <vector>

#include "assignment.h"
#include "assignment_access.h"
#include "assignment_store.h"
#include "auth.h"
#include "session_result.h"
#include "session_result_store.h"

namespace {

// return errors in the same JSON format as the other routes
crow::response jsonError(int status, const std::string& message) {
    crow::json::wvalue body;
    body["error"] = message;
    auto response = crow::response(status, body);
    if (status == 401) response.set_header("WWW-Authenticate", "Bearer");
    return response;
}

// Current time in UTC, e.g. "2026-10-26T16:00:00Z"
std::string nowUtc() {
    std::time_t now = std::time(nullptr);
    std::tm utc{};
    gmtime_r(&now, &utc);
    char buf[32];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &utc);
    return buf;
}

// turn a list of records into a JSON response
template <typename T>
crow::response jsonList(const std::vector<T>& items) {
    std::vector<crow::json::wvalue> out;
    for (const auto& item : items) out.push_back(toJson(item));
    return crow::response(200, crow::json::wvalue(std::move(out)));
}

}  // namespace

void registerEducatorRoutes(EducatorApp& app, AssignmentStore& assignments, SessionResultStore& results) {

    CROW_ROUTE(app, "/api/assignments").methods("GET"_method)
    ([&assignments](const crow::request& req) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        AssignmentFilter filter;
        if (const char* value = req.url_params.get("studentId")) {
            filter.studentId = value;
        }
        
        if (const char* value = req.url_params.get("status")) {
            filter.status = value;
            if (!isValidAssignmentStatus(filter.status)) {
                return jsonError(400, "'status' must be assigned, in_progress, completed or reviewed");
            }
        }

        if (const char* value = req.url_params.get("scenarioId")) {
            try {
                size_t used = 0;
                filter.scenarioId = std::stoi(value, &used);
                if (used != std::string(value).size() || filter.scenarioId <= 0) throw std::invalid_argument("");
            } catch (...) {
                return jsonError(400, "'scenarioId' must be a positive whole number");
            }
        }

        // a student cannot request another student's assignments
        // an educator cannot choose a different assignment owner
        if (user->role == Role::Student) {
            filter.studentId = user->id;
        } else if (user->role == Role::Educator) {
            filter.assignedBy = user->id;
        } else if (user->role != Role::Admin) {
            return jsonError(403, "Access denied");
        }

        return jsonList(assignments.list(filter));
    });

    // create an assignment and record the verified caller as its owner
    CROW_ROUTE(app, "/api/assignments").methods("POST"_method)
    ([&assignments](const crow::request& req) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");
        if (!isEducatorRole(user->role)) return jsonError(403, "Educators only");

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        Assignment assignment;
        std::string error;
        if (!applyCreateJson(body, assignment, error)) return jsonError(400, error);
        if (lookupRole(assignment.studentId) != Role::Student) {
            return jsonError(400, "'studentId' must be the id of a student in profiles");
        }

        // never accept the owner ID from the request body
        assignment.assignedBy = user->id;
        return crow::response(201, toJson(assignments.create(assignment)));
    });

    // get one assignment after checking the caller's access
    CROW_ROUTE(app, "/api/assignments/<int>").methods("GET"_method)
    ([&assignments](const crow::request& req, int id) {
        
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        const auto assignment = assignments.get(id);
        if (!assignment) return jsonError(404, "Assignment not found");
        if (!canAccessAssignment(*user, *assignment)) return jsonError(403, "Not your assignment");
        return crow::response(200, toJson(*assignment));
    });

    // change the status of an authorized assignment
    CROW_ROUTE(app, "/api/assignments/<int>").methods("PUT"_method)
    ([&assignments](const crow::request& req, int id) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        auto assignment = assignments.get(id);
        if (!assignment) return jsonError(404, "Assignment not found");
        if (!canAccessAssignment(*user, *assignment)) {
            return jsonError(403, "Not your assignment");
        }

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");
        if (body.t() != crow::json::type::Object || !body.has("status") ||
            body["status"].t() != crow::json::type::String) {
            return jsonError(400, "'status' is required");
        }
        const std::string status = body["status"].s();
        if (!isValidAssignmentStatus(status)) {
            return jsonError(400, "'status' must be assigned, in_progress, completed or reviewed");
        }

        // students can only start their own assignments
        if (user->role == Role::Student && status != "in_progress") {
            return jsonError(403, "Students can only set status to in_progress");
        }

        if (!assignments.setStatus(id, status)) return jsonError(404, "Assignment not found");
        assignment->status = status;
        return crow::response(200, toJson(*assignment));
    });

    // only the owning educator or an admin can request deletion
    // existing db constraints still protect retained results
    CROW_ROUTE(app, "/api/assignments/<int>").methods("DELETE"_method)
    ([&assignments](const crow::request& req, int id) {
        
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");
        if (!isEducatorRole(user->role)) return jsonError(403, "Educators only");
        
        const auto assignment = assignments.get(id);
        if (!assignment) return jsonError(404, "Assignment not found");
        if (!canManageAssignment(*user, *assignment)) return jsonError(403, "Not your assignment");
        if (!assignments.remove(id)) return jsonError(404, "Assignment not found");
        return crow::response(204);
    });

    // result lists inherit access from their assignment
    CROW_ROUTE(app, "/api/assignments/<int>/results").methods("GET"_method)
    ([&assignments, &results](const crow::request& req, int id) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        const auto assignment = assignments.get(id);
        if (!assignment) return jsonError(404, "Assignment not found");
        if (!canAccessAssignment(*user, *assignment)) return jsonError(403, "Not your assignment");

        return jsonList(results.listForAssignment(id));
    });

    // keep the existing manual result submission route
    // trusted Realtime left for next time
    // TODO: implement trusted Realtime finalization
    CROW_ROUTE(app, "/api/assignments/<int>/results").methods("POST"_method)
    ([&assignments, &results](const crow::request& req, int id) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        const auto assignment = assignments.get(id);
        if (!assignment) return jsonError(404, "Assignment not found");
        if (!canAccessAssignment(*user, *assignment)) return jsonError(403, "Not your assignment");

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        SessionResult result;
        std::string error;
        if (!applySubmitJson(body, result, error)) return jsonError(400, error);
        

        // the assignment decides which student owns this result
        result.assignmentId = id;
        result.studentId = assignment->studentId;

        const auto saved = results.create(result);
        assignments.setStatus(id, "completed");
        return crow::response(201, toJson(saved));
    });

    // a direct result ID does not bypass assignment ownership
    CROW_ROUTE(app, "/api/results/<int>").methods("GET"_method)
    ([&assignments, &results](const crow::request& req, int id) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        const auto result = results.get(id);
        if (!result) return jsonError(404, "Result not found");
        
        const auto assignment = assignments.get(result->assignmentId);
        if (!assignment || result->studentId != assignment->studentId) {
            return jsonError(404, "Result not found");
        }
        if (!canAccessAssignment(*user, *assignment)) {
            return jsonError(403, "Not your result");
        }
        
        return crow::response(200, toJson(*result));
    });

    // only the owning educator or an admin can review a result
    CROW_ROUTE(app, "/api/results/<int>/review").methods("PUT"_method)
    ([&assignments, &results](const crow::request& req, int id) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");
        if (!isEducatorRole(user->role)) return jsonError(403, "Educators only");

        auto result = results.get(id);
        if (!result) return jsonError(404, "Result not found");

        const auto assignment = assignments.get(result->assignmentId);
        if (!assignment || result->studentId != assignment->studentId) {
            return jsonError(404, "Result not found");
        }
        if (!canManageAssignment(*user, *assignment)) {
            return jsonError(403, "Not your result");
        }

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        std::string error;
        if (!applyReviewJson(body, *result, error)) return jsonError(400, error);
        

        // the reviewer is always the verified caller
        result->reviewedBy = user->id;
        result->reviewedAt = nowUtc();

        if (!results.saveReview(*result)) return jsonError(404, "Result not found");
        assignments.setStatus(result->assignmentId, "reviewed");
        return crow::response(200, toJson(*result));
    });
}
