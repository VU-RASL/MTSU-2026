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

#include "educator_routes.h"

#include <ctime>
#include <stdexcept>
#include <string>
#include <vector>

#include "assignment.h"
#include "assignment_store.h"
#include "auth.h"
#include "session_result.h"
#include "session_result_store.h"

namespace {

crow::response jsonError(int status, const std::string& message) {
    crow::json::wvalue body;
    body["error"] = message;
    return crow::response(status, body);
}

bool isEducator(const CurrentUser& user) { return isEducatorRole(user.role); }

// Educators see everything; students only what belongs to them.
bool canAccess(const CurrentUser& user, const std::string& studentId) {
    return isEducator(user) || user.id == studentId;
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

template <typename T>
crow::response jsonList(const std::vector<T>& items) {
    std::vector<crow::json::wvalue> out;
    for (const auto& item : items) out.push_back(toJson(item));
    return crow::response(200, crow::json::wvalue(std::move(out)));
}

}  // namespace

void registerEducatorRoutes(EducatorApp& app, AssignmentStore& assignments, SessionResultStore& results) {

    // -------------------------------------------------------------------------
    // GET /api/assignments?studentId=3&status=assigned&scenarioId=2
    // All filters optional. Students always get only their own.
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments").methods("GET"_method)
    ([&assignments](const crow::request& req) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        AssignmentFilter filter;
        if (const char* s = req.url_params.get("studentId")) filter.studentId = s;
        if (const char* s = req.url_params.get("status")) {
            filter.status = s;
            if (!isValidAssignmentStatus(filter.status)) {
                return jsonError(400, "'status' must be assigned, in_progress, completed or reviewed");
            }
        }
        if (const char* s = req.url_params.get("scenarioId")) {
            try {
                size_t used = 0;
                filter.scenarioId = std::stoi(s, &used);
                if (used != std::string(s).size() || filter.scenarioId <= 0) throw std::invalid_argument("");
            } catch (...) {
                return jsonError(400, "'scenarioId' must be a positive whole number");
            }
        }
        if (!isEducator(*user)) filter.studentId = user->id;  // students: own only

        return jsonList(assignments.list(filter));
    });

    // -------------------------------------------------------------------------
    // POST /api/assignments   { "scenarioId": 2, "studentId": "3" }
    // Educators only. Starts as "assigned"; assignedBy = the educator.
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments").methods("POST"_method)
    ([&assignments](const crow::request& req) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");
        if (!isEducator(*user)) return jsonError(403, "Educators only");

        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        Assignment a;
        std::string error;
        if (!applyCreateJson(body, a, error)) return jsonError(400, error);
        if (lookupRole(a.studentId) != Role::Student) {
            return jsonError(400, "'studentId' must be the id of a student in profiles");
        }
        a.assignedBy = user->id;

        return crow::response(201, toJson(assignments.create(a)));
    });

    // -------------------------------------------------------------------------
    // GET /api/assignments/<id>
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments/<int>").methods("GET"_method)
    ([&assignments](const crow::request& req, int id) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        auto a = assignments.get(id);
        if (!a) return jsonError(404, "Assignment not found");
        if (!canAccess(*user, a->studentId)) return jsonError(403, "Not your assignment");
        return crow::response(200, toJson(*a));
    });

    // -------------------------------------------------------------------------
    // PUT /api/assignments/<id>   { "status": "in_progress" }
    // Educators: any valid status. Students: only start their own.
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments/<int>").methods("PUT"_method)
    ([&assignments](const crow::request& req, int id) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");
        if (body.t() != crow::json::type::Object || !body.has("status") ||
            body["status"].t() != crow::json::type::String) {
            return jsonError(400, "'status' is required");
        }
        const std::string status = body["status"].s();
        if (!isValidAssignmentStatus(status)) {
            return jsonError(400, "'status' must be assigned, in_progress, completed or reviewed");
        }

        auto a = assignments.get(id);
        if (!a) return jsonError(404, "Assignment not found");
        if (!canAccess(*user, a->studentId)) return jsonError(403, "Not your assignment");
        if (!isEducator(*user) && status != "in_progress") {
            return jsonError(403, "Students can only set status to in_progress");
        }

        if (!assignments.setStatus(id, status)) return jsonError(404, "Assignment not found");
        a->status = status;
        return crow::response(200, toJson(*a));
    });

    // -------------------------------------------------------------------------
    // DELETE /api/assignments/<id>   (its results are deleted too)
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments/<int>").methods("DELETE"_method)
    ([&assignments](const crow::request& req, int id) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");
        if (!isEducator(*user)) return jsonError(403, "Educators only");

        if (!assignments.remove(id)) return jsonError(404, "Assignment not found");
        return crow::response(204);
    });

    // -------------------------------------------------------------------------
    // GET /api/assignments/<id>/results   every attempt, oldest first
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments/<int>/results").methods("GET"_method)
    ([&assignments, &results](const crow::request& req, int id) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        auto a = assignments.get(id);
        if (!a) return jsonError(404, "Assignment not found");
        if (!canAccess(*user, a->studentId)) return jsonError(403, "Not your assignment");

        return jsonList(results.listForAssignment(id));
    });

    // -------------------------------------------------------------------------
    // POST /api/assignments/<id>/results
    //   { "transcript": [ { "role": "student", "text": "..." }, ... ],
    //     "autoScore": { ... } }                      // optional
    // Saves one attempt and marks the assignment "completed".
    // Called by the session/RTC code when a conversation ends.
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/assignments/<int>/results").methods("POST"_method)
    ([&assignments, &results](const crow::request& req, int id) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        auto a = assignments.get(id);
        if (!a) return jsonError(404, "Assignment not found");
        if (!canAccess(*user, a->studentId)) return jsonError(403, "Not your assignment");

        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        SessionResult r;
        std::string error;
        if (!applySubmitJson(body, r, error)) return jsonError(400, error);
        r.assignmentId = id;
        r.studentId = a->studentId;  // always the assignment's student

        SessionResult saved = results.create(r);
        assignments.setStatus(id, "completed");
        return crow::response(201, toJson(saved));
    });

    // -------------------------------------------------------------------------
    // GET /api/results/<id>
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/results/<int>").methods("GET"_method)
    ([&results](const crow::request& req, int id) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        auto r = results.get(id);
        if (!r) return jsonError(404, "Result not found");
        if (!canAccess(*user, r->studentId)) return jsonError(403, "Not your result");
        return crow::response(200, toJson(*r));
    });

    // -------------------------------------------------------------------------
    // PUT /api/results/<id>/review   { "educatorScore": 90, "educatorFeedback": "..." }
    // Educators only. Records who reviewed and when; assignment -> "reviewed".
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/results/<int>/review").methods("PUT"_method)
    ([&assignments, &results](const crow::request& req, int id) {
        auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");
        if (!isEducator(*user)) return jsonError(403, "Educators only");

        auto r = results.get(id);
        if (!r) return jsonError(404, "Result not found");

        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        std::string error;
        if (!applyReviewJson(body, *r, error)) return jsonError(400, error);
        r->reviewedBy = user->id;
        r->reviewedAt = nowUtc();

        if (!results.saveReview(*r)) return jsonError(404, "Result not found");
        assignments.setStatus(r->assignmentId, "reviewed");
        return crow::response(200, toJson(*r));
    });
}
