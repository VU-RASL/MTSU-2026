#include "realtime_transport.h"
#include "crow/json.h"

#include <curl/websockets.h>
#include <algorithm>
#include <limits>
#include <utility>
#include <iostream>
#include <chrono>
#include <thread>

namespace {

using Curl = std::unique_ptr<CURL, decltype(&curl_easy_cleanup)>;
using Headers = std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)>;

void check(CURLcode code) {
    if (code != CURLE_OK) {
        throw RealtimeError(502, std::string("Realtime transport failed") +
        					curl_easy_strerror(code));
    }
}

template <typename T>
void option(CURL* curl, CURLoption name, T value) {
    check(curl_easy_setopt(curl, name, value));
}

bool safeId(const std::string& id) {
    return !id.empty() && id.size() <= 128 &&
        std::all_of(id.begin(), id.end(), [](unsigned char c) {
            return (c >= 'a' && c <= 'z') ||
                   (c >= 'A' && c <= 'Z') ||
                   (c >= '0' && c <= '9') ||
                   c == '_' || c == '-';
        });
}

Headers authorization(const std::string& key) {
    if (key.empty() || key.size() > 1024 ||
        key.find_first_not_of(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")
            != std::string::npos) {
        throw RealtimeError(503, "OpenAI key is missing or invalid");
    }

    Headers headers(
        curl_slist_append(nullptr, ("Authorization: Bearer " + key).c_str()),
        curl_slist_free_all
    );

    if (!headers) {
        throw RealtimeError(503, "Could not allocate HTTP headers");
    }
    return headers;
}

void configure(CURL* curl, const std::string& url, curl_slist* headers) {
    if (!curl) {
        throw RealtimeError(503, "Could not create Realtime client");
    }

    option(curl, CURLOPT_URL, url.c_str());
    option(curl, CURLOPT_HTTPHEADER, headers);
    option(curl, CURLOPT_CONNECTTIMEOUT, 5L);
    option(curl, CURLOPT_TIMEOUT, 20L);
    option(curl, CURLOPT_NOSIGNAL, 1L);
    option(curl, CURLOPT_SSL_VERIFYPEER, 1L);
    option(curl, CURLOPT_SSL_VERIFYHOST, 2L);
    option(curl, CURLOPT_FOLLOWLOCATION, 0L);
    option(curl, CURLOPT_PROTOCOLS_STR, "https,wss");
    option(curl, CURLOPT_PROXY, "");
}

struct Response {
    std::string body;
    std::string location;
    std::size_t headerBytes = 0;
};

size_t bodyCallback(char* data, size_t size, size_t count, void* output) noexcept {
    if (size && count > std::numeric_limits<size_t>::max() / size) return 0;

    const size_t bytes = size * count;
    auto& response = *static_cast<Response*>(output);
    if (bytes > 65536 - response.body.size()) return 0;

    try {
        response.body.append(data, bytes);
        return bytes;
    } catch (...) {
        return 0;
    }
}

size_t headerCallback(char* data, size_t size, size_t count, void* output) noexcept {
    if (size && count > std::numeric_limits<size_t>::max() / size) return 0;

    const size_t bytes = size * count;
    auto& response = *static_cast<Response*>(output);
    if (bytes > 16384 - response.headerBytes) return 0;
    response.headerBytes += bytes;

    try {
        std::string line(data, bytes);

        if (line.rfind("HTTP/", 0) == 0) {
            response.location.clear();
        }

        const auto colon = line.find(':');
        if (colon == std::string::npos) return bytes;

        std::string name = line.substr(0, colon);
        for (char& c : name) {
            if (c >= 'A' && c <= 'Z') c += 'a' - 'A';
        }

        if (name != "location") return bytes;
        if (!response.location.empty()) return 0;

        const auto first = line.find_first_not_of(" \t", colon + 1);
        const auto last = line.find_last_not_of(" \t\r\n");
        if (first == std::string::npos || last < first) return 0;

        response.location = line.substr(first, last - first + 1);
        return bytes;
    } catch (...) {
        return 0;
    }
}

std::string callId(const std::string& location) {
    for (const std::string prefix : {
        "https://api.openai.com/v1/realtime/calls/",
        "/v1/realtime/calls/"
    }) {
        if (location.rfind(prefix, 0) == 0) {
            const auto id = location.substr(prefix.size());
            if (safeId(id)) return id;
        }
    }
    return "";
}

}

