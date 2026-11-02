#include "realtime_setup.h"

#include <atomic>
#include <chrono>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include <map>
#include <mutex>
#include <thread>
#include <vector>

#include "assignment_context.h"
#include "patient_instructions.h"
#include "realtime_transport.h"
#include "supabase_client.h"

namespace {

std::string textField(const crow::json::rvalue& value, const char* key) {
    if (value.t() != crow::json::type::Object || !value.has(key) ||
        value[key].t() != crow::json::type::String) {
        throw RealtimeError(503, "Invalid session service response");
    }
    return std::string(value[key].s());
}

std::string environment(const char* name) {
    const char* value = std::getenv(name);
    return value ? value : "";
}

// reject deeply nested events before asking Crow to parse them
std::string eventType(const std::string& message) {
    int depth = 0;
    bool quoted = false;
    bool escaped = false;

    for (char c : message) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (c == '\\') escaped = true;
            else if (c == '"') quoted = false;
        } else if (c == '"') {
            quoted = true;
        } else if (c == '{' || c == '[') {
            if (++depth > 32) {
                throw RealtimeError(502, "Realtime event is too deeply nested");
            }
        } else if (c == '}' || c == ']') {
            if (--depth < 0) {
                throw RealtimeError(502, "Invalid Realtime event");
            }
        }
    }

    auto value = crow::json::load(message);
    if (!value) throw RealtimeError(502, "Invalid Realtime event");
    return textField(value, "type");
}

crow::json::wvalue publicSession(const crow::json::rvalue& row) {
    crow::json::wvalue body;
    body["sessionId"] = textField(row, "id");
    body["status"] = textField(row, "status");
    body["deadlineAt"] = textField(row, "deadline_at");
    return body;
}

}

struct RealtimeSetup::Impl {
    struct Running {
        int assignmentId = 0;
        std::string id, student, offer, answer, call;
        std::time_t deadline = 0;
        std::atomic<bool> stop{false}, shutdown{false}, done{false};
        std::unique_ptr<RealtimeChannel> channel;
        std::thread worker;
    };

    AssignmentStore& assignments;
    PersonaStore& personas;
    ScenarioStore& scenarios;
    SupabaseClient db;

    std::string key = environment("OPENAI_API_KEY");
    std::string model = environment("OPENAI_REALTIME_MODEL");

    std::mutex mutex;
    bool stopping = false;
    std::map<std::string, std::shared_ptr<Running>> running;

    Impl(AssignmentStore& a, PersonaStore& p, ScenarioStore& s)
        : assignments(a), personas(p), scenarios(s) {}

    crow::json::rvalue request(const std::string& method,
                              const std::string& path,
                              const std::string& body = "") {
        try {
            auto value = crow::json::load(db.request(method, path, body));
            if (!value) {
                throw RealtimeError(503, "Invalid database response");
            }
            return value;
        } catch (...) {
            throw RealtimeError(503, "Session database unavailable");
        }
    }

    crow::json::rvalue row(const CurrentUser& user, const std::string& id) {
        auto rows = request(
            "GET",
            "realtime_sessions?id=eq." + id +
            "&select=id,assignment_id,student_id,call_id,status,deadline_at"
        );

        if (rows.t() != crow::json::type::List) {
            throw RealtimeError(503, "Invalid session database response");
        }
        if (rows.size() == 0) {
            throw RealtimeError(404, "Session not found");
        }

        const int assignmentId =
            static_cast<int>(rows[0]["assignment_id"].i());

        const auto assignment = assignments.get(assignmentId);

        if (!assignment ||
            assignment->studentId != textField(rows[0], "student_id")) {
            throw RealtimeError(404, "Session not found");
        }
        if (!canAccessAssignment(user, *assignment)) {
            throw RealtimeError(403, "Not your session");
        }

        // return a separately owned JSON document
        return crow::json::load(crow::json::wvalue(rows[0]).dump());
    }

