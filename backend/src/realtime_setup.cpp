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
#include "realtime_collector.h"
#include "supabase_client.h"

namespace {

std::string textField(const crow::json::rvalue& value, const char* key) {
    if (value.t() != crow::json::type::Object || !value.has(key) ||
        value[key].t() != crow::json::type::String) {
        throw RealtimeError(503, "Invalid session service response");
    }
    return std::string(value[key].s());
}

// Resume / rewind: append the branch's lines to the patient instructions.
// Keeps the newest lines if the whole history won't fit in the 32 KB limit.
void addConversationSoFar(PatientInstructions& instructions,
                          const crow::json::rvalue& lines) {
    if (lines.t() != crow::json::type::List || lines.size() == 0) return;

    const std::string header =
        "\n\n# Conversation so far\n"
        "This conversation already started: the student paused, or went back "
        "to an earlier point to try something different. Below is everything "
        "said so far on this path, oldest first. Treat it as what really "
        "happened. Stay consistent with it, do not greet the student again or "
        "repeat yourself, and continue naturally from the last line. If the "
        "last line is the student's, answer it.\n";
    const std::string omitted = "(Earlier lines left out.)\n";

    constexpr std::size_t kLimit = 32 * 1024 - 64;
    const std::size_t base = instructions.text.size() + header.size() + omitted.size();
    if (base >= kLimit) return;

    std::vector<std::string> kept;
    std::size_t used = 0;
    bool dropped = false;

    for (std::size_t i = lines.size(); i-- > 0;) {
        const auto& line = lines[i];
        std::string text = textField(line, "text");
        for (char& c : text) if (c == '\n' || c == '\r') c = ' ';
        const std::string who =
            textField(line, "sender") == "student" ? "Student" : "Patient";
        std::string entry = who + ": " + text + "\n";

        if (base + used + entry.size() > kLimit) {
            dropped = true;
            break;
        }
        used += entry.size();
        kept.push_back(std::move(entry));
    }

    std::string block = header;
    if (dropped) block += omitted;
    for (auto it = kept.rbegin(); it != kept.rend(); ++it) block += *it;

    instructions.text += block;
    instructions.scenarioSnapshot["instructions"] = instructions.text;
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
        std::string id, student, offer, answer, call, conversation;
        std::time_t deadline = 0;
        std::atomic<bool> stop{false}, shutdown{false}, done{false};
        std::unique_ptr<RealtimeChannel> channel;
        std::unique_ptr<RealtimeCollector> collector;
        std::thread worker;
    };

    AssignmentStore& assignments;
    PersonaStore& personas;
    ScenarioStore& scenarios;
    SupabaseClient db;

    std::string key = environment("OPENAI_API_KEY");
    std::string model = environment("OPENAI_REALTIME_MODEL");

    std::mutex mutex;
    std::atomic<bool> stopping{false};
    std::thread recovery;
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

	    void attach(const std::shared_ptr<Running>& live) {
        live->channel = std::make_unique<RealtimeChannel>(
            key, live->call
        );

        const std::string instructions = textField(
            live->collector->info(), "instructions"
        );

        crow::json::wvalue update;
        update["event_id"] = "setup_" + live->id;
        update["type"] = "session.update";
        update["session"]["type"] = "realtime";
        update["session"]["instructions"] = instructions;

        live->channel->send(update.dump());

        const auto readyBy =
            std::chrono::steady_clock::now() +
            std::chrono::seconds(10);

        while (std::chrono::steady_clock::now() < readyBy) {
            live->collector->tick();

            if (auto event = live->channel->next()) {
                const auto type = eventType(*event);

                // Preserve collection events received during attachment.
                live->collector->accept(*event);

                if (type == "session.updated") {
                    const auto parsed = crow::json::load(*event);

                    if (!parsed.has("session") ||
                        textField(parsed["session"], "instructions") !=
                            instructions) {
                        throw RealtimeError(
                            502, "Monitoring acknowledgement mismatch"
                        );
                    }

                    live->collector->flush();

                    std::cerr
                        << "[realtime monitor] session=" << live->id
                        << " update acknowledged\n";

                    return;
                }
            } else {
                std::this_thread::sleep_for(
                    std::chrono::milliseconds(20)
                );
            }
        }

        throw RealtimeError(
            502, "Monitoring update was not acknowledged"
        );
    }

