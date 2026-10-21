// =============================================================================
// learning_topic_store.cpp — the Supabase requests behind each method
// =============================================================================
//
// Supabase REST filters used here:
//   id=eq.3                  "where id = 3"
//   order=position.asc,id.asc  sort by position, then id
//   select=...               which columns to return
// =============================================================================

#include "learning_topic_store.h"

#include <limits>
#include <stdexcept>
#include <string>

namespace {

const char* kColumns = "select=id,created_at,title,content,position";

// One database row (JSON object) -> LearningTopic.
// Throws if Supabase sends something unexpected.
LearningTopic fromRow(const crow::json::rvalue& row) {
    if (row.t() != crow::json::type::Object ||
        !row.has("id") || !row.has("created_at") || !row.has("title") ||
        !row.has("content") || !row.has("position")) {
        throw std::runtime_error("Supabase returned an incomplete learning topic");
    }
    if (row["id"].t() != crow::json::type::Number ||
        row["created_at"].t() != crow::json::type::String ||
        row["title"].t() != crow::json::type::String ||
        row["content"].t() != crow::json::type::String ||
        row["position"].t() != crow::json::type::Number) {
        throw std::runtime_error("Supabase returned invalid learning topic fields");
    }

    const long long id = row["id"].i();
    if (id <= 0 || id > std::numeric_limits<int>::max()) {
        throw std::runtime_error("Supabase returned an invalid learning topic ID");
    }

    LearningTopic topic;
    topic.id = static_cast<int>(id);
    topic.createdAt = std::string(row["created_at"].s()).substr(0, 10);  // keep "YYYY-MM-DD"
    topic.title = std::string(row["title"].s());
    topic.content = std::string(row["content"].s());
    topic.position = static_cast<int>(row["position"].i());
    return topic;
}

// LearningTopic -> JSON body for POST/PATCH. Only the editable columns;
// Supabase manages id and created_at.
std::string toRowBody(const LearningTopic& topic) {
    crow::json::wvalue row;
    row["title"] = topic.title;
    row["content"] = topic.content;
    row["position"] = topic.position;
    return row.dump();
}

}  // namespace

std::vector<LearningTopic> LearningTopicStore::list() const {
    const auto rows = SupabaseClient::parseRows(
        db_.request("GET", std::string("learning_topics?") + kColumns + "&order=position.asc,id.asc"));

    std::vector<LearningTopic> topics;
    for (const auto& row : rows.lo()) {
        topics.push_back(fromRow(row));
    }
    return topics;
}

std::optional<LearningTopic> LearningTopicStore::get(int id) const {
    const auto rows = SupabaseClient::parseRows(
        db_.request("GET", "learning_topics?id=eq." + std::to_string(id) + "&" + kColumns));

    if (rows.size() == 0) return std::nullopt;
    return fromRow(rows[0]);
}

LearningTopic LearningTopicStore::create(const LearningTopic& topic) {
    const auto rows = SupabaseClient::parseRows(
        db_.request("POST", std::string("learning_topics?") + kColumns, toRowBody(topic)));

    if (rows.size() != 1) {
        throw std::runtime_error("Supabase did not return the created learning topic");
    }
    return fromRow(rows[0]);
}

bool LearningTopicStore::update(const LearningTopic& topic) {
    const auto rows = SupabaseClient::parseRows(
        db_.request("PATCH", "learning_topics?id=eq." + std::to_string(topic.id) + "&" + kColumns,
                    toRowBody(topic)));
    return rows.size() == 1;  // 0 rows changed means no topic had that id
}

bool LearningTopicStore::remove(int id) {
    const auto rows = SupabaseClient::parseRows(
        db_.request("DELETE", "learning_topics?id=eq." + std::to_string(id) + "&" + kColumns));
    return rows.size() == 1;  // 0 rows deleted means no topic had that id
}
