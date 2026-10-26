// =============================================================================
// session_result_store.cpp — the Supabase requests behind each method
// =============================================================================

#include "session_result_store.h"

#include <limits>
#include <stdexcept>
#include <string>

namespace {

const char* kColumns =
    "select=id,created_at,assignment_id,student_id,transcript,auto_score,"
    "educator_score,educator_feedback,reviewed_by,reviewed_at";

// Optional text column: string, or null -> "".
std::string textOrEmpty(const crow::json::rvalue& v) {
    return v.t() == crow::json::type::String ? std::string(v.s()) : std::string();
}

// One database row -> SessionResult. Throws if Supabase sends something unexpected.
SessionResult fromRow(const crow::json::rvalue& row) {
    using crow::json::type;
    for (const char* key : {"id", "created_at", "assignment_id", "student_id", "transcript",
                            "auto_score", "educator_score", "educator_feedback",
                            "reviewed_by", "reviewed_at"}) {
        if (row.t() != type::Object || !row.has(key)) {
            throw std::runtime_error("Supabase returned an incomplete session result");
        }
    }
    if (row["id"].t() != type::Number || row["assignment_id"].t() != type::Number ||
        row["created_at"].t() != type::String || row["student_id"].t() != type::String ||
        row["transcript"].t() != type::List) {
        throw std::runtime_error("Supabase returned invalid session result fields");
    }

    const long long id = row["id"].i();
    const long long assignmentId = row["assignment_id"].i();
    if (id <= 0 || id > std::numeric_limits<int>::max() ||
        assignmentId <= 0 || assignmentId > std::numeric_limits<int>::max()) {
        throw std::runtime_error("Supabase returned an invalid session result id");
    }

    SessionResult r;
    r.id = static_cast<int>(id);
    r.createdAt = std::string(row["created_at"].s());
    r.assignmentId = static_cast<int>(assignmentId);
    r.studentId = std::string(row["student_id"].s());
    r.transcriptJson = crow::json::wvalue(row["transcript"]).dump();
    if (row["auto_score"].t() != type::Null) {
        r.autoScoreJson = crow::json::wvalue(row["auto_score"]).dump();
    }
    if (row["educator_score"].t() == type::Number) r.educatorScore = row["educator_score"].d();
    r.educatorFeedback = textOrEmpty(row["educator_feedback"]);
    r.reviewedBy = textOrEmpty(row["reviewed_by"]);
    r.reviewedAt = textOrEmpty(row["reviewed_at"]);
    return r;
}

}  // namespace

std::vector<SessionResult> SessionResultStore::listForAssignment(int assignmentId) const {
    const auto rows = SupabaseClient::parseRows(db_.request(
        "GET", "session_results?assignment_id=eq." + std::to_string(assignmentId) + "&" + kColumns +
                   "&order=created_at.asc,id.asc"));
    std::vector<SessionResult> out;
    for (const auto& row : rows.lo()) out.push_back(fromRow(row));
    return out;
}

std::optional<SessionResult> SessionResultStore::get(int id) const {
    const auto rows = SupabaseClient::parseRows(
        db_.request("GET", "session_results?id=eq." + std::to_string(id) + "&" + kColumns));
    if (rows.size() == 0) return std::nullopt;
    return fromRow(rows[0]);
}

SessionResult SessionResultStore::create(const SessionResult& r) {
    crow::json::wvalue row;
    row["assignment_id"] = r.assignmentId;
    row["student_id"] = r.studentId;
    row["transcript"] = crow::json::wvalue(crow::json::load(r.transcriptJson));
    if (r.autoScoreJson.empty()) {
        row["auto_score"] = nullptr;
    } else {
        row["auto_score"] = crow::json::wvalue(crow::json::load(r.autoScoreJson));
    }

    const auto rows = SupabaseClient::parseRows(
        db_.request("POST", std::string("session_results?") + kColumns, row.dump()));
    if (rows.size() != 1) throw std::runtime_error("Supabase did not return the created session result");
    return fromRow(rows[0]);
}

bool SessionResultStore::saveReview(const SessionResult& r) {
    crow::json::wvalue row;
    if (r.educatorScore) {
        row["educator_score"] = *r.educatorScore;
    } else {
        row["educator_score"] = nullptr;
    }
    row["educator_feedback"] = r.educatorFeedback;
    row["reviewed_by"] = r.reviewedBy;
    row["reviewed_at"] = r.reviewedAt;

    const auto rows = SupabaseClient::parseRows(db_.request(
        "PATCH", "session_results?id=eq." + std::to_string(r.id) + "&" + kColumns, row.dump()));
    return rows.size() == 1;
}
