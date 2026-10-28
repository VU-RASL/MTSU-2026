#include "crow/json.h"

#include <curl/curl.h>
#include <curl/websockets.h>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <thread>

namespace {

using Clock = std::chrono::steady_clock;

constexpr size_t kMaxMessageBytes = 1024 * 1024;
constexpr size_t kMaxOutputBytes = 64 * 1024;

void checkCurl(CURLcode result) {
    if (result != CURLE_OK) {
        throw std::runtime_error(std::string("Realtime transport failed: ") +
                                 curl_easy_strerror(result));
    }
}

void checkDeadline(Clock::time_point deadline) {
    if (Clock::now() >= deadline) {
        throw std::runtime_error("Realtime test timed out");
    }
}

std::string stringField(const crow::json::rvalue& value, const char* key) {
    if (value.t() != crow::json::type::Object || !value.has(key) ||
        value[key].t() != crow::json::type::String) {
        throw std::runtime_error("Realtime returned an invalid event");
    }

    return std::string(value[key].s());
}

void checkDepth(const std::string& text) {
    int depth = 0;
    bool quoted = false;
    bool escaped = false;

    for (char c : text) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (c == '\\') escaped = true;
            else if (c == '"') quoted = false;
        } else if (c == '"') {
            quoted = true;
        } else if (c == '{' || c == '[') {
            if (++depth > 64) {
                throw std::runtime_error("Realtime JSON is too deeply nested");
            }
        } else if (c == '}' || c == ']') {
            if (--depth < 0) {
                throw std::runtime_error("Realtime returned invalid JSON");
            }
        }
    }
}

void sendEvent(CURL* curl, const std::string& text, Clock::time_point deadline) {
    size_t offset = 0;

    while (offset < text.size()) {
        checkDeadline(deadline);
        size_t sent = 0;
        const CURLcode result = curl_ws_send(
            curl, text.data() + offset, text.size() - offset, &sent,
            offset == 0 ? static_cast<curl_off_t>(text.size()) : 0,
            CURLWS_TEXT | CURLWS_OFFSET);

        if (result == CURLE_AGAIN) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }

        checkCurl(result);
        offset += sent;

        if (sent == 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    }
}

crow::json::rvalue receiveEvent(CURL* curl, Clock::time_point deadline) {
    std::string message;

    while (true) {
        checkDeadline(deadline);
        char buffer[4096];
        size_t received = 0;
        const curl_ws_frame* frame = nullptr;
        const CURLcode result = curl_ws_recv(
            curl, buffer, sizeof(buffer), &received, &frame);

        if (result == CURLE_AGAIN) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }

        checkCurl(result);

        if (!frame || (frame->flags & CURLWS_CLOSE)) {
            throw std::runtime_error("Realtime connection closed early");
        }

        if (frame->flags & (CURLWS_PING | CURLWS_PONG)) continue;

        if (frame->flags & CURLWS_BINARY) {
            throw std::runtime_error("Realtime returned unexpected binary data");
        }

        if (received > kMaxMessageBytes - message.size()) {
            throw std::runtime_error("Realtime event exceeded the size limit");
        }

        message.append(buffer, received);

        if (frame->bytesleft != 0 || (frame->flags & CURLWS_CONT)) continue;

        checkDepth(message);
        auto event = crow::json::load(message);

        if (!event || event.t() != crow::json::type::Object) {
            throw std::runtime_error("Realtime returned invalid JSON");
        }

        return event;
    }
}

size_t rejectBody(char*, size_t, size_t, void*) noexcept {
    return 0;
}

