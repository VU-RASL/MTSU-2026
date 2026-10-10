// =============================================================================
// persona.cpp — converting a Persona to and from JSON
// =============================================================================
//
// BIG PICTURE
// -----------
// React and our server talk in JSON. Our C++ code works with the Persona
// struct (see persona.h). This file is the translator between the two:
//
//   toJson()     Persona  -->  JSON   (sending a persona to React)
//   applyJson()  JSON     -->  Persona (reading what React sent us)
//
// THE KEY IDEA: FIELD TABLES
// --------------------------
// Instead of writing ~30 lines like
//     out["identity"]["name"] = p.name;
//     out["identity"]["age"]  = p.age;
//     ...
// in toJson(), and ~30 matching lines in applyJson(), we list every field
// ONCE in a table (kStringFields and kListFields below). Each row says:
//
//     "this spot in the JSON"   <-->   "this field in the struct"
//
// Then both functions just loop over the tables. So:
//   - the two directions can never disagree with each other, and
//   - adding a field means adding one row here (plus the struct field).
//
// LAYOUT OF THIS FILE
// -------------------
//   1. Type shortcuts (Path, StringMember, ListMember)
//   2. The field tables
//   3. Small helpers: describe(), slot(), find()
//   4. toJson()
//   5. applyJson()
// =============================================================================

#include "persona.h"

#include <utility>  // std::pair (the table rows) and std::move

// Everything inside this unnamed namespace is private to this file.
// main.cpp and persona_store.cpp can't see or accidentally reuse these names.
namespace {

// -----------------------------------------------------------------------------
// 1. Type shortcuts
// -----------------------------------------------------------------------------

// A Path is the list of keys to follow to reach a spot in the JSON.
// {"health", "diagnosis", "actual"} means json["health"]["diagnosis"]["actual"].
using Path = std::vector<std::string>;

// A "pointer to member": it names a FIELD of Persona, not a value.
// &Persona::name means "the name field", on no persona in particular.
// Later, p.*member reaches that field on a specific persona p.
//   StringMember  points at a std::string field (e.g. name, title)
//   ListMember    points at a std::vector<std::string> field (e.g. goals)
using StringMember = std::string Persona::*;
using ListMember = std::vector<std::string> Persona::*;

// -----------------------------------------------------------------------------
// 2. The field tables
//
// Each row: { where it lives in the JSON, which struct field it is }.
// To add a field: add it to the struct in persona.h, then add one row here.
// -----------------------------------------------------------------------------

// Fields that hold a single string.
const std::vector<std::pair<Path, StringMember>> kStringFields = {
    // Top of page (not nested)
    {{"title"},                                &Persona::title},
    {{"summary"},                              &Persona::summary},
    {{"color"},                                &Persona::color},

    // Identity section
    {{"identity", "name"},                     &Persona::name},
    {{"identity", "age"},                      &Persona::age},
    {{"identity", "ethnicity"},                &Persona::ethnicity},
    {{"identity", "sex"},                      &Persona::sex},
    {{"identity", "gender"},                   &Persona::gender},
    {{"identity", "sexualOrientation"},        &Persona::sexualOrientation},

    // Presentation section
    {{"presentation", "affect"},               &Persona::affect},
    {{"presentation", "speech"},               &Persona::speech},
    {{"presentation", "misc"},                 &Persona::misc},

    // Health section (diagnosis is nested one level deeper)
    {{"health", "chiefComplaint"},             &Persona::chiefComplaint},
    {{"health", "diagnosis", "actual"},        &Persona::actualDiagnosis},
    {{"health", "psychiatricProfile"},         &Persona::psychiatricProfile},
};

// Fields that hold a list of strings (JSON arrays).
const std::vector<std::pair<Path, ListMember>> kListFields = {
    // Metadata section
    {{"metadata", "contentWarnings"},          &Persona::contentWarnings},

    // Health section
    {{"health", "diagnosis", "differential"},  &Persona::differentialDiagnosis},
    {{"health", "historyOfPresentIllness", "medicationsAndAllergies"},
                                               &Persona::medicationsAndAllergies},
    {{"health", "pastMedicalHistory"},         &Persona::pastMedicalHistory},
    {{"health", "familyMedicalHistory"},       &Persona::familyMedicalHistory},

    // Remaining sections (not nested)
    {{"goals"},                                &Persona::goals},
    {{"challenges"},                           &Persona::challenges},
    {{"thoughtsAndFeelings"},                  &Persona::thoughtsAndFeelings},
    {{"tasksAndActivities"},                   &Persona::tasksAndActivities},
    {{"influencesAndSupports"},                &Persona::influencesAndSupports},
    {{"socialHistory"},                        &Persona::socialHistory},
    {{"culturalComponents"},                   &Persona::culturalComponents},
    {{"emotionalWellbeing"},                   &Persona::emotionalWellbeing},
    {{"socialDeterminantsOfHealth"},           &Persona::socialDeterminantsOfHealth},
    {{"promptsAndSpecialInstructions"},        &Persona::promptsAndSpecialInstructions},
};

// -----------------------------------------------------------------------------
// 3. Small helpers
// -----------------------------------------------------------------------------

// describe
// Turns a Path into dotted text for error messages.
// {"health", "diagnosis", "actual"}  ->  "health.diagnosis.actual"
std::string describe(const Path& path) {
    std::string s;
    for (const auto& part : path) {
        if (!s.empty()) s += '.';  // put a dot between parts, not before the first
        s += part;
    }
    return s;
}

// slot
// Used when BUILDING JSON (toJson). Walks down the Path in the outgoing JSON
// and returns the spot at the end, so the caller can put a value there.
// Crow creates any missing levels automatically when you index into them,
// so slot(out, {"health", "diagnosis", "actual"}) creates "health" and
// "diagnosis" if they don't exist yet.
crow::json::wvalue& slot(crow::json::wvalue& root, const Path& path) {
    crow::json::wvalue* cur = &root;              // start at the top
    for (const auto& part : path) cur = &(*cur)[part];  // step one level down per key
    return *cur;                                  // the spot at the end of the path
}

// find
// Used when READING JSON (applyJson). Walks down the Path in the incoming
// JSON. Unlike slot(), it never creates anything: if any step is missing,
// it returns nullptr, meaning "React didn't send this field".
const crow::json::rvalue* find(const crow::json::rvalue& root, const Path& path) {
    const crow::json::rvalue* cur = &root;  // start at the top
    for (const auto& part : path) {
        // Stop if this level isn't an object, or doesn't have the next key.
        if (cur->t() != crow::json::type::Object || !cur->has(part)) return nullptr;
        cur = &(*cur)[part];  // step one level down
    }
    return cur;  // found it
}

}  // namespace

