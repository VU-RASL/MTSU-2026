#include "realtime_collector.h"

#include <cmath>
#include <set>
#include <thread>
#include <iostream>

namespace {

using Json = crow::json::rvalue;
using Value = crow::json::wvalue;
using Type = crow::json::type;

Json rpc(const std::string& name, const Value& body) {
    const auto payload = body.dump();

    for (int attempt = 0; attempt < 2; ++attempt) {
        try {
            SupabaseClient db;
            auto value = crow::json::load(
                db.request("POST", "rpc/" + name, payload)
            );

            if (!value) {
                throw RealtimeError(
                    503, "Invalid collector response"
                );
            }

            return value;
        } catch (const std::exception&) {
            if (attempt == 1) {
                throw RealtimeError(
                    503, "Collector database unavailable"
                );
            }

            std::this_thread::sleep_for(
                std::chrono::milliseconds(100)
            );
        }
    }

    throw RealtimeError(503, "Collector database unavailable");
}

std::string requiredText(
    const Json& value,
    const char* name,
    size_t limit
) {
    if (value.t() != Type::Object ||
        !value.has(name) ||
        value[name].t() != Type::String) {
        throw RealtimeError(
            502, "Invalid collector event field"
        );
    }

    std::string result = value[name].s();

    if (result.empty() || result.size() > limit) {
        throw RealtimeError(
            502, "Collector event field exceeds limit"
        );
    }

    return result;
}

void copyText(
    const Json& source,
    Value& target,
    const char* name,
    size_t limit,
    bool nullable = false
) {
    if (!source.has(name)) {
        return;
    }

    if (nullable && source[name].t() == Type::Null) {
        target[name] = nullptr;
        return;
    }

    if (source[name].t() != Type::String) {
        throw RealtimeError(502, "Invalid collector text");
    }

    const std::string text = source[name].s();

    if (text.size() > limit) {
        throw RealtimeError(502, "Collector text exceeds limit");
    }

    target[name] = text;
}

void copyNumber(
    const Json& source,
    Value& target,
    const char* name
) {
    if (!source.has(name)) {
        return;
    }

    if (source[name].t() != Type::Number) {
        throw RealtimeError(502, "Invalid usage counter");
    }

    const double number = source[name].d();

    if (!std::isfinite(number) || number < 0 || number > 1e12) {
        throw RealtimeError(502, "Usage counter exceeds limit");
    }

    target[name] = Value(source[name]);
}

Value usage(const Json& source) {
    if (source.t() != Type::Object) {
        throw RealtimeError(502, "Invalid usage object");
    }

    Value result(crow::json::load("{}"));

    copyText(source, result, "type", 32);

    for (const char* name : {
        "total_tokens", "input_tokens", "output_tokens", "seconds"
    }) {
        copyNumber(source, result, name);
    }

    for (const char* name : {
        "input_token_details", "output_token_details"
    }) {
        if (!source.has(name) || source[name].t() == Type::Null) {
            continue;
        }

        const auto& details = source[name];

        if (details.t() != Type::Object) {
            throw RealtimeError(502, "Invalid usage details");
        }

        Value filtered(crow::json::load("{}"));

        for (const char* counter : {
            "text_tokens", "audio_tokens", "image_tokens",
            "cached_tokens", "reasoning_tokens"
        }) {
            copyNumber(details, filtered, counter);
        }

        if (details.has("cached_tokens_details") &&
            details["cached_tokens_details"].t() != Type::Null) {
            const auto& cached = details["cached_tokens_details"];

            if (cached.t() != Type::Object) {
                throw RealtimeError(502, "Invalid cached usage");
            }

            Value counters(crow::json::load("{}"));

            for (const char* counter : {
                "text_tokens", "audio_tokens", "image_tokens"
            }) {
                copyNumber(cached, counters, counter);
            }

            filtered["cached_tokens_details"] = std::move(counters);
        }

        result[name] = std::move(filtered);
    }

    return result;
}

Value part(const Json& source) {
    if (source.t() != Type::Object) {
        throw RealtimeError(502, "Invalid content part");
    }

    Value result;
    result["type"] = requiredText(source, "type", 64);

    if (source.has("text") && source["text"].t() != Type::Null) {
        copyText(source, result, "text", 262144);
    }

    if (source.has("transcript") &&
        source["transcript"].t() != Type::Null) {
        copyText(source, result, "transcript", 262144);
    }

    // Audio bytes are deliberately not copied.
    return result;
}

Value item(const Json& source) {
    if (source.t() != Type::Object) {
        throw RealtimeError(502, "Invalid conversation item");
    }

    Value result;
    result["id"] = requiredText(source, "id", 256);

    for (const char* name : {"type", "role", "status"}) {
        copyText(source, result, name, 64);
    }

    if (source.has("content") &&
        source["content"].t() != Type::Null) {
        const auto& content = source["content"];

        if (content.t() != Type::List || content.size() > 64) {
            throw RealtimeError(502, "Invalid item content");
        }

        std::vector<Value> parts;

        for (const auto& entry : content.lo()) {
            parts.push_back(part(entry));
        }

        result["content"] = Value(std::move(parts));
    }

    return result;
}

Json parseEvent(const std::string& text) {
    if (text.size() > 1024 * 1024) {
        throw RealtimeError(502, "Collector event too large");
    }

    int depth = 0;
    bool quoted = false;
    bool escaped = false;

    for (char c : text) {
        if (quoted) {
            if (escaped) {
                escaped = false;
            } else if (c == '\\') {
                escaped = true;
            } else if (c == '"') {
                quoted = false;
            }
        } else if (c == '"') {
            quoted = true;
        } else if (c == '{' || c == '[') {
            if (++depth > 32) {
                throw RealtimeError(502, "Collector event too deep");
            }
        } else if (c == '}' || c == ']') {
            if (--depth < 0) {
                throw RealtimeError(502, "Invalid collector JSON");
            }
        }
    }

    auto result = crow::json::load(text);

    if (!result || result.t() != Type::Object) {
        throw RealtimeError(502, "Invalid collector JSON");
    }

    return result;
}

const std::set<std::string> collectedTypes = {
    "conversation.item.added",
    "conversation.item.created",
    "conversation.item.done",
    "input_audio_buffer.committed",
    "response.output_item.added",
    "response.output_item.done",
    "response.content_part.added",
    "response.content_part.done",
    "response.output_audio_transcript.delta",
    "response.output_audio_transcript.done",
    "response.output_text.delta",
    "response.output_text.done",
    "conversation.item.input_audio_transcription.delta",
    "conversation.item.input_audio_transcription.completed",
    "conversation.item.input_audio_transcription.failed",
    "response.created",
    "response.done",
    "conversation.item.truncated",
    "conversation.item.deleted"
};

Value project(const Json& source) {
    Value result;

    result["event_id"] = requiredText(source, "event_id", 256);
    result["type"] = requiredText(source, "type", 128);

    for (const char* name : {"item_id", "response_id"}) {
        copyText(source, result, name, 256);
    }

    copyText(source, result, "previous_item_id", 256, true);

    for (const char* name : {"text", "transcript", "delta"}) {
        copyText(source, result, name, 262144);
    }

    for (const char* name : {"content_index", "audio_end_ms"}) {
        copyNumber(source, result, name);
    }

    if (source.has("item")) {
        result["item"] = item(source["item"]);
    }

    if (source.has("part")) {
        result["part"] = part(source["part"]);
    }

    if (source.has("usage") && source["usage"].t() != Type::Null) {
        result["usage"] = usage(source["usage"]);
    }

    if (source.has("response")) {
        const auto& response = source["response"];
        Value filtered;

        filtered["id"] = requiredText(response, "id", 256);
        copyText(response, filtered, "status", 64);
        copyText(response, filtered, "conversation_id", 256, true);

        if (response.has("usage") &&
            response["usage"].t() != Type::Null) {
            filtered["usage"] = usage(response["usage"]);
        }

        if (response.has("output") &&
            response["output"].t() != Type::Null) {
            if (response["output"].t() != Type::List ||
                response["output"].size() > 64) {
                throw RealtimeError(502, "Invalid response output");
            }

            std::vector<Value> output;

            for (const auto& entry : response["output"].lo()) {
                output.push_back(item(entry));
            }

            filtered["output"] = Value(std::move(output));
        }

        result["response"] = std::move(filtered);
    }

    return result;
}

} // namespace

