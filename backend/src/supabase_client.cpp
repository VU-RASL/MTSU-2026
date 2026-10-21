// =============================================================================
// supabase_client.cpp — sending requests to Supabase with libcurl
// =============================================================================

#include "supabase_client.h"

#include <curl/curl.h>

#include <cstdlib>
#include <memory>
#include <stdexcept>

namespace {

// libcurl calls this as response data arrives; we append it to a string.
size_t receiveBody(char* data, size_t size, size_t count, void* output) noexcept {
    const size_t bytes = size * count;
    try {
        static_cast<std::string*>(output)->append(data, bytes);
        return bytes;
    } catch (...) {
        return 0;  // tells libcurl to stop
    }
}

}  // namespace

SupabaseClient::SupabaseClient() {
    const char* url = std::getenv("SUPABASE_URL");
    const char* key = std::getenv("SUPABASE_SECRET_KEY");

    if (!url || !*url || !key || !*key) {
        throw std::runtime_error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
    }

    baseUrl_ = url;
    secretKey_ = key;

    // Allow "https://x.supabase.co/" as well as "https://x.supabase.co"
    while (!baseUrl_.empty() && baseUrl_.back() == '/') {
        baseUrl_.pop_back();
    }

    if (baseUrl_.rfind("https://", 0) != 0) {
        throw std::runtime_error("SUPABASE_URL must use HTTPS");
    }
}

std::string SupabaseClient::request(const std::string& method,
                                    const std::string& path,
                                    const std::string& body) const {
    // unique_ptr with a custom deleter cleans up curl even if we throw
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(curl_easy_init(), &curl_easy_cleanup);
    if (!curl) {
        throw std::runtime_error("Could not create HTTP client");
    }

    std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)> headers(nullptr, &curl_slist_free_all);
    auto addHeader = [&headers](const std::string& value) {
        curl_slist* updated = curl_slist_append(headers.get(), value.c_str());
        if (!updated) {
            throw std::runtime_error("Could not create HTTP headers");
        }
        headers.release();       // the list now lives in `updated`
        headers.reset(updated);
    };

    addHeader("apikey: " + secretKey_);
    addHeader("Accept: application/json");
    addHeader("Content-Type: application/json");
    if (method != "GET") {
        addHeader("Prefer: return=representation");  // send back the changed rows
    }

    const std::string url = baseUrl_ + "/rest/v1/" + path;
    std::string responseBody;

    curl_easy_setopt(curl.get(), CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl.get(), CURLOPT_CUSTOMREQUEST, method.c_str());
    curl_easy_setopt(curl.get(), CURLOPT_HTTPHEADER, headers.get());
    curl_easy_setopt(curl.get(), CURLOPT_WRITEFUNCTION, &receiveBody);
    curl_easy_setopt(curl.get(), CURLOPT_WRITEDATA, &responseBody);
    curl_easy_setopt(curl.get(), CURLOPT_CONNECTTIMEOUT, 5L);
    curl_easy_setopt(curl.get(), CURLOPT_TIMEOUT, 15L);
    curl_easy_setopt(curl.get(), CURLOPT_NOSIGNAL, 1L);  // required for multithreaded use

    if (!body.empty()) {
        curl_easy_setopt(curl.get(), CURLOPT_POSTFIELDS, body.c_str());
        curl_easy_setopt(curl.get(), CURLOPT_POSTFIELDSIZE_LARGE, static_cast<curl_off_t>(body.size()));
    }

    const CURLcode result = curl_easy_perform(curl.get());
    if (result != CURLE_OK) {
        throw std::runtime_error(std::string("Supabase request failed: ") + curl_easy_strerror(result));
    }

    long status = 0;
    curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &status);
    if (status < 200 || status >= 300) {
        throw std::runtime_error("Supabase returned HTTP " + std::to_string(status) + ": " + responseBody);
    }

    return responseBody;
}

crow::json::rvalue SupabaseClient::parseRows(const std::string& response) {
    auto rows = crow::json::load(response);
    if (!rows || rows.t() != crow::json::type::List) {
        throw std::runtime_error("Supabase returned an invalid row list");
    }
    return rows;
}
