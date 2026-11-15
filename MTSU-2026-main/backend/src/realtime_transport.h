#pragma once

#include <curl/curl.h>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>

struct RealtimeError : std::runtime_error {
    int status;
    std::string sessionId;

    RealtimeError(int code, const std::string& message, const std::string& id = "")
        : std::runtime_error(message), status(code), sessionId(id) {}
};

struct RealtimeCall {
    bool attempted = false;
    bool rejected = false;
    bool ok = false;
    std::string id;
    std::string answer;
};

void createRealtimeCall(const std::string& key, const std::string& offer,
                        const std::string& configuration, RealtimeCall& result);

bool hangupRealtimeCall(const std::string& key, const std::string& id);

class RealtimeChannel {
public:
    RealtimeChannel(const std::string& key, const std::string& id);
    void send(const std::string& message);
    std::optional<std::string> next();

private:
    std::unique_ptr<CURL, decltype(&curl_easy_cleanup)>
        curl_{nullptr, curl_easy_cleanup};

    std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)>
        headers_{nullptr, curl_slist_free_all};

    std::string pending_;
};