    void change(const std::string& id, const std::string& call,
                const std::string& action, const std::string& reason = "") {
        crow::json::wvalue body;
        body["p_id"] = id;

        if (call.empty()) body["p_call"] = nullptr;
        else body["p_call"] = call;

        body["p_action"] = action;

        if (reason.empty()) body["p_reason"] = nullptr;
        else body["p_reason"] = reason;

        const auto result = request(
            "POST", "rpc/vera_change_realtime_setup", body.dump()
        );

        if (result.t() != crow::json::type::True) {
            throw RealtimeError(409, "Session state changed during setup");
        }
    }

    void watch(const std::shared_ptr<Running>& live) noexcept {
        std::string reason = "monitor_lost";
        bool ended = false;

        try {
            while (true) {
                if (live->stop) {
                    reason = live->shutdown ? "server_shutdown" : "client_end";
                    ended = !live->shutdown;
                    break;
                }

                if (std::time(nullptr) >= live->deadline) {
                    reason = "deadline";
                    ended = true;
                    break;
                }

                if (auto event = live->channel->next()) {
                    if (eventType(*event) == "error") break;

                    // BE-06 will persist transcript and usage events here.
                } else {
                    std::this_thread::sleep_for(
                        std::chrono::milliseconds(20)
                    );
                }
            }
        } catch (...) {}

        // release the reservation only after hangup is confirmed
        if (hangupRealtimeCall(key, live->call)) {
            try {
                change(
                    live->id, live->call,
                    ended ? "ended" : "failed", reason
                );
            } catch (...) {
                std::cerr << "Realtime state repair required: "
                          << live->id << '\n';
            }
        } else {
            std::cerr << "Realtime hangup confirmation required: "
                      << live->id << '\n';
        }

        live->channel.reset();
        live->done = true;
    }

    void reap() {
        for (auto it = running.begin(); it != running.end();) {
            if (!it->second->done) {
                ++it;
                continue;
            }
            if (it->second->worker.joinable()) {
                it->second->worker.join();
            }
            it = running.erase(it);
        }
    }
};

RealtimeSetup::RealtimeSetup(
    AssignmentStore& a, PersonaStore& p, ScenarioStore& s
) : impl_(std::make_unique<Impl>(a, p, s)) {}

RealtimeSetup::~RealtimeSetup() {
    shutdown();
}

