// ============================================================================= 
// scenario_store.cpp — stores scenarios in Supabase 
// ============================================================================= 
// 
// BIG PICTURE 
// ----------- 
// This file implements the ScenarioStore methods declared in scenario_store.h. 
// 
// This store sends HTTP requests to the Supabase REST API. That means scenarios 
// remain saved when the server restarts. 
// 
// The database stores scenario fields in separate snake_case columns
// (created_at, learning_objectives, required_tasks, estimated_time, ...).
// This file maps them to the camelCase fields used by Scenario and the JSON API.
// 
// =============================================================================

#include "scenario_store.h"

#include <curl/curl.h>
#include <cstdlib>
#include <memory>
#include <stdexcept>
#include <string>
#include <cmath>
#include <limits>
#include <algorithm>
#include <cctype>
#include <utility> 

namespace { 

// Receives the response body returned by Supabase. 
size_t receiveBody(char* data, size_t size, size_t count, void* output) noexcept { 
    const size_t bytes = size * count; 
    
    try { 
        static_cast<std::string*>(output)->append(data, bytes);
        return bytes; 
    } catch (...) { 
        return 0; 
    } 
}

// Converts a string to lowercase for case-insensitive searches. 
std::string toLower(std::string text) { 
    std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c) { 
            return static_cast<char>(std::tolower(c)); 
        } 
    ); 
    return text; 
}

// Columns requested from Supabase, kept in one place.
const char* const kSelect =
    "id,created_at,title,summary,setting,difficulty,learning_objectives,"
    "instructions,patient_situation,required_tasks,estimated_time";

// Converts a Scenario into the JSON object expected by the scenarios table. 
std::string toDatabaseBody(const Scenario& s) {
    crow::json::wvalue row;
    row["title"] = s.title;
    row["summary"] = s.summary;
    row["setting"] = s.setting;
    row["difficulty"] = s.difficulty;
    row["instructions"] = s.instructions;
    row["patient_situation"] = s.patientSituation;
    row["estimated_time"] = s.estimatedTime;

    // Store the vectors as JSON arrays.
    crow::json::wvalue::list objectives;
    for (const auto& objective : s.learningObjectives) {
        objectives.emplace_back(objective);
    }
    row["learning_objectives"] = std::move(objectives);

    crow::json::wvalue::list tasks;
    for (const auto& task : s.requiredTasks) {
        tasks.emplace_back(task);
    }
    row["required_tasks"] = std::move(tasks);

    return row.dump();
}

// Parses a Supabase response containing a list of database rows. 
crow::json::rvalue parseRows(const std::string& response) { 
    auto rows = crow::json::load(response); 
    
    if (!rows || rows.t() != crow::json::type::List) { 
        throw std::runtime_error("Supabase returned an invalid scenario list"); 
    } 
    return rows; 
}

// Reads an optional JSON array of strings from a database row.
std::vector<std::string> readStringList(const crow::json::rvalue& row, const char* key) {
    std::vector<std::string> items;

    if (!row.has(key) || row[key].t() == crow::json::type::Null) {
        return items;
    }
    if (row[key].t() != crow::json::type::List) {
        throw std::runtime_error(std::string("Supabase returned invalid ") + key);
    }

    for (const auto& item : row[key]) {
        if (item.t() != crow::json::type::String) {
            throw std::runtime_error(std::string("Every item in ") + key + " must be a string");
        }
        items.push_back(std::string(item.s()));
    }
    return items;
}

