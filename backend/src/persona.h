// =============================================================================
// persona.h — what a Persona IS
// =============================================================================
//
// BIG PICTURE
// -----------
// A "persona" is one simulated patient/person on the Personas page (for
// example, Gloria, the grandmother hesitant about the MMR vaccine). This file
// defines the shape of that data in C++ and declares the two functions that
// convert it to and from JSON.
//
// HOW IT FITS WITH THE REST OF THE BACKEND
// ----------------------------------------
//   main.cpp           the "front desk": receives HTTP requests from React
//                      and decides what to do with each one
//   persona_store.*    the "filing cabinet": keeps all the personas
//   persona.*          (this file) the "translator": defines a Persona and
//                      converts between JSON (what React speaks) and the
//                      C++ struct (what our code works with)
//
// A request flows like this:
//   React --JSON--> main.cpp --applyJson()--> Persona --> persona_store
//   persona_store --> Persona --toJson()--> main.cpp --JSON--> React
//
// FLAT IN C++, NESTED IN JSON
// ---------------------------
// In C++, every field sits directly on the struct, so code can just write
// p.name or p.chiefComplaint.
//
// In JSON, the same fields are grouped by the sections on the page:
//   { "identity": { "name": "Gloria", "age": "39" },
//     "health":   { "diagnosis": { "actual": "..." } } }
//
// The field tables at the top of persona.cpp record where each C++ field
// lives in the JSON. That table is the ONLY place the two layouts are
// connected.
//
// TWO KINDS OF FIELDS
// -------------------
//   std::string               one value      (name, affect, chief complaint)
//   std::vector<std::string>  a list of values (goals, possible diagnoses)
//
// ADDING A NEW FIELD
// ------------------
//   1. Add it to the struct below.
//   2. Add one row to kStringFields or kListFields in persona.cpp.
//   That's it. toJson() and applyJson() pick it up automatically.
// =============================================================================

#pragma once  // only include this file once per .cpp, even if #included twice

#include <string>   // std::string
#include <vector>   // std::vector, used for the list fields
#include "crow.h"   // crow::json types used in the function declarations below

// -----------------------------------------------------------------------------
// Persona
//
// One persona's data. It's a struct (not a class) because it's plain data:
// every field is public and there are no rules to protect, so any code may
// read or change any field directly.
//
// Fields are grouped in the same order as the sections on the page.
// -----------------------------------------------------------------------------
struct Persona {
    // --- Set by the server, never by React ---
    int id = 0;             // unique number; 0 means "not saved yet"
    std::string createdAt;  // date the persona was created, e.g. "2026-10-02"

    // --- Top of page ---
    std::string title;      // scenario title shown in the persona list
    std::string summary;    // one-line description of the scenario
    std::string color;      // card color as a hex code, e.g. "#F4C542"

    // --- Metadata section ---
    std::vector<std::string> contentWarnings;  // e.g. "discusses illness"

    // --- Identity section ---
    std::string name;               // persona's full name
    std::string age;                // a string so "5 months" or "late 30s" work too
    std::string ethnicity;
    std::string sex;
    std::string gender;
    std::string sexualOrientation;

    // --- Presentation And Resulting Behavior section ---
    std::string affect;  // emotional state shown, e.g. "hesitant, nervous"
    std::string speech;  // how they talk, e.g. "typical", "slurred"
    std::string misc;    // anything else about how they present

    // --- Health Components section ---
    std::string chiefComplaint;                       // main reason for the visit
    std::vector<std::string> differentialDiagnosis;   // Diagnosis > Differential (possible diagnoses)
    std::string actualDiagnosis;                      // Diagnosis > Actual (the real one)
    std::vector<std::string> medicationsAndAllergies; // History Of Present Illness
    std::vector<std::string> pastMedicalHistory;      // earlier conditions
    std::vector<std::string> familyMedicalHistory;    // conditions in the family
    std::string psychiatricProfile;                   // mental health notes

    // --- Remaining sections (lists outside the collapsible sections) ---
    std::vector<std::string> goals;                         // what the persona wants
    std::vector<std::string> challenges;                    // what gets in their way
    std::vector<std::string> thoughtsAndFeelings;           // inner state
    std::vector<std::string> tasksAndActivities;            // what happens in the scenario
    std::vector<std::string> influencesAndSupports;         // people/things that help
    std::vector<std::string> socialHistory;                 // lifestyle, relationships
    std::vector<std::string> culturalComponents;            // cultural factors
    std::vector<std::string> emotionalWellbeing;            // emotional health
    std::vector<std::string> socialDeterminantsOfHealth;    // housing, food, income...
    std::vector<std::string> promptsAndSpecialInstructions; // notes for running the scenario
};

// -----------------------------------------------------------------------------
// toJson
//
// Converts a Persona (C++) into JSON to send to React.
// The output is nested by page section, e.g. p.name ends up at
// json["identity"]["name"]. Defined in persona.cpp.
//
//   p        the persona to convert (const&: read-only, not copied)
//   returns  a crow::json::wvalue ("w" = writable JSON) ready to send
// -----------------------------------------------------------------------------
crow::json::wvalue toJson(const Persona& p);

// -----------------------------------------------------------------------------
// applyJson
//
// Copies values from JSON that React sent into a Persona (C++).
//
// It only overwrites fields that are PRESENT in the JSON. That's why one
// function handles both cases:
//   creating  start from an empty Persona   -> missing fields stay blank
//   updating  start from the existing one   -> missing fields stay unchanged
//
//   body     the parsed request JSON (crow::json::rvalue, "r" = read-only)
//   p        the persona to fill in (a non-const reference, so it's changed in place)
//   error    filled in with a message if something is wrong
//   returns  true if everything was valid, false if not (check `error`)
// -----------------------------------------------------------------------------
bool applyJson(const crow::json::rvalue& body, Persona& p, std::string& error);