// -----------------------------------------------------------------------------
// 4. toJson
//
// Persona (C++) --> JSON for React.
// Writes id and createdAt, then loops over both field tables and puts each
// field at its spot in the nested JSON.
// -----------------------------------------------------------------------------
crow::json::wvalue toJson(const Persona& p) {
    crow::json::wvalue out;         // starts as an empty JSON object
    out["id"] = p.id;               // server-managed fields go at the top level
    out["createdAt"] = p.createdAt;

    // Single-value fields: copy each one into its spot.
    // [path, member] unpacks each table row into its two parts.
    for (const auto& [path, member] : kStringFields) {
        slot(out, path) = p.*member;  // p.*member = "this field on persona p"
    }

    // List fields: JSON arrays have to be built item by item.
    for (const auto& [path, member] : kListFields) {
        std::vector<crow::json::wvalue> arr;              // the JSON array we'll build
        for (const auto& item : p.*member) arr.emplace_back(item);  // add each string
        slot(out, path) = std::move(arr);                 // move it into place (no copy)
    }
    return out;
}

// -----------------------------------------------------------------------------
// 5. applyJson
//
// JSON from React --> Persona (C++).
// For every field in the tables: if React sent it, check its type and copy
// it in. If React didn't send it, leave that field alone. That's what lets
// the same function handle both "create" and "partial update".
//
// Returns false (with a message in `error`) on the first problem found.
// -----------------------------------------------------------------------------
bool applyJson(const crow::json::rvalue& body, Persona& p, std::string& error) {
    // The whole body must be a JSON object { ... }, not a list, number, etc.
    if (body.t() != crow::json::type::Object) {
        error = "Request body must be a JSON object";
        return false;
    }

    // Single-value fields
    for (const auto& [path, member] : kStringFields) {
        const auto* value = find(body, path);  // look for this field in the JSON
        if (!value) continue;                  // not sent -> keep the current value
        if (value->t() != crow::json::type::String) {  // sent, but not a string
            error = "'" + describe(path) + "' must be a string";
            return false;
        }
        p.*member = std::string(value->s());   // copy the string into the struct
    }

    // List fields
    for (const auto& [path, member] : kListFields) {
        const auto* value = find(body, path);  // look for this field in the JSON
        if (!value) continue;                  // not sent -> keep the current value
        std::vector<std::string> items;        // collect the new list here first

        if (value->t() == crow::json::type::List) {
            // Normal case: a JSON array. Every item must be a string.
            for (const auto& item : value->lo()) {  // lo() = "list of" items
                if (item.t() != crow::json::type::String) {
                    error = "Every item in '" + describe(path) + "' must be a string";
                    return false;
                }
                items.emplace_back(item.s());  // add the string to our list
            }
        } else if (value->t() == crow::json::type::String) {
            // Convenience: accept a single string and treat it as a one-item list.
            // An empty string becomes an empty list.
            std::string s = value->s();
            if (!s.empty()) items.push_back(std::move(s));
        } else {
            // Anything else (a number, an object...) is an error.
            error = "'" + describe(path) + "' must be a list of strings";
            return false;
        }
        // Only replace the field once the whole list checked out, so a bad
        // item never leaves the persona half-updated for this field.
        p.*member = std::move(items);
    }

    // Every persona needs a title (it's what the list on the page shows).
    if (p.title.empty()) {
        error = "'title' is required";
        return false;
    }
    return true;  // everything was valid
}