RealtimeCollector::RealtimeCollector(const std::string& sessionId)
    : id_(sessionId) {
    const auto began = Clock::now();

    Value body;
    body["p_session"] = id_;

    info_ = rpc("vera_claim_collector", body);

    if (!info_.has("acquired") ||
        info_["acquired"].t() != Type::True) {
        throw CollectorLeaseLost();
    }

    owner_ = requiredText(info_, "owner", 36);
    gap_ = info_["gap"].t() == Type::True;
    stopRequested_ = info_["stop"].t() == Type::True;

    safeUntil_ = began + std::chrono::seconds(60);
    renewAt_ = Clock::now() + std::chrono::seconds(15);
    flushAt_ = Clock::now() + std::chrono::milliseconds(250);
}

bool RealtimeCollector::heartbeat() {
    const auto began = Clock::now();

    Value body;
    body["p_session"] = id_;
    body["p_owner"] = owner_;

    auto reply = rpc("vera_collector_heartbeat", body);

    if (!reply.has("owned") || reply["owned"].t() != Type::True) {
        revoked_ = true;
        return false;
    }

    stopRequested_ = reply["stop"].t() == Type::True;
    safeUntil_ = began + std::chrono::seconds(60);
    renewAt_ = Clock::now() + std::chrono::seconds(15);

    return true;
}