std::pair<int, crow::json::wvalue> RealtimeSetup::start(
    const CurrentUser& user, int assignmentId,
    const std::string& requestKey, const std::string& offer
) {
    auto& state = *impl_;
    std::lock_guard<std::mutex> lock(state.mutex);

    if (state.stopping) {
        throw RealtimeError(503, "Server is stopping");
    }
    if (user.role != Role::Student) {
        throw RealtimeError(403, "Students only");
    }

    // verify the assignment again even when replaying an HTTP response
    const auto assignment = state.assignments.get(assignmentId);

    if (!assignment) {
        throw RealtimeError(404, "Assignment not found");
    }
    if (assignment->studentId != user.id) {
        throw RealtimeError(403, "Not your assignment");
    }
    if (assignment->archived) {
        throw RealtimeError(409, "Assignment is archived");
    }

    state.reap();

    const std::string cacheKey = user.id + ":" + requestKey;
    auto found = state.running.find(cacheKey);

    if (found != state.running.end()) {
        const auto& live = found->second;

        if (live->assignmentId != assignmentId || live->offer != offer) {
            throw RealtimeError(
                409, "Request key was reused with different input"
            );
        }

        const auto row = state.row(user, live->id);

        if (textField(row, "status") != "active" ||
            std::time(nullptr) >= live->deadline) {
            throw RealtimeError(409, "Session is no longer active");
        }

        auto body = publicSession(row);
        body["sdp"] = live->answer;
        return {200, std::move(body)};
    }

    if (state.key.empty() || state.model.empty()) {
        throw RealtimeError(
            503, "Configure OPENAI_API_KEY and OPENAI_REALTIME_MODEL"
        );
    }

    bool wss = false;
    const auto* version = curl_version_info(CURLVERSION_NOW);

    if (version && version->protocols) {
        for (const char* const* p = version->protocols; *p; ++p) {
            if (std::string(*p) == "wss") wss = true;
        }
    }

    if (!wss) {
        throw RealtimeError(503, "Backend libcurl needs WSS support");
    }
    if (state.running.size() >= 5) {
        throw RealtimeError(429, "This server is at session capacity");
    }

    const auto context = resolveAssignmentContext(
        user, assignmentId,
        state.assignments, state.personas, state.scenarios
    );
    const auto instructions = buildPatientInstructions(context);

    crow::json::wvalue reserve;
    reserve["p_student"] = user.id;
    reserve["p_assignment"] = assignmentId;
    reserve["p_request"] = requestKey;
    reserve["p_model"] = state.model;
    reserve["p_voice"] = "marin";
    reserve["p_version"] = instructions.version;
    reserve["p_persona"] = crow::json::wvalue(instructions.personaSnapshot);
    reserve["p_scenario"] = crow::json::wvalue(instructions.scenarioSnapshot);

    const auto reservation = state.request(
        "POST", "rpc/vera_reserve_realtime", reserve.dump()
    );

    const int code = static_cast<int>(reservation["code"].i());

    if (code != 201 && code != 200) {
        throw RealtimeError(code, textField(reservation, "error"));
    }

    if (reservation["created"].t() != crow::json::type::True) {
        throw RealtimeError(
            409,
            "Request already reserved; recover or end that session before a new attempt",
            textField(reservation["session"], "id")
        );
    }

    auto live = std::make_shared<Impl::Running>();
    live->id = textField(reservation["session"], "id");
    live->student = user.id;
    live->assignmentId = assignmentId;
    live->offer = offer;
    live->deadline =
        static_cast<std::time_t>(reservation["deadline_epoch"].d());

    RealtimeCall call;

    try {
        crow::json::wvalue config;
        config["type"] = "realtime";
        config["model"] = state.model;
        config["instructions"] = instructions.text;
        config["output_modalities"][0] = "audio";
        config["max_output_tokens"] = 1024;

        config["audio"]["output"]["voice"] = "marin";
        config["audio"]["input"]["transcription"]["model"] = "gpt-transcribe";
        config["audio"]["input"]["turn_detection"]["type"] = "server_vad";
        config["audio"]["input"]["turn_detection"]["create_response"] = true;
        config["audio"]["input"]["turn_detection"]["interrupt_response"] = true;

        createRealtimeCall(state.key, offer, config.dump(), call);

        if (!call.ok) {
            throw RealtimeError(502, "OpenAI call setup failed");
        }

        live->call = call.id;
        live->answer = call.answer;

        state.change(live->id, live->call, "bind");

        live->channel = std::make_unique<RealtimeChannel>(
            state.key, live->call
        );

                // Confirm the attached sideband can process an update.
        // Resend the same approved instructions used for creation.
        crow::json::wvalue update;
        update["event_id"] = "setup_" + live->id;
        update["type"] = "session.update";
        update["session"]["type"] = "realtime";
        update["session"]["instructions"] = instructions.text;
        live->channel->send(update.dump());

        const auto readyBy =
            std::chrono::steady_clock::now() + std::chrono::seconds(10);

        bool ready = false;
        size_t eventsSeen = 0;

        while (std::chrono::steady_clock::now() < readyBy) {
            if (auto event = live->channel->next()) {
                ++eventsSeen;
                const auto type = eventType(*event);

                if (type == "error") {
                    const auto parsed = crow::json::load(*event);
                    crow::json::wvalue details;
                    details["sessionId"] = live->id;

                    if (parsed.has("error") &&
                        parsed["error"].t() == crow::json::type::Object) {
                        const auto& error = parsed["error"];

                        for (const char* field : {"type", "code", "param"}) {
                            if (error.has(field) &&
                                error[field].t() == crow::json::type::String) {
                                details[field] =
                                    std::string(error[field].s()).substr(0, 200);
                            }
                        }
                    }

                    std::cerr << "[realtime monitor] "
                              << details.dump() << '\n';

                    throw RealtimeError(
                        502, "OpenAI rejected the monitoring update"
                    );
                }

                if (type == "session.updated") {
                    const auto parsed = crow::json::load(*event);

                    if (!parsed.has("session") ||
                        textField(parsed["session"], "instructions") !=
                            instructions.text) {
                        throw RealtimeError(
                            502, "Monitoring instruction acknowledgement mismatch"
                        );
                    }

                    ready = true;
                    break;
                }
            } else {
                std::this_thread::sleep_for(
                    std::chrono::milliseconds(20)
                );
            }
        }

        if (!ready) {
            std::cerr << "[realtime monitor] session=" << live->id
                      << " acknowledgement timed out; events_received="
                      << eventsSeen << '\n';

            throw RealtimeError(
                502, "Realtime monitoring update was not acknowledged"
            );
        }

        std::cerr << "[realtime monitor] session=" << live->id
                  << " update acknowledged\n";

        state.change(live->id, live->call, "activate");

        auto body = publicSession(state.row(user, live->id));
        body["sdp"] = live->answer;

        state.running.emplace(cacheKey, live);

        try {
            live->worker = std::thread(
                [&state, live] { state.watch(live); }
            );
        } catch (...) {
            state.running.erase(cacheKey);
            throw;
        }

        return {201, std::move(body)};
    } catch (...) {
    
    	try {
    		throw;
		} catch (const std::exception& error) {
    		std::cerr
        		<< "[realtime setup] session=" << live->id
        		<< " reason=" << error.what()
        		<< '\n';
		} catch (...) {
    		std::cerr
        		<< "[realtime setup] session=" << live->id
        		<< " reason=unknown exception"
        		<< '\n';
		}
        
        const bool safeToRelease = call.id.empty()
            ? (!call.attempted || call.rejected)
            : hangupRealtimeCall(state.key, call.id);

        if (safeToRelease) {
            try {
                state.change(
                    live->id, call.id, "failed", "setup_failed"
                );
            } catch (...) {
                std::cerr << "Realtime state repair required: "
                          << live->id << '\n';
            }
        } else {
            std::cerr
                << "Realtime setup outcome unknown; reservation retained: "
                << live->id << '\n';
        }

        throw RealtimeError(
            502,
            "Session setup failed; inspect session status before retrying",
            live->id
        );
    }
}

