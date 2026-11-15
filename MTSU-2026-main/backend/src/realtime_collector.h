#pragma once

#include <chrono>
#include <string>
#include <vector>

#include "realtime_transport.h"
#include "supabase_client.h"

struct CollectorLeaseLost : RealtimeError {
    CollectorLeaseLost()
        : RealtimeError(409, "Collector ownership changed") {}
};

class RealtimeCollector {
public:
    explicit RealtimeCollector(const std::string& sessionId);

    const crow::json::rvalue& info() const {
        return info_;
    }

    void accept(const std::string& event);
    void tick();
    void flush();
    void markGap();
    bool owns();

    bool stopRequested() const {
        return stopRequested_;
    }

    void finish(bool ended, const std::string& reason, bool gap);

    static std::vector<std::string> recoverable();
    static void requestStop(const std::string& sessionId);

private:
    using Clock = std::chrono::steady_clock;

    std::string id_;
    std::string owner_;
    crow::json::rvalue info_;

    std::vector<crow::json::wvalue> pending_;
    size_t pendingBytes_ = 0;

    bool gap_ = false;
    bool dirtyGap_ = false;
    bool stopRequested_ = false;
    bool revoked_ = false;

    Clock::time_point renewAt_;
    Clock::time_point flushAt_;
    Clock::time_point safeUntil_;

    bool heartbeat();
};