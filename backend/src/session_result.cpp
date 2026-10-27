// =============================================================================
// session_result.cpp — SessionResult <-> JSON, plus validation
// =============================================================================

#include "session_result.h"

crow::json::wvalue toJson(const SessionResult& r) {
    crow::json::wvalue out;
    out["id"] = r.id;
    out["createdAt"] = r.createdAt;
    out["assignmentId"] = r.assignmentId;
    out["studentId"] = r.studentId;

    // transcript and autoScore are stored as JSON text; turn them back into JSON
    auto transcript = crow::json::load(r.transcriptJson);
    if (transcript) {
        out["transcript"] = crow::json::wvalue(transcript);
    } else {
        out["transcript"] = std::vector<crow::json::wvalue>{};
    }

    out["autoScore"] = nullptr;
    if (!r.autoScoreJson.empty()) {
        auto autoScore = crow::json::load(r.autoScoreJson);
        if (autoScore) out["autoScore"] = crow::json::wvalue(autoScore);
    }

    if (r.educatorScore) {
        out["educatorScore"] = *r.educatorScore;
    } else {
        out["educatorScore"] = nullptr;
    }
    out["educatorFeedback"] = r.educatorFeedback;

    if (r.reviewedBy.empty()) {
        out["reviewedBy"] = nullptr;
    } else {
        out["reviewedBy"] = r.reviewedBy;
    }
    if (r.reviewedAt.empty()) {
        out["reviewedAt"] = nullptr;
    } else {
        out["reviewedAt"] = r.reviewedAt;
    }
    return out;
}

bool applySubmitJson(const crow::json::rvalue& body, SessionResult& r, std::string& error) {
    if (body.t() != crow::json::type::Object) {
        error = "Request body must be a JSON object";
        return false;
    }

    // transcript: required list of turns
    if (!body.has("transcript") || body["transcript"].t() != crow::json::type::List) {
        error = "'transcript' must be a list of turns";
        return false;
    }
    for (const auto& turn : body["transcript"].lo()) {
        if (turn.t() != crow::json::type::Object) {
            error = "Every transcript turn must be an object";
            return false;
        }
        if (!turn.has("role") || turn["role"].t() != crow::json::type::String ||
            (turn["role"].s() != "student" && turn["role"].s() != "patient")) {
            error = "Every transcript turn needs a 'role' of \"student\" or \"patient\"";
            return false;
        }
        if (!turn.has("text") || turn["text"].t() != crow::json::type::String) {
            error = "Every transcript turn needs 'text'";
            return false;
        }
    }
    r.transcriptJson = crow::json::wvalue(body["transcript"]).dump();

    // autoScore: optional object, or null
    if (body.has("autoScore") && body["autoScore"].t() != crow::json::type::Null) {
        if (body["autoScore"].t() != crow::json::type::Object) {
            error = "'autoScore' must be an object or null";
            return false;
        }
        r.autoScoreJson = crow::json::wvalue(body["autoScore"]).dump();
    }
    return true;
}

bool applyReviewJson(const crow::json::rvalue& body, SessionResult& r, std::string& error) {
    if (body.t() != crow::json::type::Object) {
        error = "Request body must be a JSON object";
        return false;
    }
    if (!body.has("educatorScore") && !body.has("educatorFeedback")) {
        error = "Send 'educatorScore', 'educatorFeedback', or both";
        return false;
    }

    // educatorScore: number 0-100, or null to clear it
    if (body.has("educatorScore")) {
        const auto& score = body["educatorScore"];
        if (score.t() == crow::json::type::Null) {
            r.educatorScore.reset();
        } else if (score.t() == crow::json::type::Number && score.d() >= 0 && score.d() <= 100) {
            r.educatorScore = score.d();
        } else {
            error = "'educatorScore' must be a number from 0 to 100, or null";
            return false;
        }
    }

    // educatorFeedback: text
    if (body.has("educatorFeedback")) {
        if (body["educatorFeedback"].t() != crow::json::type::String) {
            error = "'educatorFeedback' must be text";
            return false;
        }
        r.educatorFeedback = std::string(body["educatorFeedback"].s());
    }
    return true;
}