    void watch(const std::shared_ptr<Running>& live) noexcept {
        std::string reason = "monitor_lost";
        bool ended = false;
        bool gap = false;

        try {
            while (true) {
                live->collector->tick();

                if (live->stop || live->collector->stopRequested()) {
                    reason = live->shutdown
                        ? "server_shutdown"
                        : "client_end";
                    ended = !live->shutdown;
                    break;
                }

                if (std::time(nullptr) >= live->deadline) {
                    reason = "deadline";
                    ended = true;
                    break;
                }

                if (auto event = live->channel->next()) {
                    live->collector->accept(*event);
                } else {
                    std::this_thread::sleep_for(
                        std::chrono::milliseconds(20)
                    );
                }
            }
        } catch (const CollectorLeaseLost&) {
            // A stale collector must not terminate another owner's call.
            live->channel.reset();
            live->done = true;
            return;
        } catch (const std::exception&) {
            gap = true;
            live->collector->markGap();

            std::cerr
                << "[realtime collector] collection interrupted: "
                << live->id << '\n';
        }

        try {
            try {
                live->collector->flush();
            } catch (const CollectorLeaseLost&) {
                throw;
            } catch (const std::exception&) {
                gap = true;
            }

            if (!live->collector->owns()) {
                throw CollectorLeaseLost();
            }

            if (!hangupRealtimeCall(key, live->call)) {
                std::cerr
                    << "[realtime collector] hangup unconfirmed: "
                    << live->id << '\n';
            } else {
                const auto drainBy =
                    std::chrono::steady_clock::now() +
                    std::chrono::seconds(2);

                while (std::chrono::steady_clock::now() < drainBy) {
                    std::optional<std::string> event;

                    try {
                        event = live->channel->next();
                    } catch (const std::exception&) {
                        break;
                    }

                    try {
                        if (event) {
                            live->collector->accept(*event);
                        } else {
                            std::this_thread::sleep_for(
                                std::chrono::milliseconds(20)
                            );
                        }
                    } catch (const CollectorLeaseLost&) {
                        throw;
                    } catch (const std::exception&) {
                        gap = true;
                        break;
                    }
                }

                try {
                    live->collector->flush();
                } catch (const CollectorLeaseLost&) {
                    throw;
                } catch (const std::exception&) {
                    gap = true;
                }

                live->collector->finish(ended, reason, gap);
            }
        } catch (const CollectorLeaseLost&) {
            std::cerr
                << "[realtime collector] ownership changed: "
                << live->id << '\n';
        } catch (const std::exception&) {
            std::cerr
                << "[realtime collector] recovery required: "
                << live->id << '\n';
        }

        live->channel.reset();
        live->done = true;
    }

