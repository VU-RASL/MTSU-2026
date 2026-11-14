#pragma once

#include <memory>
#include <string>
#include <utility>

#include "auth.h"
#include "educator_routes.h"

class AssignmentStore;
class PersonaStore;
class ScenarioStore;

class RealtimeSetup {
public:
    RealtimeSetup(AssignmentStore& assignments, PersonaStore& personas,
                  ScenarioStore& scenarios);
    ~RealtimeSetup();

    // conversationId empty -> a new practice attempt.
    // conversationId set  -> continue that attempt (resume), from fromNodeId
    //                        when given (rewind), else from its bookmark.
    std::pair<int, crow::json::wvalue> start(
        const CurrentUser& user, int assignmentId,
        const std::string& requestKey, const std::string& offer,
        const std::string& conversationId = "",
        const std::string& fromNodeId = "");

    crow::json::wvalue get(const CurrentUser& user, const std::string& id);
    crow::json::wvalue end(const CurrentUser& user, const std::string& id);
    void shutdown();

private:
    struct Impl;
    std::unique_ptr<Impl> impl_;
};

void registerRealtimeRoutes(EducatorApp& app, RealtimeSetup& setup);