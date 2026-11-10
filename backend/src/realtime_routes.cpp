#include "realtime_setup.h"

#include <limits>
#include <utility>

#include "assignment_context.h"
#include "patient_instructions.h"
#include "realtime_transport.h"

namespace {

crow::response failure(int status, const std::string& message,
                       const std::string& id = "") {
    crow::json::wvalue body;
    body["error"] = message;
    if (!id.empty()) body["sessionId"] = id;

    auto response = crow::response(status, body);
    response.set_header("Cache-Control", "no-store");

    if (status == 401) {
        response.set_header("WWW-Authenticate", "Bearer");
    }
    return response;
}

template <typename F>
crow::response respond(F action) {
    try {
        auto response = action();
        response.set_header("Cache-Control", "no-store");
        return response;
    } catch (const RealtimeError& e) {
        return failure(e.status, e.what(), e.sessionId);
    } catch (const AssignmentContextError& e) {
        return failure(e.status(), e.what());
    } catch (const PatientInstructionsError& e) {
        return failure(409, e.what());
    } catch (const std::exception&) {
        return failure(503, "Realtime dependency unavailable");
    }
}

std::string uuid(std::string value) {
    if (value.size() != 36) {
        throw RealtimeError(400, "Expected a UUID");
    }

    for (size_t i = 0; i < value.size(); ++i) {
        char& c = value[i];

        if (i == 8 || i == 13 || i == 18 || i == 23) {
            if (c != '-') {
                throw RealtimeError(400, "Expected a UUID");
            }
        } else {
            if (c >= 'A' && c <= 'F') c += 'a' - 'A';

            if (!((c >= '0' && c <= '9') ||
                  (c >= 'a' && c <= 'f'))) {
                throw RealtimeError(400, "Expected a UUID");
            }
        }
    }
    return value;
}

crow::json::rvalue parseBody(const std::string& text) {
    if (text.size() > 128 * 1024) {
        throw RealtimeError(413, "Request is too large");
    }

    int depth = 0;
    bool quoted = false;
    bool escaped = false;

    for (char c : text) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (c == '\\') escaped = true;
            else if (c == '"') quoted = false;
        } else if (c == '"') {
            quoted = true;
        } else if (c == '{' || c == '[') {
            if (++depth > 16) {
                throw RealtimeError(400, "JSON is too deeply nested");
            }
        } else if (c == '}' || c == ']') {
            if (--depth < 0) {
                throw RealtimeError(400, "Invalid JSON");
            }
        }
    }

    auto body = crow::json::load(text);

    if (!body || body.t() != crow::json::type::Object) {
        throw RealtimeError(400, "Expected a JSON object");
    }
    return body;
}

std::string stringField(const crow::json::rvalue& body, const char* name) {
    if (!body.has(name) || body[name].t() != crow::json::type::String) {
        throw RealtimeError(
            400, std::string("Missing or invalid ") + name
        );
    }
    return std::string(body[name].s());
}

}

void registerRealtimeRoutes(EducatorApp& app, RealtimeSetup& setup) {
    CROW_ROUTE(app, "/api/realtime/session").methods("POST"_method)
    ([&setup](const crow::request& req) {
        return respond([&]() -> crow::response {
            const auto user = currentUser(req);

            if (!user) return failure(401, "Login required");
            if (user->role != Role::Student) {
                return failure(403, "Students only");
            }

            const auto body = parseBody(req.body);

            if (!body.has("assignmentId") ||
                body["assignmentId"].t() != crow::json::type::Number ||
                (body["assignmentId"].nt() != crow::json::num_type::Signed_integer &&
                 body["assignmentId"].nt() != crow::json::num_type::Unsigned_integer) ||
                body["assignmentId"].d() < 1 ||
                body["assignmentId"].d() > std::numeric_limits<int>::max()) {
                return failure(400, "assignmentId must be a positive integer");
            }

            const auto key = uuid(stringField(body, "requestKey"));
            const auto offer = stringField(body, "sdp");

            if (offer.size() > 65536 ||
                offer.rfind("v=0", 0) != 0 ||
                offer.find("\nm=audio ") == std::string::npos ||
                offer.find('\0') != std::string::npos) {
                return failure(400, "Expected a bounded audio SDP offer");
            }

            auto result = setup.start(
                *user,
                static_cast<int>(body["assignmentId"].i()),
                key,
                offer
            );

            return crow::response(result.first, result.second);
        });
    });

    CROW_ROUTE(app, "/api/realtime/session/<string>").methods("GET"_method)
    ([&setup](const crow::request& req, const std::string& id) {
        return respond([&]() -> crow::response {
            const auto user = currentUser(req);
            if (!user) return failure(401, "Login required");

            return crow::response(200, setup.get(*user, uuid(id)));
        });
    });

    CROW_ROUTE(app, "/api/realtime/session/<string>/end").methods("POST"_method)
    ([&setup](const crow::request& req, const std::string& id) {
        return respond([&]() -> crow::response {
            const auto user = currentUser(req);
            if (!user) return failure(401, "Login required");

            return crow::response(200, setup.end(*user, uuid(id)));
        });
    });
}