crow::json::wvalue RealtimeSetup::get(
    const CurrentUser& user, const std::string& id
) {
    return publicSession(impl_->row(user, id));
}

crow::json::wvalue RealtimeSetup::end(
    const CurrentUser& user, const std::string& id
) {
    auto& state = *impl_;
    std::lock_guard<std::mutex> lock(state.mutex);

    auto row = state.row(user, id);
    const auto status = textField(row, "status");

    if (status == "ended" || status == "failed") {
        return publicSession(row);
    }

    for (const auto& [key, live] : state.running) {
        if (live->id != id) continue;

        live->stop = true;
        if (live->worker.joinable()) live->worker.join();

        auto saved = state.row(user, id);
        const auto savedStatus = textField(saved, "status");

        if (savedStatus != "ended" && savedStatus != "failed") {
            throw RealtimeError(
                503, "Termination is not confirmed; retry ending this session"
            );
        }
        return publicSession(saved);
    }

    if (row["call_id"].t() == crow::json::type::Null) {
        throw RealtimeError(
            409,
            "Setup outcome is unresolved; do not release this reservation yet"
        );
    }

    const auto call = textField(row, "call_id");

    if (!hangupRealtimeCall(state.key, call)) {
        throw RealtimeError(
            503, "Termination is not confirmed; retry ending this session"
        );
    }

    state.change(id, call, "ended", "client_end");
    return publicSession(state.row(user, id));
}

void RealtimeSetup::shutdown() {
    auto& state = *impl_;
    std::lock_guard<std::mutex> lock(state.mutex);

    if (state.stopping) return;
    state.stopping = true;

    for (const auto& [key, live] : state.running) {
        live->shutdown = true;
        live->stop = true;
    }

    for (const auto& [key, live] : state.running) {
        if (live->worker.joinable()) live->worker.join();
    }

    state.running.clear();
}