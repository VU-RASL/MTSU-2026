// =============================================================================
// learning_topic.cpp — converting a LearningTopic to and from JSON
// =============================================================================
//
// With only three editable fields, these are written out by hand instead of
// using a field table like persona.cpp does.
// =============================================================================

#include "learning_topic.h"

#include <limits>

crow::json::wvalue toJson(const LearningTopic& topic) {
    crow::json::wvalue out;
    out["id"] = topic.id;
    out["createdAt"] = topic.createdAt;
    out["title"] = topic.title;
    out["content"] = topic.content;
    out["position"] = topic.position;
    return out;
}

bool applyJson(const crow::json::rvalue& body, LearningTopic& topic, std::string& error) {
    if (body.t() != crow::json::type::Object) {
        error = "Request body must be a JSON object";
        return false;
    }

    // title: optional in the request (for partial updates), but must be text
    if (body.has("title")) {
        if (body["title"].t() != crow::json::type::String) {
            error = "'title' must be a string";
            return false;
        }
        topic.title = std::string(body["title"].s());
    }

    // content: optional, must be text
    if (body.has("content")) {
        if (body["content"].t() != crow::json::type::String) {
            error = "'content' must be a string";
            return false;
        }
        topic.content = std::string(body["content"].s());
    }

    // position: optional, must be a whole number that fits in an int
    if (body.has("position")) {
        const auto& value = body["position"];
        const bool isWholeNumber =
            value.t() == crow::json::type::Number &&
            (value.nt() == crow::json::num_type::Signed_integer ||
             value.nt() == crow::json::num_type::Unsigned_integer);
        if (!isWholeNumber) {
            error = "'position' must be a whole number";
            return false;
        }
        const long long n = value.i();
        if (n < std::numeric_limits<int>::min() || n > std::numeric_limits<int>::max()) {
            error = "'position' is out of range";
            return false;
        }
        topic.position = static_cast<int>(n);
    }

    // Every topic needs a title, whether it's new or being edited
    if (topic.title.empty()) {
        error = "'title' is required";
        return false;
    }
    return true;
}
