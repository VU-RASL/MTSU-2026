// =============================================================================
// conversation_routes.cpp — see conversation_routes.h
// =============================================================================

#include "conversation_routes.h"

#include <iostream>
#include <map>
#include <string>
#include <vector>

#include "assignment.h"
#include "assignment_access.h"
#include "assignment_store.h"
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

crow::response ok(Value body) {
    auto response = crow::response(200, body);
    response.set_header("Cache-Control", "no-store");
    return response;
}

// 36-character UUID, lowercased. Empty string if it isn't one.
std::string normalizeUuid(std::string value) {
    if (value.size() != 36) return "";
    for (size_t i = 0; i < value.size(); ++i) {
        char& c = value[i];
        if (i == 8 || i == 13 || i == 18 || i == 23) {
            if (c != '-') return "";
            continue;
        }
        if (c >= 'A' && c <= 'F') c += 'a' - 'A';
        if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return "";
    }
    return value;
}

// Text column -> string, null -> JSON null.
Value textOrNull(const Json& v) {
    if (v.t() == Type::String) return Value(std::string(v.s()));
    return Value(nullptr);
}

std::string text(const Json& row, const char* key) {
    if (row.t() != Type::Object || !row.has(key) || row[key].t() != Type::String) {
        throw std::runtime_error(std::string("Supabase returned no ") + key);
    }
    return std::string(row[key].s());
}

// Copy any finished voice calls for this assignment into its trees.
// A failure here only means the newest call may be missing for now, so it
// is logged instead of failing the read.
void sync(const SupabaseClient& db, int assignmentId) {
    try {
        Value body;
        body["p_assignment"] = assignmentId;
        db.request("POST", "rpc/vera_sync_assignment_conversations", body.dump());
    } catch (const std::exception& e) {
        std::cerr << "[conversations] sync failed for assignment "
                  << assignmentId << ": " << e.what() << '\n';
    }
}

const char* kConversationColumns =
    "id,assignment_id,status,created_at,updated_at,completed_at,"
    "root_node_id,active_node_id";

}  // namespace

void registerConversationRoutes(EducatorApp& app, AssignmentStore& assignments) {

    // every practice attempt for one assignment, newest first
    CROW_ROUTE(app, "/api/assignments/<int>/conversations").methods("GET"_method)
    ([&assignments](const crow::request& req, int id) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        const auto assignment = assignments.get(id);
        if (!assignment) return jsonError(404, "Assignment not found");
        if (!canAccessAssignment(*user, *assignment)) {
            return jsonError(403, "Not your assignment");
        }

        SupabaseClient db;
        sync(db, id);

        const auto rows = SupabaseClient::parseRows(db.request(
            "GET",
            "conversations?assignment_id=eq." + std::to_string(id) +
            "&select=" + kConversationColumns + ",dialogue_nodes!dialogue_nodes_conversation_id_fkey(count)"
            "&order=created_at.desc,id.desc"));

        std::vector<Value> out;
        for (const auto& row : rows.lo()) {
            Value item;
            item["id"] = text(row, "id");
            item["assignmentId"] = id;
            item["status"] = text(row, "status");
            item["createdAt"] = text(row, "created_at");
            item["updatedAt"] = text(row, "updated_at");
            item["completedAt"] = textOrNull(row["completed_at"]);

            // the root "Conversation started" line isn't something anyone said
            long long lines = 0;
            if (row.has("dialogue_nodes") &&
                row["dialogue_nodes"].t() == Type::List &&
                row["dialogue_nodes"].size() > 0 &&
                row["dialogue_nodes"][0].has("count")) {
                lines = row["dialogue_nodes"][0]["count"].i() - 1;
            }
            item["lineCount"] = lines < 0 ? 0 : lines;
            out.push_back(std::move(item));
        }
        return ok(Value(std::move(out)));
    });

    // one attempt as a ConversationTree (see conversation_routes.h)
    CROW_ROUTE(app, "/api/conversations/<string>/tree").methods("GET"_method)
    ([&assignments](const crow::request& req, const std::string& rawId) {
        const auto user = currentUser(req);
        if (!user) return jsonError(401, "Login required");

        const auto id = normalizeUuid(rawId);
        if (id.empty()) return jsonError(400, "Expected a conversation UUID");

        SupabaseClient db;
        const std::string path =
            "conversations?id=eq." + id + "&select=" + kConversationColumns;

        auto rows = SupabaseClient::parseRows(db.request("GET", path));
        if (rows.size() == 0) return jsonError(404, "Conversation not found");

        const long long assignmentId = rows[0]["assignment_id"].i();
        const auto assignment = assignments.get(static_cast<int>(assignmentId));

        // don't reveal whether someone else's conversation exists
        if (!assignment || !canAccessAssignment(*user, *assignment)) {
            return jsonError(404, "Conversation not found");
        }

        // bring the tree up to date, then re-read the bookmark
        sync(db, assignment->id);
        rows = SupabaseClient::parseRows(db.request("GET", path));
        if (rows.size() == 0) return jsonError(404, "Conversation not found");
        const auto& convo = rows[0];

        const auto nodes = SupabaseClient::parseRows(db.request(
            "GET",
            "dialogue_nodes?conversation_id=eq." + id +
            "&select=id,parent_id,sender,text,created_at,status"
            "&order=created_at.asc,id.asc"));

        // childrenIds in the order the lines were said
        std::map<std::string, std::vector<std::string>> children;
        for (const auto& node : nodes.lo()) {
            if (node["parent_id"].t() == Type::String) {
                children[std::string(node["parent_id"].s())]
                    .push_back(text(node, "id"));
            }
        }

        Value tree;
        tree["conversationId"] = id;
        tree["assignmentId"] = assignment->id;
        tree["scenarioId"] = assignment->scenarioId;
        tree["status"] = text(convo, "status");
        tree["createdAt"] = text(convo, "created_at");
        tree["completedAt"] = textOrNull(convo["completed_at"]);
        tree["rootNodeId"] = textOrNull(convo["root_node_id"]);
        tree["activeNodeId"] = textOrNull(convo["active_node_id"]);
        tree["nodes"] = crow::json::wvalue::object();

        for (const auto& node : nodes.lo()) {
            const auto nodeId = text(node, "id");
            Value out;
            out["id"] = nodeId;
            out["parentId"] = textOrNull(node["parent_id"]);
            out["sender"] = text(node, "sender");
            out["text"] = text(node, "text");
            out["timestamp"] = text(node, "created_at");
            out["status"] = text(node, "status");

            std::vector<Value> kids;
            for (const auto& kid : children[nodeId]) kids.emplace_back(kid);
            out["childrenIds"] = Value(std::move(kids));

            tree["nodes"][nodeId] = std::move(out);
        }
        return ok(std::move(tree));
    });
}
