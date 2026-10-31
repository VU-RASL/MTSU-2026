// =============================================================================
// persona_store.cpp — how the store does its work
// =============================================================================
//
// BIG PICTURE
// -----------
// The method bodies for PersonaStore (declared in persona_store.h).
// Every method follows the same pattern:
//
//   1. Lock the mutex, so no other request can touch the map right now.
//   2. Do the work on the map (personas_).
//   3. Return. The lock is released automatically when the method ends.
//
// Step 3 works because of std::lock_guard: it locks when it's created and
// unlocks when it goes out of scope (at the closing } of the method), even
// if the method returns early. So there's no way to forget to unlock.
//
// When we switch to the database, the bodies of these five methods are
// what get rewritten; their signatures stay the same.
// =============================================================================

#include "persona_store.h"

#include <curl/curl.h>
#include <cstdlib>
#include <memory>
#include <stdexcept>
#include <string>
#include <limits>
#include <algorithm>
#include <cctype>

// Helpers private to this file (see the note in persona.cpp).
namespace {

size_t receiveBody(char* data, size_t size, size_t count, void* output) noexcept {
    const size_t bytes = size * count;

    try {
        static_cast<std::string*>(output)->append(data, bytes);
        return bytes;
    } catch (...) {
        return 0;
    }
}

std::string toDatabaseBody(const Persona& p) {
    const auto full = toJson(p);
    crow::json::wvalue data(crow::json::wvalue::object{});

    for (const auto& key : full.keys()) {
        if (key != "id" && key != "createdAt" && key != "title") {
            data[key] = crow::json::wvalue(full[key]);
        }
    }

    crow::json::wvalue row;
    row["title"] = p.title;
    row["data"] = std::move(data);

    return row.dump();
}

crow::json::rvalue parseRows(const std::string& response) {
    auto rows = crow::json::load(response);

    if (!rows || rows.t() != crow::json::type::List) {
        throw std::runtime_error("Supabase returned an invalid row list");
    }

    return rows;
}

Persona fromDatabaseRow(const crow::json::rvalue& row) {
    if (row.t() != crow::json::type::Object ||
        !row.has("id") ||
        !row.has("created_at") ||
        !row.has("title") ||
        !row.has("data")) {
        throw std::runtime_error("Supabase returned an incomplete persona");
    }

    if (row["id"].t() != crow::json::type::Number ||
        row["created_at"].t() != crow::json::type::String ||
        row["title"].t() != crow::json::type::String ||
        row["data"].t() != crow::json::type::Object) {
        throw std::runtime_error("Supabase returned invalid persona fields");
    }

    const auto id = row["id"].i();
    if (id <= 0 || id > std::numeric_limits<int>::max()) {
        throw std::runtime_error("Supabase returned an invalid persona ID");
    }

    Persona p;
    p.title = std::string(row["title"].s());

    std::string error;
    if (!applyJson(row["data"], p, error)) {
        throw std::runtime_error("Stored persona data is invalid: " + error);
    }

    p.id = static_cast<int>(id);
    p.title = std::string(row["title"].s());

    p.createdAt = std::string(row["created_at"].s()).substr(0, 10);

    return p;
}

std::string toLower(std::string text) {
    std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));});

    return text;
}
}// namespace

PersonaStore::PersonaStore() {
    const char* url = std::getenv("SUPABASE_URL");
    const char* key = std::getenv("SUPABASE_SECRET_KEY");

    if (!url || !*url || !key || !*key) {
        throw std::runtime_error( "Missing environment variables. Do you have your Supabase keys?");
    }

    baseUrl_ = url;
    secretKey_ = key;

    while (!baseUrl_.empty() && baseUrl_.back() == '/') {
        baseUrl_.pop_back();
    }

    if (baseUrl_.rfind("https://", 0) != 0) {
        throw std::runtime_error("SUPABASE_URL must use HTTPS");
    }
}

std::string PersonaStore::request(
    const std::string& method,
    const std::string& path,
    const std::string& body
) const {
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(
        curl_easy_init(), &curl_easy_cleanup);

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

Persona PersonaStore::create(Persona p) {
    const auto rows = parseRows(request("POST", "personas", toDatabaseBody(p)));

    if (rows.size() != 1) {
        throw std::runtime_error("Supabase did not return the created persona");
    }

    return fromDatabaseRow(rows[0]);
}

std::optional<Persona> PersonaStore::get(int id) const {
    const auto rows = parseRows(request("GET", "personas?id=eq." + std::to_string(id) +
                                        "&select=id,created_at,title,data"));

    if (rows.size() == 0) {
        return std::nullopt;
    }

    if (rows.size() != 1) {
        throw std::runtime_error("Supabase returned multiple personas for one ID");
    }

    return fromDatabaseRow(rows[0]);
}

std::vector<Persona> PersonaStore::list(const std::string& search) const {
    std::vector<Persona> result;
    const std::string needle = toLower(search);
    int lastId = 0;

    while (true) {
        const auto rows = parseRows(request("GET", 
                                            "personas?select=id,created_at,title,data"
                                            "&order=id.asc&limit=500&id=gt." +
                                            std::to_string(lastId)));

        if (rows.size() == 0) {
            break;
        }

        for (const auto& row : rows.lo()) {
            Persona p = fromDatabaseRow(row);

            if (p.id <= lastId) {
                throw std::runtime_error("Supabase returned personas out of order");
            }

            lastId = p.id;

            if (needle.empty() || toLower(p.title).find(needle) != std::string::npos) {
                result.push_back(std::move(p));
            }
        }
    }

    return result;
}

bool PersonaStore::update(const Persona& p) {
    const auto rows = parseRows(request("PATCH", "personas?id=eq." + std::to_string(p.id),
                                        toDatabaseBody(p)));

    if (rows.size() > 1) {
        throw std::runtime_error("Supabase updated multiple personas for one ID");
    }

    return rows.size() == 1;
}

bool PersonaStore::remove(int id) {
    const auto rows = parseRows(request("DELETE", "personas?id=eq." + std::to_string(id)));

    if (rows.size() > 1) {
        throw std::runtime_error("Supabase deleted multiple personas for one ID");
    }

    return rows.size() == 1;
}

std::optional<Persona> PersonaStore::getActive(int id) const {
    if (id <= 0) return std::nullopt;
    const auto rows = parseRows(request(
        "GET", "personas?id=eq." + std::to_string(id) +
        "&archived_at=is.null&select=id,created_at,title,data"));

    if (rows.size() == 0) return std::nullopt;
    if (rows.size() != 1) throw std::runtime_error("Supabase returned multiple personas");
    return fromDatabaseRow(rows[0]);
}