// Converts a database row into a Scenario object.
Scenario fromDatabaseRow(const crow::json::rvalue& row) {
    if (row.t() != crow::json::type::Object ||
        !row.has("id") ||
        !row.has("title") ||
        !row.has("created_at")) {
        throw std::runtime_error("Supabase returned an incomplete scenario");
    }

    if (row["id"].t() != crow::json::type::Number ||
        row["title"].t() != crow::json::type::String) {
        throw std::runtime_error("Supabase returned invalid scenario fields");
    }

    const auto databaseId = row["id"].i();
    if (databaseId <= 0 || databaseId > std::numeric_limits<int>::max()) {
        throw std::runtime_error("Supabase returned an invalid scenario ID");
    }

    Scenario scenario;
    scenario.id = static_cast<int>(databaseId);
    scenario.title = std::string(row["title"].s());

    // Read optional text fields.
    auto readString = [&row](const char* key) -> std::string {
        if (!row.has(key) || row[key].t() == crow::json::type::Null) {
            return "";
        }
        if (row[key].t() != crow::json::type::String) {
            throw std::runtime_error(std::string("Invalid scenario field: ") + key);
        }
        return std::string(row[key].s());
    };

    scenario.summary = readString("summary");
    scenario.setting = readString("setting");
    scenario.difficulty = readString("difficulty");
    scenario.instructions = readString("instructions");
    scenario.patientSituation = readString("patient_situation");
    scenario.createdAt = readString("created_at");

    // Read the estimated time, stored as a number of minutes.
    if (row.has("estimated_time") &&
        row["estimated_time"].t() != crow::json::type::Null) {
        if (row["estimated_time"].t() != crow::json::type::Number) {
            throw std::runtime_error("Supabase returned an invalid estimated_time");
        }

        const double value = row["estimated_time"].d();

        if (!std::isfinite(value) ||
            value < 0 ||
            value > std::numeric_limits<int>::max() ||
            value != std::floor(value)) {
            throw std::runtime_error("Supabase returned an invalid estimated_time");
        }
        scenario.estimatedTime = static_cast<int>(value);
    }

    scenario.learningObjectives = readStringList(row, "learning_objectives");
    scenario.requiredTasks = readStringList(row, "required_tasks");

    return scenario;
}
} // namespace

// Reads the Supabase connection settings from environment variables. 
ScenarioStore::ScenarioStore() { 
    const char* url = std::getenv("SUPABASE_URL"); 
    const char* key = std::getenv("SUPABASE_SECRET_KEY"); 
    
    if (!url || !*url || !key || !*key) { 
        throw std::runtime_error( 
            "Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable" 
        ); 
    }

    baseUrl_ = url;
    secretKey_ = key;

    // Remove trailing slashes from the project URL. 
    while (!baseUrl_.empty() && baseUrl_.back() == '/') { 
        baseUrl_.pop_back(); 
    } 
    
    if (baseUrl_.rfind("https://", 0) != 0) { 
        throw std::runtime_error("SUPABASE_URL must use HTTPS"); 
    } 
}

// Sends an HTTP request to the Supabase REST API. 
std::string ScenarioStore::request( 
    const std::string& method, 
    const std::string& path, 
    const std::string& body 
) const { 
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl( 
        curl_easy_init(), 
        &curl_easy_cleanup 
    );

    if (!curl) { 
        throw std::runtime_error("Could not create HTTP client"); 
    }

    std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)> headers( 
        nullptr, &curl_slist_free_all);

    auto addHeader = [&headers](const std::string& value) { 
        curl_slist* updated = curl_slist_append(headers.get(), value.c_str());

        if (!updated) { 
            throw std::runtime_error("Could not create HTTP headers"); 
        }

        headers.release();
        headers.reset(updated);
    };

    addHeader("apikey: " + secretKey_); 
    addHeader("Authorization: Bearer " + secretKey_); 
    addHeader("Accept: application/json"); 
    addHeader("Content-Type: application/json");

    if (method != "GET") { 
        addHeader("Prefer: return=representation"); 
    }

    const std::string url = baseUrl_ + "/rest/v1/" + path;
    std::string responseBody;

    auto setOption = [&curl](CURLoption option, auto value) { 
        const CURLcode result = curl_easy_setopt(curl.get(), option, value); 
        
        if (result != CURLE_OK) { 
            throw std::runtime_error(std::string("HTTP setup failed: ") + curl_easy_strerror(result)); 
        } 
    };

    setOption(CURLOPT_URL, url.c_str()); 
    setOption(CURLOPT_CUSTOMREQUEST, method.c_str()); 
    setOption(CURLOPT_HTTPHEADER, headers.get()); 
    setOption(CURLOPT_WRITEFUNCTION, &receiveBody); 
    setOption(CURLOPT_WRITEDATA, &responseBody); 
    setOption(CURLOPT_CONNECTTIMEOUT, 5L); 
    setOption(CURLOPT_TIMEOUT, 15L); 
    setOption(CURLOPT_NOSIGNAL, 1L);

    if (!body.empty()) { 
        setOption(CURLOPT_POSTFIELDS, body.c_str()); 
        setOption(CURLOPT_POSTFIELDSIZE_LARGE, static_cast<curl_off_t>(body.size())); 
    }

    const CURLcode result = curl_easy_perform(curl.get());

    if (result != CURLE_OK) { 
        throw std::runtime_error(std::string("Supabase request failed: ") + curl_easy_strerror(result)); 
    }

    long status = 0;

    if (curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &status) != CURLE_OK) { 
        throw std::runtime_error("Could not read Supabase HTTP status"); 
    }

    if (status < 200 || status >= 300) { 
        throw std::runtime_error("Supabase returned HTTP " + std::to_string(status));
    }

    return responseBody;
}

