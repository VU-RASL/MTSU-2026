// =============================================================================
// class_routes.cpp — see class_routes.h
// =============================================================================

#include "class_routes.h"

#include <iostream>
#include <limits>
#include <optional>
#include <string>
#include <vector>

#include "auth.h"
#include "supabase_client.h"

namespace {

using Json = crow::json::rvalue;
using Value = crow::json::wvalue;
using Type = crow::json::type;

crow::response jsonError(int status, const std::string& message) {
    Value body;
    body["error"] = message;
    auto response = crow::response(status, body);
    if (status == 401) response.set_header("WWW-Authenticate", "Bearer");
    response.set_header("Cache-Control", "no-store");
    return response;
}

crow::response reply(int status, Value body) {
    auto response = crow::response(status, body);
    response.set_header("Cache-Control", "no-store");
    return response;
}

// Logged-in educator/admin, or an error response to send back.
struct Caller {
    std::optional<CurrentUser> user;
    std::optional<crow::response> error;
};

Caller educatorOnly(const crow::request& req) {
    Caller c;
    c.user = currentUser(req);
    if (!c.user) c.error = jsonError(401, "Login required");
    else if (!isEducatorRole(c.user->role)) c.error = jsonError(403, "Educators only");
    return c;
}

bool isAdmin(const CurrentUser& user) { return user.role == Role::Admin; }

// Profile IDs are text made of digits ("12"). Anything else is rejected
// before it gets near a URL.
bool isProfileId(const std::string& id) {
    if (id.empty() || id.size() > 18) return false;
    for (char c : id) if (c < '0' || c > '9') return false;
    return true;
}

std::optional<int> positiveInt(const Json& body, const char* key) {
    if (body.t() != Type::Object || !body.has(key) || body[key].t() != Type::Number) {
        return std::nullopt;
    }
    const auto& v = body[key];
    if (v.nt() != crow::json::num_type::Signed_integer &&
        v.nt() != crow::json::num_type::Unsigned_integer) {
        return std::nullopt;
    }
    if (v.d() < 1 || v.d() > std::numeric_limits<int>::max()) return std::nullopt;
    return static_cast<int>(v.i());
}

std::optional<std::string> textValue(const Json& body, const char* key, size_t maxLen) {
    if (body.t() != Type::Object || !body.has(key) || body[key].t() != Type::String) {
        return std::nullopt;
    }
    std::string s = body[key].s();
    const auto first = s.find_first_not_of(" \t\r\n");
    const auto last = s.find_last_not_of(" \t\r\n");
    s = first == std::string::npos ? "" : s.substr(first, last - first + 1);
    if (s.size() > maxLen) return std::nullopt;
    return s;
}

std::string text(const Json& row, const char* key) {
    return row.has(key) && row[key].t() == Type::String ? std::string(row[key].s()) : "";
}

Json rpc(const SupabaseClient& db, const std::string& name, const Value& body) {
    auto value = crow::json::load(db.request("POST", "rpc/" + name, body.dump()));
    if (!value) throw std::runtime_error("Invalid database response from " + name);
    return value;
}

// {"removed": n, "kept": n} or {"created": n} straight from the SQL function
Value counts(const Json& result) {
    Value out;
    for (const char* key : {"created", "removed", "kept"}) {
        if (result.t() == Type::Object && result.has(key)) out[key] = result[key].i();
    }
    return out;
}

bool isStudent(const SupabaseClient& db, const std::string& id) {
    if (!isProfileId(id)) return false;
    const auto rows = SupabaseClient::parseRows(db.request(
        "GET", "profiles?profile_key=eq." + id + "&role=eq.student&select=profile_key"));
    return rows.size() == 1;
}

// The class row if it exists and this caller may change it.
// Returns 404 for someone else's class so its existence isn't revealed.
std::optional<crow::response> checkClass(const SupabaseClient& db, const CurrentUser& user, int id) {
    const auto rows = SupabaseClient::parseRows(db.request(
        "GET", "classes?id=eq." + std::to_string(id) + "&select=owner_id"));
    if (rows.size() == 0 || (!isAdmin(user) && text(rows[0], "owner_id") != user.id)) {
        return jsonError(404, "Class not found");
    }
    return std::nullopt;
}

std::optional<crow::response> checkModule(const SupabaseClient& db, const CurrentUser& user, int id) {
    const auto rows = SupabaseClient::parseRows(db.request(
        "GET", "modules?id=eq." + std::to_string(id) + "&archived_at=is.null&select=created_by"));
    if (rows.size() == 0 || (!isAdmin(user) && text(rows[0], "created_by") != user.id)) {
        return jsonError(404, "Module not found");
    }
    return std::nullopt;
}

Value moduleJson(const Json& row) {
    Value m;
    m["id"] = row["id"].i();
    m["name"] = text(row, "name");
    m["scenarioId"] = row["scenario_id"].i();
    m["personaId"] = row["persona_id"].i();
    m["createdAt"] = text(row, "created_at");
    return m;
}

const char* kClassSelect =
    "select=id,created_at,course_code,section,owner_id,"
    "class_members(student_id),class_modules(module_id)";

Value classJson(const Json& row) {
    Value c;
    c["id"] = row["id"].i();
    c["courseCode"] = text(row, "course_code");
    c["section"] = text(row, "section");
    c["createdAt"] = text(row, "created_at");

    std::vector<Value> students;
    if (row.has("class_members") && row["class_members"].t() == Type::List) {
        for (const auto& m : row["class_members"].lo()) students.emplace_back(text(m, "student_id"));
    }
    c["studentIds"] = Value(std::move(students));

    std::vector<Value> modules;
    if (row.has("class_modules") && row["class_modules"].t() == Type::List) {
        for (const auto& m : row["class_modules"].lo()) modules.emplace_back(m["module_id"].i());
    }
    c["moduleIds"] = Value(std::move(modules));
    return c;
}

}  // namespace

