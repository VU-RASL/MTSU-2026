// =============================================================================
// learning_topic_store.h — reading and writing learning topics in Supabase
// =============================================================================
//
// Same five methods as PersonaStore, so the routes in main.cpp look the same.
// Each method turns into one request to the `learning_topics` table.
// =============================================================================

#pragma once

#include <optional>
#include <vector>

#include "learning_topic.h"
#include "supabase_client.h"

class LearningTopicStore {
public:
    // All topics, in page order (position, then id).
    std::vector<LearningTopic> list() const;

    // One topic, or std::nullopt if no topic has that id.
    std::optional<LearningTopic> get(int id) const;

    // Saves a new topic. Supabase assigns id and createdAt.
    // Returns the saved topic.
    LearningTopic create(const LearningTopic& topic);

    // Saves changes to an existing topic. Returns false if the id doesn't exist.
    bool update(const LearningTopic& topic);

    // Deletes a topic. Returns false if the id doesn't exist.
    bool remove(int id);

private:
    SupabaseClient db_;  // reads the Supabase keys when the store is created
};
