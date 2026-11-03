#pragma once

#include <string>
#include <vector>
#include "crow.h"

/* 
This struct stores the information associated with a clinical simulation scenario.

A scenario describes the clinical situation and educational goals of a simulation.
Later, a scenario and a persona can be combined to create a complete simulation.

Strings: fields that hold one value (title, summary, setting, difficulty...).
Lists:   fields that naturally hold several values (learning objectives, required tasks...).
*/

struct Scenario {
    int id = 0;
    std::string createdAt;

    // Top of page
    std::string title;
    std::string summary;
    std::string setting;
    std::string difficulty;        // expected difficulty, e.g. "beginner", "intermediate", or "advanced".

    // Educational Information
    std::vector<std::string> learningObjectives;
    std::string instructions;      // additional instructions for setting up or conducting the simulation.
    std::string patientSituation;  // describes the clinical circumstances the student encounters, separate from patient's identity & personality.
    std::vector<std::string> requiredTasks;

    // Estimated time to complete the simulation, in minutes
    int estimatedTime = 0; 
};

// C++ Scenario object -> JSON (what we send to React).
crow::json::wvalue toJson(const Scenario& scenario);

// JSON -> C++ Scenario object (what React sends to the backend).
// Only overwrites fields present in the JSON, allowing the same function
// to be used for creating a new Scenario and updating an existing one.
// Returns false and fills "error" if a field has the wrong type.
bool applyJson(const crow::json::rvalue& body, Scenario& scenario, std::string& error);