bool RealtimeCollector::owns() {
    if (revoked_) {
        return false;
    }

    try {
        return heartbeat();
    } catch (const std::exception&) {
        // Shorter than the database's 90-second lease.
        return Clock::now() < safeUntil_;
    }
}

void RealtimeCollector::markGap() {
    gap_ = true;
    dirtyGap_ = true;
}

void RealtimeCollector::accept(const std::string& text) {
    const auto event = parseEvent(text);
    const auto type = requiredText(event, "type", 128);

    if (type == "error") {
        markGap();
        throw RealtimeError(
            502, "Realtime provider reported an error"
        );
    }

    if (!collectedTypes.count(type)) {
        if (type.rfind(
                "conversation.item.input_audio_transcription.", 0
            ) == 0) {
            markGap();
        }

        return;
    }

    auto filtered = project(event);
    
    if (type == "conversation.item.added" ||
        type == "conversation.item.created" ||
        type == "conversation.item.done") {
        Value diagnostic;
        diagnostic["sessionId"] = id_;
        diagnostic["type"] = type;
        diagnostic["eventId"] =
            requiredText(event, "event_id", 256);
        diagnostic["itemId"] =
            requiredText(event["item"], "id", 256);
        diagnostic["previousFieldPresent"] =
            event.has("previous_item_id");

        if (event.has("previous_item_id")) {
            diagnostic["previousItemId"] =
                Value(event["previous_item_id"]);
        }

        std::cerr << "[realtime ordering] "
                  << diagnostic.dump() << '\n';
    }
    
    const auto bytes = filtered.dump().size();

    if (bytes > 1024 * 1024) {
        throw RealtimeError(502, "Projected event too large");
    }

    if (pending_.size() >= 16 ||
        pendingBytes_ + bytes > 1024 * 1024) {
        flush();
    }

    pendingBytes_ += bytes;
    pending_.push_back(std::move(filtered));
    tick();
}

void RealtimeCollector::flush() {
    if (pending_.empty() && !dirtyGap_) {
        return;
    }

    Value body;
    body["p_session"] = id_;
    body["p_owner"] = owner_;
    body["p_gap"] = gap_;

    std::vector<Value> copy;

    for (const auto& event : pending_) {
        copy.emplace_back(event);
    }

    body["p_events"] = Value(std::move(copy));

    const auto result = rpc("vera_collect_events", body);

    if (result.t() != Type::True) {
        revoked_ = true;
        throw CollectorLeaseLost();
    }

    pending_.clear();
    pendingBytes_ = 0;
    dirtyGap_ = false;
    flushAt_ = Clock::now() + std::chrono::milliseconds(250);
}

void RealtimeCollector::tick() {
    if (Clock::now() >= renewAt_ && !heartbeat()) {
        throw CollectorLeaseLost();
    }

    if (Clock::now() >= flushAt_) {
        flush();
    }
}

void RealtimeCollector::finish(
    bool ended,
    const std::string& reason,
    bool gap
) {
    Value body;
    body["p_session"] = id_;
    body["p_owner"] = owner_;
    body["p_status"] = ended ? "ended" : "failed";
    body["p_reason"] = reason;
    body["p_gap"] = gap || gap_ || !pending_.empty();

    if (rpc("vera_finish_collection", body).t() != Type::True) {
        throw CollectorLeaseLost();
    }

    // Copy this call's lines into its conversation tree
    // (database/15_conversation_tree.sql). If this fails, the tree routes
    // retry it the next time anyone opens the tree, so just log it.
    try {
        Value build;
        build["p_session"] = id_;
        rpc("vera_build_conversation_nodes", build);
    } catch (const std::exception&) {
        std::cerr << "[realtime collector] tree copy deferred: "
                  << id_ << '\n';
    }
}

std::vector<std::string> RealtimeCollector::recoverable() {
    Value body(crow::json::load("{}"));
    const auto rows = rpc("vera_recoverable_collectors", body);

    if (rows.t() != Type::List || rows.size() > 5) {
        throw RealtimeError(503, "Invalid recovery response");
    }

    std::vector<std::string> ids;

    for (const auto& row : rows.lo()) {
        if (row.t() != Type::String) {
            throw RealtimeError(503, "Invalid recovery ID");
        }

        ids.emplace_back(row.s());
    }

    return ids;
}

void RealtimeCollector::requestStop(const std::string& sessionId) {
    Value body;
    body["p_session"] = sessionId;
    rpc("vera_request_realtime_stop", body);
}