// =============================================================================
// learning_topic.h — what a LearningTopic IS
// =============================================================================
//
// A learning topic is one expandable section on the Learning page, e.g.
// "What is Autism?" with a paragraph of content underneath.
//
// Topics are stored in the Supabase table `learning_topics`, one row per topic:
//
//   column       C++ field     notes
//   id           id            set by Supabase
//   created_at   createdAt     set by Supabase ("YYYY-MM-DD" here)
//   title        title         required
//   content      content       the text shown when the topic is opened
//   position     position      sort order on the page (1 = top)
//
// JSON sent to / received from React uses the same names in camelCase:
//   { "id": 1, "createdAt": "2026-10-20", "title": "...",
//     "content": "...", "position": 1 }
// =============================================================================

#pragma once

#include <string>
#include "crow.h"

struct LearningTopic {
    int id = 0;              // 0 means "not saved yet"
    std::string createdAt;   // set by the database
    std::string title;
    std::string content;
    int position = 0;        // lower numbers appear first
};

// LearningTopic -> JSON (what we send to React).
crow::json::wvalue toJson(const LearningTopic& topic);

// JSON -> LearningTopic (what React sends us).
// Only fields present in the JSON are changed, so this works for both
// creating (start from an empty topic) and partial updates (start from the
// existing one). Returns false and fills `error` if something is invalid.
bool applyJson(const crow::json::rvalue& body, LearningTopic& topic, std::string& error);