void createRealtimeCall(const std::string& key, const std::string& offer,
                        const std::string& configuration, RealtimeCall& result) {
    Curl curl(curl_easy_init(), curl_easy_cleanup);
    auto headers = authorization(key);
    configure(curl.get(), "https://api.openai.com/v1/realtime/calls", headers.get());

    std::unique_ptr<curl_mime, decltype(&curl_mime_free)> mime(
        curl_mime_init(curl.get()), curl_mime_free
    );
    if (!mime) {
        throw RealtimeError(503, "Could not allocate call request");
    }

    auto add = [&](const char* name, const char* type, const std::string& text) {
        auto* part = curl_mime_addpart(mime.get());
        if (!part) {
            throw RealtimeError(503, "Could not allocate call request");
        }
        check(curl_mime_name(part, name));
        check(curl_mime_type(part, type));
        check(curl_mime_data(part, text.data(), text.size()));
    };

    add("sdp", "application/sdp", offer);
    add("session", "application/json", configuration);
    option(curl.get(), CURLOPT_MIMEPOST, mime.get());

    Response response;
    option(curl.get(), CURLOPT_WRITEFUNCTION, &bodyCallback);
    option(curl.get(), CURLOPT_WRITEDATA, &response);
    option(curl.get(), CURLOPT_HEADERFUNCTION, &headerCallback);
    option(curl.get(), CURLOPT_HEADERDATA, &response);

    result.attempted = true;
    const auto code = curl_easy_perform(curl.get());

    long status = 0;
    const auto info = curl_easy_getinfo(
        curl.get(), CURLINFO_RESPONSE_CODE, &status
    );

    result.id = callId(response.location);

    result.rejected = code == CURLE_OK && info == CURLE_OK &&
        status >= 400 && status < 500 && status != 408;

    result.ok = code == CURLE_OK && info == CURLE_OK &&
        status >= 200 && status < 300 &&
        !result.id.empty() && response.body.rfind("v=0", 0) == 0;

    if (result.ok) result.answer = std::move(response.body);
    if (!result.ok) {
    // Diagnostics must not interfere with session cleanup.
    try {
        std::cerr
            << "[realtime create] HTTP=" << status
            << " curl=" << curl_easy_strerror(code)
            << " call_id_present=" << !result.id.empty()
            << '\n';

        const auto parsed = crow::json::load(response.body);

        if (parsed &&
            parsed.t() == crow::json::type::Object &&
            parsed.has("error") &&
            parsed["error"].t() == crow::json::type::Object) {
            const auto& error = parsed["error"];

            // Log selected error metadata, not the response body,
            // SDP, patient instructions, or credentials.
            crow::json::wvalue details;
            details["source"] = "OpenAI";

            for (const char* field : {"type", "code", "param"}) {
                if (error.has(field) &&
                    error[field].t() == crow::json::type::String) {
                    details[field] =
                        std::string(error[field].s()).substr(0, 200);
                }
            }

            std::cerr
                << "[realtime create] "
                << details.dump()
                << '\n';
        }
    } catch (...) {
        // Preserve the original failure and cleanup behavior.
    }
}
}

bool hangupRealtimeCall(const std::string& key, const std::string& id) {
    if (!safeId(id)) return false;

    try {
        Curl curl(curl_easy_init(), curl_easy_cleanup);
        auto headers = authorization(key);

        configure(
            curl.get(),
            "https://api.openai.com/v1/realtime/calls/" + id + "/hangup",
            headers.get()
        );

        Response response;
        option(curl.get(), CURLOPT_POST, 1L);
        option(curl.get(), CURLOPT_POSTFIELDS, "");
        option(curl.get(), CURLOPT_WRITEFUNCTION, &bodyCallback);
        option(curl.get(), CURLOPT_WRITEDATA, &response);

        const auto code = curl_easy_perform(curl.get());
        long status = 0;
        const auto info = curl_easy_getinfo(
            curl.get(), CURLINFO_RESPONSE_CODE, &status
        );

        return code == CURLE_OK && info == CURLE_OK &&
               ((status >= 200 && status < 300) || status == 404);
    } catch (...) {
        return false;
    }
}

RealtimeChannel::RealtimeChannel(const std::string& key, const std::string& id) {
    if (!safeId(id)) {
        throw RealtimeError(502, "Invalid Realtime call ID");
    }

    headers_ = authorization(key);
    curl_.reset(curl_easy_init());

    configure(
        curl_.get(),
        "wss://api.openai.com/v1/realtime?call_id=" + id,
        headers_.get()
    );

    option(
        curl_.get(), CURLOPT_WRITEFUNCTION,
        +[](char*, size_t, size_t, void*) -> size_t { return 0; }
    );
    option(curl_.get(), CURLOPT_CONNECT_ONLY, 2L);
    check(curl_easy_perform(curl_.get()));
}

void RealtimeChannel::send(const std::string& message) {
    if (message.empty() || message.size() > 128 * 1024) {
        throw RealtimeError(502, "Invalid monitoring message size");
    }

    const auto deadline =
        std::chrono::steady_clock::now() + std::chrono::seconds(5);
    size_t offset = 0;

    while (offset < message.size()) {
        if (std::chrono::steady_clock::now() >= deadline) {
            throw RealtimeError(502, "Monitoring send timed out");
        }

        size_t sent = 0;
        const auto code = curl_ws_send(
            curl_.get(),
            message.data() + offset,
            message.size() - offset,
            &sent,
            0,
            CURLWS_TEXT
        );

        if (code != CURLE_OK && code != CURLE_AGAIN) check(code);
        offset += sent;

        if (offset < message.size()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(20));
        }
    }
}

std::optional<std::string> RealtimeChannel::next() {
    char data[8192];
    size_t size = 0;
    const curl_ws_frame* frame = nullptr;

    const auto code = curl_ws_recv(
        curl_.get(), data, sizeof(data), &size, &frame
    );

    if (code == CURLE_AGAIN) return std::nullopt;
    check(code);

    if (!frame || (frame->flags & CURLWS_CLOSE)) {
        throw RealtimeError(502, "Realtime monitoring disconnected");
    }
    if (frame->flags & (CURLWS_PING | CURLWS_PONG)) {
        return std::nullopt;
    }
    if (frame->flags & CURLWS_BINARY) {
        throw RealtimeError(502, "Unexpected monitoring data");
    }
    if (size > 1024 * 1024 - pending_.size()) {
        throw RealtimeError(502, "Realtime event exceeded the size limit");
    }

    pending_.append(data, size);

    if (frame->bytesleft || (frame->flags & CURLWS_CONT)) {
        return std::nullopt;
    }

    return std::exchange(pending_, "");
}