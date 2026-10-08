#pragma once

#include <string>
#include <vector>
#include "crow.h"

// This struct mirrors the fields on persona page. 

// In C++ every field sits directly on the struct (easy to work with).
// In JSON the fields are grouped by the page's sections, e.g.
//   { "identity": { "name": "...", "age": "39" },
//     "health":   { "diagnosis": { "actual": "..." } } }
// The table at the top of persona.cpp maps each field to its JSON location.
//
// Strings: fields that hold one value (name, affect, chief complaint...).
// Lists:   fields that naturally hold several (goals, possible diagnoses...).
struct Persona {
    int id = 0;
    std::string createdAt; // set by the server , e.g. "2026-10-02"

    // Top of Page
    std::string title;
    std::string summary;
    std::string color;

    // Metadata
    std::vector<std::string> contentWarnings;

    // Identity
    std::string name;
    std::string age;         // string so "5 months" or "late 30s" also work
    std::string ethnicity;
    std::string sex;
    std::string gender;
    std::string sexualOrientation;

    // Presentation And Resulting Behavior
    std::string affect;
    std::string speech;
    std::string misc;

    // Health Components 
    std::string chiefComplaint;
    std::vector<std::string> differentialDiagnosis;   // Diagnosis > Differential
    std::string actualDiagnosis;                      // Diagnosis > Actual
    std::vector<std::string> medicationsAndAllergies; // History Of Present Illness
    std::vector<std::string> pastMedicalHistory;
    std::vector<std::string> familyMedicalHistory;
    std::string psychiatricProfile;

    // remaining fields (outside the collapsible sections)
    std::vector<std::string> goals;
    std::vector<std::string> challenges;
    std::vector<std::string> thoughtsAndFeelings;
    std::vector<std::string> tasksAndActivities;
    std::vector<std::string> influencesAndSupports;
    std::vector<std::string> socialHistory;
    std::vector<std::string> culturalComponents;
    std::vector<std::string> emotionalWellbeing;
    std::vector<std::string> socialDeterminantsOfHealth;
    std::vector<std::string> promptsAndSpecialInstructions;
};

// C++ struct -> JSON (what we send to React)
crow::json::wvalue toJson(const Persona& p);

// JSON -> C++ struct (what React sends us).
// Only overwrites fields that are present in the JSON, so the same function
// works for creating (start from an empty Persona) and updating (start from
// the existing one). Returns false and fills `error` if something is the
// wrong type.
bool applyJson(const crow::json::rvalue& body, Persona& p, std::string& error);