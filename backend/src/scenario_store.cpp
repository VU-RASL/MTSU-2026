#include "scenario_store.h"

#include <algorithm>
#include <cctype>
#include <ctime>
#include <limits>
#include <stdexcept>
#include <utility>

namespace { 

const char* kColumns = "select=id,created_at,title,summary,setting,difficulty,"
					   "learning_objectives,instructions,patient_situation,required_tasks";
					   
const std::pair<const char*, std::string Scenario::*> kStrings[] = {
	{"title", &Scenario::title},
	{"summary", &Scenario::summary},
	{"setting", &Scenario::setting},
	{"difficulty", &Scenario::difficulty},
	{"instructions", &Scenario::instructions},
	{"patient_situation", &Scenario::patientSituation}
};

const std::pair<const char*, std::vector<std::string> Scenario::*> kLists[] = {
	{"learning_objectives", &Scenario::learningObjectives},
	{"required_tasks", &Scenario::requiredTasks}
};

// read only the columns defined by the scenario table
Scenario fromRow(const crow::json::rvalue& row) {
	using crow::json::type;
	using crow::json::num_type;
	
    if (row.t() != type::Object || !row.has("id") ||
        !row.has("created_at") || row["id"].t() != type::Number ||
        (row["id"].nt() != num_type::Signed_integer &&
         row["id"].nt() != num_type::Unsigned_integer) ||
        row["id"].d() < 1 || row["id"].d() > std::numeric_limits<int>::max() ||
        row["created_at"].t() != type::String) {
        throw std::runtime_error("Supabase returned an invalid scenario");
    }

    Scenario scenario;
    scenario.id = static_cast<int>(row["id"].i());
    scenario.createdAt = std::string(row["created_at"].s());

    for (const auto& [column, member] : kStrings) {
        if (!row.has(column) || row[column].t() != type::String) {
            throw std::runtime_error("Supabase returned invalid scenario text");
        }
        scenario.*member = std::string(row[column].s());
    }

    for (const auto& [column, member] : kLists) {
        if (!row.has(column) || row[column].t() != type::List) {
            throw std::runtime_error("Supabase returned an invalid scenario list");
        }
        for (const auto& item : row[column].lo()) {
            if (item.t() != type::String) {
                throw std::runtime_error("Supabase returned an invalid scenario list item");
            }
            (scenario.*member).emplace_back(item.s());
        }
    }

    if (scenario.title.empty()) {
        throw std::runtime_error("Supabase returned an empty scenario title");
    }
    return scenario;
}

// the database supplies the ID and creation time
std::string toBody(const Scenario& scenario) {
    crow::json::wvalue row;
    for (const auto& [column, member] : kStrings) {
        row[column] = scenario.*member;
    }
    for (const auto& [column, member] : kLists) {
        std::vector<crow::json::wvalue> items;
        for (const auto& item : scenario.*member) items.emplace_back(item);
        row[column] = std::move(items);
    }
    return row.dump();
}

// Helper function to convert a string to lowercase for case-insensitive comparisons.
std::string toLower(std::string text) {
    std::transform(text.begin(), text.end(), text.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return text;
}
}  // namespace 


// page by ID so a large DB can't hide scenarios
std::vector<Scenario> ScenarioStore::list(const std::string& search) const {
    std::vector<Scenario> result;
    const std::string needle = toLower(search);
    int lastId = 0;

    while (true) {
        const auto rows = SupabaseClient::parseRows(db_.request(
            "GET", std::string("scenarios?") + kColumns +
            "&archived_at=is.null&order=id.asc&limit=500&id=gt." +
            std::to_string(lastId)));

        if (rows.size() == 0) break;

        for (const auto& row : rows.lo()) {
            Scenario scenario = fromRow(row);
            if (scenario.id <= lastId) {
                throw std::runtime_error("Supabase returned scenarios out of order");
            }
            lastId = scenario.id;
            if (needle.empty() || toLower(scenario.title).find(needle) != std::string::npos) {
                result.push_back(std::move(scenario));
            }
        }
    }
    return result;
}

// archived scenarios cannot be selected for a new encounter
std::optional<Scenario> ScenarioStore::get(int id) const {
    if (id <= 0) return std::nullopt;
    const auto rows = SupabaseClient::parseRows(db_.request(
        "GET", "scenarios?id=eq." + std::to_string(id) +
        "&archived_at=is.null&" + kColumns));

    if (rows.size() == 0) return std::nullopt;
    if (rows.size() != 1) throw std::runtime_error("Supabase returned multiple scenarios");
    return fromRow(rows[0]);
}

Scenario ScenarioStore::create(Scenario scenario) {
    const auto rows = SupabaseClient::parseRows(db_.request(
        "POST", std::string("scenarios?") + kColumns, toBody(scenario)));

    if (rows.size() != 1) throw std::runtime_error("Supabase did not return the created scenario");
    return fromRow(rows[0]);
}

bool ScenarioStore::update(const Scenario& scenario) {
    if (scenario.id <= 0) return false;
    const auto rows = SupabaseClient::parseRows(db_.request(
        "PATCH", "scenarios?id=eq." + std::to_string(scenario.id) +
        "&archived_at=is.null&" + kColumns, toBody(scenario)));
    return rows.size() == 1;
}

// archive the scenario so assignments can retain their references
bool ScenarioStore::remove(int id) {
    if (id <= 0) return false;

    std::time_t now = std::time(nullptr);
    std::tm utc{};
    if (!gmtime_r(&now, &utc)) throw std::runtime_error("Could not read the current time");
    char timestamp[32];
    if (!std::strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &utc)) {
        throw std::runtime_error("Could not format the current time");
    }

    crow::json::wvalue row;
    row["archived_at"] = timestamp;
    const auto rows = SupabaseClient::parseRows(db_.request(
        "PATCH", "scenarios?id=eq." + std::to_string(id) +
        "&archived_at=is.null&select=id", row.dump()));
    return rows.size() == 1;
}