void registerClassRoutes(EducatorApp& app) {

    // ---------------------------------------------------------------- students

    CROW_ROUTE(app, "/api/students").methods("GET"_method)
    ([](const crow::request& req) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        SupabaseClient db;
        const auto rows = SupabaseClient::parseRows(db.request(
            "GET", "profiles?role=eq.student&select=profile_key,email,name"
                   "&order=email.asc.nullslast,id.asc"));

        std::vector<Value> out;
        for (const auto& row : rows.lo()) {
            Value s;
            s["id"] = text(row, "profile_key");
            s["email"] = text(row, "email");
            s["name"] = text(row, "name");
            out.push_back(std::move(s));
        }
        return reply(200, Value(std::move(out)));
    });

    // ----------------------------------------------------------------- modules

    CROW_ROUTE(app, "/api/modules").methods("GET"_method)
    ([](const crow::request& req) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        SupabaseClient db;
        std::string path = "modules?archived_at=is.null"
                           "&select=id,name,scenario_id,persona_id,created_at"
                           "&order=created_at.desc,id.desc";
        if (!isAdmin(*caller.user)) path += "&created_by=eq." + SupabaseClient::encode(caller.user->id);

        const auto rows = SupabaseClient::parseRows(db.request("GET", path));
        std::vector<Value> out;
        for (const auto& row : rows.lo()) out.push_back(moduleJson(row));
        return reply(200, Value(std::move(out)));
    });

    CROW_ROUTE(app, "/api/modules").methods("POST"_method)
    ([](const crow::request& req) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");
        const auto name = textValue(body, "name", 200);
        const auto scenarioId = positiveInt(body, "scenarioId");
        const auto personaId = positiveInt(body, "personaId");
        if (!name || name->empty()) return jsonError(400, "'name' is required (up to 200 characters)");
        if (!scenarioId) return jsonError(400, "'scenarioId' must be a positive integer");
        if (!personaId) return jsonError(400, "'personaId' must be a positive integer");

        SupabaseClient db;
        const auto scenario = SupabaseClient::parseRows(db.request(
            "GET", "scenarios?id=eq." + std::to_string(*scenarioId) + "&archived_at=is.null&select=id"));
        if (scenario.size() == 0) return jsonError(400, "Scenario not found");
        const auto persona = SupabaseClient::parseRows(db.request(
            "GET", "personas?id=eq." + std::to_string(*personaId) + "&archived_at=is.null&select=id"));
        if (persona.size() == 0) return jsonError(400, "Persona not found");

        Value row;
        row["name"] = *name;
        row["scenario_id"] = *scenarioId;
        row["persona_id"] = *personaId;
        row["created_by"] = caller.user->id;
        const auto saved = SupabaseClient::parseRows(db.request(
            "POST", "modules?select=id,name,scenario_id,persona_id,created_at", row.dump()));
        if (saved.size() != 1) throw std::runtime_error("Module was not saved");
        return reply(201, moduleJson(saved[0]));
    });

    CROW_ROUTE(app, "/api/modules/<int>").methods("DELETE"_method)
    ([](const crow::request& req, int id) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        SupabaseClient db;
        if (auto denied = checkModule(db, *caller.user, id)) return std::move(*denied);

        Value args;
        args["p_module"] = id;
        return reply(200, counts(rpc(db, "vera_delete_module", args)));
    });

    // ----------------------------------------------------------------- classes

    CROW_ROUTE(app, "/api/classes").methods("GET"_method)
    ([](const crow::request& req) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        SupabaseClient db;
        std::string path = std::string("classes?") + kClassSelect + "&order=created_at.desc,id.desc";
        if (!isAdmin(*caller.user)) path += "&owner_id=eq." + SupabaseClient::encode(caller.user->id);

        const auto rows = SupabaseClient::parseRows(db.request("GET", path));
        std::vector<Value> out;
        for (const auto& row : rows.lo()) out.push_back(classJson(row));
        return reply(200, Value(std::move(out)));
    });

    CROW_ROUTE(app, "/api/classes").methods("POST"_method)
    ([](const crow::request& req) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");
        const auto courseCode = textValue(body, "courseCode", 100);
        if (!courseCode || courseCode->empty()) return jsonError(400, "'courseCode' is required (up to 100 characters)");
        std::string section;
        if (body.has("section")) {
            const auto s = textValue(body, "section", 100);
            if (!s) return jsonError(400, "'section' must be text (up to 100 characters)");
            section = *s;
        }

        SupabaseClient db;
        std::vector<std::string> studentIds;
        if (body.has("studentIds")) {
            if (body["studentIds"].t() != Type::List) return jsonError(400, "'studentIds' must be a list");
            for (const auto& s : body["studentIds"].lo()) {
                const std::string sid = s.t() == Type::String ? std::string(s.s()) : "";
                if (!isStudent(db, sid)) return jsonError(400, "Not a student account: " + sid);
                studentIds.push_back(sid);
            }
        }

        Value row;
        row["course_code"] = *courseCode;
        row["section"] = section;
        row["owner_id"] = caller.user->id;
        const auto saved = SupabaseClient::parseRows(db.request("POST", "classes?select=id", row.dump()));
        if (saved.size() != 1) throw std::runtime_error("Class was not saved");
        const int classId = static_cast<int>(saved[0]["id"].i());

        for (const auto& sid : studentIds) {
            Value args;
            args["p_class"] = classId;
            args["p_student"] = sid;
            rpc(db, "vera_add_class_member", args);
        }

        const auto rows = SupabaseClient::parseRows(db.request(
            "GET", "classes?id=eq." + std::to_string(classId) + "&" + kClassSelect));
        return reply(201, classJson(rows[0]));
    });

    CROW_ROUTE(app, "/api/classes/<int>").methods("DELETE"_method)
    ([](const crow::request& req, int id) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        SupabaseClient db;
        if (auto denied = checkClass(db, *caller.user, id)) return std::move(*denied);

        Value args;
        args["p_class"] = id;
        return reply(200, counts(rpc(db, "vera_delete_class", args)));
    });

    // add a student; they get the class's existing modules
    CROW_ROUTE(app, "/api/classes/<int>/students").methods("POST"_method)
    ([](const crow::request& req, int id) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");
        const auto sid = textValue(body, "studentId", 18);
        if (!sid) return jsonError(400, "'studentId' is required");

        SupabaseClient db;
        if (auto denied = checkClass(db, *caller.user, id)) return std::move(*denied);
        if (!isStudent(db, *sid)) return jsonError(400, "Not a student account");

        Value args;
        args["p_class"] = id;
        args["p_student"] = *sid;
        return reply(200, counts(rpc(db, "vera_add_class_member", args)));
    });

    CROW_ROUTE(app, "/api/classes/<int>/students/<string>").methods("DELETE"_method)
    ([](const crow::request& req, int id, const std::string& sid) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);
        if (!isProfileId(sid)) return jsonError(400, "Invalid student ID");

        SupabaseClient db;
        if (auto denied = checkClass(db, *caller.user, id)) return std::move(*denied);

        Value args;
        args["p_class"] = id;
        args["p_student"] = sid;
        return reply(200, counts(rpc(db, "vera_remove_class_member", args)));
    });

    // give a module to the whole class: one assignment per student
    CROW_ROUTE(app, "/api/classes/<int>/modules").methods("POST"_method)
    ([](const crow::request& req, int id) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");
        const auto moduleId = positiveInt(body, "moduleId");
        if (!moduleId) return jsonError(400, "'moduleId' must be a positive integer");

        SupabaseClient db;
        if (auto denied = checkClass(db, *caller.user, id)) return std::move(*denied);
        if (auto denied = checkModule(db, *caller.user, *moduleId)) return std::move(*denied);

        Value args;
        args["p_class"] = id;
        args["p_module"] = *moduleId;
        return reply(200, counts(rpc(db, "vera_assign_module_to_class", args)));
    });

    CROW_ROUTE(app, "/api/classes/<int>/modules/<int>").methods("DELETE"_method)
    ([](const crow::request& req, int id, int moduleId) {
        auto caller = educatorOnly(req);
        if (caller.error) return std::move(*caller.error);

        SupabaseClient db;
        if (auto denied = checkClass(db, *caller.user, id)) return std::move(*denied);

        Value args;
        args["p_class"] = id;
        args["p_module"] = moduleId;
        return reply(200, counts(rpc(db, "vera_unassign_module_from_class", args)));
    });
}