// Creates a new scenario, assigns it an ID and creation timestamp, and stores it.
Scenario ScenarioStore::create(Scenario s) { 
    const auto rows = parseRows(request( "POST", "scenarios", toDatabaseBody(s))); 

    if (rows.size() != 1) { 
        throw std::runtime_error("Supabase did not return the created scenario"); 
    } 

    return fromDatabaseRow(rows[0]); 
}

// Retrieves a scenario by its ID. Returns an optional that is empty if the scenario does not exist.
std::optional<Scenario> ScenarioStore::get(int id) const { 
    if (id <= 0) { 
        return std::nullopt;
    }
    
    const auto rows = parseRows(
        request(
            "GET",
            "scenarios?id=eq." + std::to_string(id) +
            "&select=" + kSelect
        )
    );

    if (rows.size() == 0) { 
        return std::nullopt; 
    } 

    if (rows.size() != 1) { 
        throw std::runtime_error("Supabase returned multiple scenarios for one ID"); 
    } 

    return fromDatabaseRow(rows[0]); 
}

// Lists scenarios from Supabase, optionally filtering by a case-insensitive title search.
std::vector<Scenario> ScenarioStore::list(const std::string& search) const {
    std::vector<Scenario> result; 
    const std::string needle = toLower(search); 
    int lastId = 0; 

    while (true) { 
        const auto rows = parseRows(request(
            "GET",
            "scenarios?select=" + std::string(kSelect) +
            "&order=id.asc&limit=500&id=gt." + std::to_string(lastId))); 

        if (rows.size() == 0) { 
            break; 
        } 

        for (const auto& row : rows) {
            Scenario s = fromDatabaseRow(row); 

            if (s.id <= lastId) { 
                throw std::runtime_error("Supabase returned scenarios out of order"); 
            } 

            lastId = s.id; 

            if (needle.empty() || toLower(s.title).find(needle) != std::string::npos) { 
                result.push_back(std::move(s)); 
            } 
        } 
    } 

    return result; 
}

// Updates an existing scenario. Returns false if the scenario does not exist.
bool ScenarioStore::update(const Scenario& s) { 
    if (s.id <= 0) { 
        return false; 
    } 

    const auto rows = parseRows(request("PATCH", "scenarios?id=eq." + std::to_string(s.id), 
                                        toDatabaseBody(s))); 

    if (rows.size() > 1) {
        throw std::runtime_error("Supabase returned multiple scenarios for one ID"); 
    }

    return rows.size() == 1;
}

// Removes a scenario by its ID. Returns false if the scenario does not exist.
bool ScenarioStore::remove(int id) { 
    if (id <= 0) { 
        return false; 
    } 

    const auto rows = parseRows(
        request("DELETE", 
            "scenarios?id=eq." + std::to_string(id) +
            "&select=id"
        )
    ); 

    if (rows.size() > 1) { 
        throw std::runtime_error("Supabase deleted multiple scenarios for one ID"); 
    } 

    return rows.size() == 1; 
}