    void recoverLoop() noexcept {
        while (!stopping) {
            try {
                if (!key.empty()) {
                    const auto ids = RealtimeCollector::recoverable();

                    std::lock_guard<std::mutex> lock(mutex);

                    if (stopping) {
                        break;
                    }

                    reap();

                    for (const auto& id : ids) {
                        if (running.size() >= 5) {
                            break;
                        }

                        bool present = false;

                        for (const auto& entry : running) {
                            if (entry.second->id == id) {
                                present = true;
                            }
                        }

                        if (present) {
                            continue;
                        }

                        std::shared_ptr<Running> live;

                        try {
                            auto collector =
                                std::make_unique<RealtimeCollector>(id);

                            const auto& saved = collector->info();

                            live = std::make_shared<Running>();
                            live->id = id;
                            live->call = textField(saved, "callId");
                            live->student = textField(saved, "studentId");
                            live->assignmentId = static_cast<int>(
                                saved["assignmentId"].i()
                            );
                            live->deadline = static_cast<std::time_t>(
                                saved["deadlineEpoch"].d()
                            );

                            const std::string cacheKey =
                                live->student + ":" +
                                textField(saved, "requestKey");

                            live->collector = std::move(collector);
                            live->collector->markGap();

                            if (std::time(nullptr) >= live->deadline ||
                                live->collector->stopRequested()) {
                                if (live->collector->owns() &&
                                    hangupRealtimeCall(key, live->call)) {
                                    live->collector->finish(
                                        true,
                                        live->collector->stopRequested()
                                            ? "client_end"
                                            : "deadline",
                                        true
                                    );
                                }

                                continue;
                            }

                            attach(live);

                            if (textField(saved, "status") == "starting") {
                                change(live->id, live->call, "activate");
                            }

                            running.emplace(cacheKey, live);

                            try {
                                live->worker = std::thread(
                                    [this, live] { watch(live); }
                                );
                            } catch (...) {
                                running.erase(cacheKey);
                                throw;
                            }

                            std::cerr
                                << "[realtime collector] recovered with gap: "
                                << id << '\n';
                        } catch (const CollectorLeaseLost&) {
                            // Another process owns this call.
                        } catch (const std::exception&) {
                            if (live && live->collector &&
                                live->collector->owns()) {
                                try {
                                    if (hangupRealtimeCall(key, live->call)) {
                                        live->collector->finish(
                                            false, "monitor_lost", true
                                        );
                                    }
                                } catch (const std::exception&) {
                                }
                            }

                            std::cerr
                                << "[realtime collector] recovery deferred: "
                                << id << '\n';
                        }
                    }
                }
            } catch (const std::exception&) {
                std::cerr
                    << "[realtime collector] recovery scan unavailable\n";
            }

            for (int i = 0; i < 50 && !stopping; ++i) {
                std::this_thread::sleep_for(
                    std::chrono::milliseconds(100)
                );
            }
        }
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
) : impl_(std::make_unique<Impl>(a, p, s)) {
	impl_->recovery = std::thread([state = impl_.get()] { state->recoverLoop(); }
	);
}

RealtimeSetup::~RealtimeSetup() {
    shutdown();
}

std::pair<int, crow::json::wvalue> RealtimeSetup::start(
    const CurrentUser& user, int assignmentId,
    const std::string& requestKey, const std::string& offer,
    const std::string& conversationId, const std::string& fromNodeId
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
        
        if (live->answer.empty()) {
            throw RealtimeError(
                409,
                "Recovered call has no cached SDP; end it before starting again",
                live->id
            );
        }

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
        body["conversationId"] = live->conversation;
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
    auto instructions = buildPatientInstructions(context);

    // Resume / rewind: give the patient this branch's lines so far
    // (database/17_conversation_resume.sql).
    if (!conversationId.empty()) {
        crow::json::wvalue args;
        args["p_conversation"] = conversationId;
        if (fromNodeId.empty()) args["p_from_node"] = nullptr;
        else args["p_from_node"] = fromNodeId;
        args["p_student"] = user.id;
        args["p_assignment"] = assignmentId;

        const auto history = state.request(
            "POST", "rpc/vera_conversation_history", args.dump()
        );
        const auto code = textField(history, "code");

        if (code == "saving") {
            throw RealtimeError(
                409, "Still saving your last call. Try again in a moment."
            );
        }
        if (code != "ok") {
            throw RealtimeError(404, "Conversation or line not found");
        }

        addConversationSoFar(instructions, history["lines"]);
    }

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
    bool collectorAttempted = false;

    try {
        // Link this call to a conversation tree (database/15_conversation_tree.sql).
        // No conversationId = a new practice attempt; otherwise this call
        // continues that attempt from its bookmark or from fromNodeId.
        crow::json::wvalue attach;
        attach["p_session"] = live->id;
        if (!conversationId.empty()) {
            attach["p_conversation"] = conversationId;
            if (!fromNodeId.empty()) attach["p_from_node"] = fromNodeId;
        }
        const auto link = state.request(
            "POST", "rpc/vera_attach_conversation", attach.dump()
        );
        live->conversation = textField(link, "conversationId");

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

        collectorAttempted = true;
        live->collector =
            std::make_unique<RealtimeCollector>(live->id);

        state.attach(live);
        state.change(live->id, live->call, "activate");

        auto body = publicSession(state.row(user, live->id));
        body["sdp"] = live->answer;
        body["conversationId"] = live->conversation;

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
        
        const bool mayHangup =
            !collectorAttempted ||
            (live->collector && live->collector->owns());

        const bool safeToRelease =
            mayHangup &&
            (call.id.empty()
                ? (!call.attempted || call.rejected)
                : hangupRealtimeCall(state.key, call.id));

        if (safeToRelease) {
            try {
                if (live->collector) {
                    live->collector->finish(
                        false, "setup_failed", true
                    );
                } else {
                    state.change(
                        live->id, call.id, "failed", "setup_failed"
                    );
                }
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
    const CurrentUser& user,
    const std::string& id
) {
    auto& state = *impl_;

    {
        std::lock_guard<std::mutex> lock(state.mutex);

        auto saved = state.row(user, id);
        const auto status = textField(saved, "status");

        if (status == "ended" || status == "failed") {
            return publicSession(saved);
        }

        if (saved["call_id"].t() == crow::json::type::Null) {
            throw RealtimeError(
                409, "Setup outcome is unresolved"
            );
        }

        RealtimeCollector::requestStop(id);

        for (const auto& entry : state.running) {
            const auto& live = entry.second;

            if (live->id != id) {
                continue;
            }

            live->stop = true;

            if (live->worker.joinable()) {
                live->worker.join();
            }

            saved = state.row(user, id);
            const auto finalStatus = textField(saved, "status");

            if (finalStatus == "ended" || finalStatus == "failed") {
                return publicSession(saved);
            }

            throw RealtimeError(
                503, "Termination pending; retry ending this session"
            );
        }
    }

    // Another process or the recovery worker owns the collector.
    const auto until =
        std::chrono::steady_clock::now() +
        std::chrono::seconds(25);

    while (std::chrono::steady_clock::now() < until) {
        auto saved = state.row(user, id);
        const auto status = textField(saved, "status");

        if (status == "ended" || status == "failed") {
            return publicSession(saved);
        }

        std::this_thread::sleep_for(
            std::chrono::milliseconds(500)
        );
    }

    throw RealtimeError(
        503, "Termination requested; retry after collector recovery"
    );
}

void RealtimeSetup::shutdown() {
    auto& state = *impl_;

    {
        std::lock_guard<std::mutex> lock(state.mutex);

        if (state.stopping.exchange(true)) {
            return;
        }

        for (const auto& entry : state.running) {
            entry.second->shutdown = true;
            entry.second->stop = true;
        }
    }

    if (state.recovery.joinable()) {
        state.recovery.join();
    }

    std::lock_guard<std::mutex> lock(state.mutex);

    for (const auto& entry : state.running) {
        if (entry.second->worker.joinable()) {
            entry.second->worker.join();
        }
    }

    state.running.clear();
}