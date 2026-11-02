#pragma once

#include <stdexcept>
#include <utility>

#include "assignment_access.h"
#include "assignment_store.h"
#include "persona_store.h"
#include "scenario_store.h"

struct AssignmentContext {
    Assignment assignment;
    Persona persona;
    Scenario scenario;
};

class AssignmentContextError : public std::runtime_error {
public:
    AssignmentContextError(int status, const char* message)
        : std::runtime_error(message), status_(status) {}

    int status() const { return status_; }

private:
    int status_;
};

// the caller must come from currentUser(), never from request JSON
inline AssignmentContext resolveAssignmentContext(
    const CurrentUser& user, int assignmentId,
    const AssignmentStore& assignments,
    const PersonaStore& personas,
    const ScenarioStore& scenarios
) {
    if (assignmentId <= 0) {
        throw AssignmentContextError(400, "Assignment ID must be positive");
    }

    auto assignment = assignments.get(assignmentId);
    if (!assignment) throw AssignmentContextError(404, "Assignment not found");

    // check ownership before loading any patient or scenario content
    if (!canAccessAssignment(user, *assignment)) {
        throw AssignmentContextError(403, "Not your assignment");
    }
    if (assignment->archived) {
        throw AssignmentContextError(409, "Assignment is archived");
    }
    if (assignment->personaId <= 0) {
        throw AssignmentContextError(409, "Assignment needs an approved persona");
    }

    auto scenario = scenarios.get(assignment->scenarioId);
    if (!scenario) {
        throw AssignmentContextError(409, "Assigned scenario is missing or archived");
    }

    auto persona = personas.getActive(assignment->personaId);
    if (!persona) {
        throw AssignmentContextError(409, "Assigned persona is missing or archived");
    }

    return {std::move(*assignment), std::move(*persona), std::move(*scenario)};
}