#pragma once

#include <stdexcept>
#include <string>

#include "assignment_context.h"

struct PatientInstructions {
    std::string version;
    std::string text;
    crow::json::wvalue personaSnapshot;
    crow::json::wvalue scenarioSnapshot;
};

class PatientInstructionsError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

// context must come from resolveAssignmentContext(), not browser JSON
PatientInstructions buildPatientInstructions(const AssignmentContext& context);

// fields to add to the future realtime_sessions insert
crow::json::wvalue instructionSnapshotFields(const PatientInstructions& instructions);