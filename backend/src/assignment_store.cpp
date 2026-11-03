// =============================================================================
// assignment_store.cpp — the Supabase requests behind each method
// =============================================================================

#include "assignment_store.h"

#include <limits>
#include <stdexcept>

namespace {

const char* kColumns = "select=id,created_at,scenario_id,persona_id,student_id,"
					   "assigned_by,status,archived_at";

// One database row -> Assignment. Throws if Supabase sends something unexpected.
Assignment fromRow(const crow::json::rvalue& row) {
    using crow::json::type;
    if (row.t() != type::Object || !row.has("id") || !row.has("created_at") ||
        !row.has("scenario_id") || !row.has("student_id") || !row.has("assigned_by") ||
        !row.has("status")) {
        throw std::runtime_error("Supabase returned an incomplete assignment");
    }
    if (row["id"].t() != type::Number || row["scenario_id"].t() != type::Number ||
        row["created_at"].t() != type::String || row["student_id"].t() != type::String ||
        row["status"].t() != type::String ||
        (row["assigned_by"].t() != type::String && row["assigned_by"].t() != type::Null)) {
        throw std::runtime_error("Supabase returned invalid assignment fields");
    }

    const long long id = row["id"].i();
    const long long scenarioId = row["scenario_id"].i();
    if (id <= 0 || id > std::numeric_limits<int>::max() ||
        scenarioId <= 0 || scenarioId > std::numeric_limits<int>::max()) {
        throw std::runtime_error("Supabase returned an invalid assignment id");
    }

    Assignment a;
    a.id = static_cast<int>(id);
    a.createdAt = std::string(row["created_at"].s());
    a.scenarioId = static_cast<int>(scenarioId);
    a.studentId = std::string(row["student_id"].s());
    if (row["assigned_by"].t() == type::String) a.assignedBy = std::string(row["assigned_by"].s());
    a.status = std::string(row["status"].s());
    
    if (!row.has("persona_id") || !row.has("archived_at")) {
        throw std::runtime_error("Supabase returned incomplete assignment references");
    }

    const auto& persona = row["persona_id"];
    if (persona.t() != type::Null) {
        if (persona.t() != type::Number ||
            (persona.nt() != crow::json::num_type::Signed_integer &&
             persona.nt() != crow::json::num_type::Unsigned_integer) ||
            persona.d() < 1 || persona.d() > std::numeric_limits<int>::max()) {
            throw std::runtime_error("Supabase returned an invalid assignment persona");
        }
        a.personaId = static_cast<int>(persona.i());
    }

    if (row["archived_at"].t() != type::Null &&
        row["archived_at"].t() != type::String) {
        throw std::runtime_error("Supabase returned an invalid assignment archive time");
    }
    a.archived = row["archived_at"].t() != type::Null;
    
    return a;
}

}  // namespace

std::vector<Assignment> AssignmentStore::list(const AssignmentFilter& filter) const {
    
    std::string path = std::string("assignments?") + kColumns + "&order=created_at.desc,id.desc";
    
    // restrict db query to the verified educator's assignments
    if (!filter.assignedBy.empty()) path += "&assigned_by=eq." + SupabaseClient::encode(filter.assignedBy);
    if (!filter.studentId.empty()) path += "&student_id=eq." + SupabaseClient::encode(filter.studentId);
    if (!filter.status.empty())    path += "&status=eq." + SupabaseClient::encode(filter.status);
    if (filter.scenarioId > 0)     path += "&scenario_id=eq." + std::to_string(filter.scenarioId);

    const auto rows = SupabaseClient::parseRows(db_.request("GET", path));
    std::vector<Assignment> out;
    for (const auto& row : rows.lo()) out.push_back(fromRow(row));
    return out;
}

std::optional<Assignment> AssignmentStore::get(int id) const {
    const auto rows = SupabaseClient::parseRows(
        db_.request("GET", "assignments?id=eq." + std::to_string(id) + "&" + kColumns));
    if (rows.size() == 0) return std::nullopt;
    return fromRow(rows[0]);
}

Assignment AssignmentStore::create(const Assignment& a) {
    crow::json::wvalue row;
	
	if (a.personaId <= 0) throw std::invalid_argument("An approved persona is required");
    row["scenario_id"] = a.scenarioId;
    row["persona_id"] = a.personaId;
    row["student_id"] = a.studentId;
    if (a.assignedBy.empty()) {
        row["assigned_by"] = nullptr;
    } else {
        row["assigned_by"] = a.assignedBy;
    }
    row["status"] = "assigned";

    const auto rows = SupabaseClient::parseRows(
        db_.request("POST", std::string("assignments?") + kColumns, row.dump()));
    if (rows.size() != 1) throw std::runtime_error("Supabase did not return the created assignment");
    return fromRow(rows[0]);
}

bool AssignmentStore::setStatus(int id, const std::string& status) {
    crow::json::wvalue row;
    row["status"] = status;
    const auto rows = SupabaseClient::parseRows(
        db_.request("PATCH", "assignments?id=eq." + std::to_string(id) + "&" + kColumns, row.dump()));
    return rows.size() == 1;
}

bool AssignmentStore::remove(int id) {
    const auto rows = SupabaseClient::parseRows(
        db_.request("DELETE", "assignments?id=eq." + std::to_string(id) + "&" + kColumns));
    return rows.size() == 1;
}