void checkRealtime() {
    const auto* version = curl_version_info(CURLVERSION_NOW);
    bool supportsWebSocket = false;

    if (version && version->protocols) {
        for (const char* const* protocol = version->protocols; *protocol; ++protocol) {
            if (std::string(*protocol) == "wss") supportsWebSocket = true;
        }
    }

    if (!supportsWebSocket) {
        throw std::runtime_error("libcurl must be built with WSS support");
    }

    const char* key = std::getenv("OPENAI_API_KEY");

    if (!key || !*key) {
        throw std::runtime_error("Missing OPENAI_API_KEY");
    }

    const std::string secretKey = key;

    if (secretKey.size() > 1024 ||
        secretKey.find_first_not_of(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-") !=
            std::string::npos) {
        throw std::runtime_error("Invalid OPENAI_API_KEY format");
    }

    std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)> headers(
        nullptr, &curl_slist_free_all);
    headers.reset(curl_slist_append(
        nullptr, ("Authorization: Bearer " + secretKey).c_str()));

    if (!headers) {
        throw std::runtime_error("Could not create authorization header");
    }

    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(
        curl_easy_init(), &curl_easy_cleanup);

    if (!curl) {
        throw std::runtime_error("Could not create Realtime client");
    }

    auto setOption = [&curl](CURLoption option, auto value) {
        checkCurl(curl_easy_setopt(curl.get(), option, value));
    };

    setOption(CURLOPT_URL, "wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1");
    setOption(CURLOPT_HTTPHEADER, headers.get());
    setOption(CURLOPT_CONNECT_ONLY, 2L);
    setOption(CURLOPT_CONNECTTIMEOUT, 10L);
    setOption(CURLOPT_TIMEOUT, 15L);
    setOption(CURLOPT_NOSIGNAL, 1L);
    setOption(CURLOPT_SSL_VERIFYPEER, 1L);
    setOption(CURLOPT_SSL_VERIFYHOST, 2L);
    setOption(CURLOPT_FOLLOWLOCATION, 0L);
    setOption(CURLOPT_PROXY, "");
    setOption(CURLOPT_WRITEFUNCTION, &rejectBody);
    checkCurl(curl_easy_perform(curl.get()));

    const auto deadline = Clock::now() + std::chrono::seconds(30);
    auto initial = receiveEvent(curl.get(), deadline);

    if (stringField(initial, "type") != "session.created") {
        throw std::runtime_error("Realtime did not create a session");
    }

    crow::json::wvalue request;
    request["type"] = "response.create";
    request["response"]["output_modalities"][0] = "text";
    request["response"]["max_output_tokens"] = 64;
    request["response"]["conversation"] = "none";
    request["response"]["input"][0]["type"] = "message";
    request["response"]["input"][0]["role"] = "user";
    request["response"]["input"][0]["content"][0]["type"] = "input_text";
    request["response"]["input"][0]["content"][0]["text"] =
        "Reply with one short sentence confirming this connection works.";
    sendEvent(curl.get(), request.dump(), deadline);

    size_t outputBytes = 0;
    std::string responseId;

    for (size_t count = 0; count < 1000; ++count) {
        const auto event = receiveEvent(curl.get(), deadline);
        const std::string type = stringField(event, "type");

        if (type == "error") {
            throw std::runtime_error("OpenAI returned a Realtime API error");
        }

        if (type == "response.created") {
            responseId = stringField(event["response"], "id");
        } else if (type == "response.output_text.delta") {
            if (responseId.empty() || stringField(event, "response_id") != responseId) {
                throw std::runtime_error("Realtime response ID mismatch");
            }

            const std::string delta = stringField(event, "delta");

            if (delta.size() > kMaxOutputBytes - outputBytes) {
                throw std::runtime_error("Realtime output exceeded the size limit");
            }

            outputBytes += delta.size();
        } else if (type == "response.done") {
            const auto& response = event["response"];

            if (responseId.empty() || stringField(response, "id") != responseId ||
                stringField(response, "status") != "completed" || outputBytes == 0) {
                throw std::runtime_error("Realtime response did not complete with text");
            }

            std::cout << "PASS: Realtime streamed " << outputBytes << " text bytes\n";
            return;
        }
    }

    throw std::runtime_error("Realtime event limit exceeded");
}

}

int main() {
    if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) {
        std::cerr << "FAIL: Could not initialize libcurl\n";
        return EXIT_FAILURE;
    }

    int result = EXIT_SUCCESS;

    try {
        checkRealtime();
    } catch (const std::exception& error) {
        std::cerr << "FAIL: " << error.what() << '\n';
        result = EXIT_FAILURE;
    }

    curl_global_cleanup();
    return result;
}
