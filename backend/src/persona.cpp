#include "persona.h"

#include <utility>

namespace {

// ---------------------------------------------------------------------------
// Field tables
//
// Each row says: "this JSON location <-> this C++ field".
// `{"identity", "name"}` means json["identity"]["name"].
// `std::string Persona::*` is a "pointer to member": it names a field, and
// p.*member reaches that field on a specific persona.
//
// Adding a field = add it to the struct + add one row here. Nothing else.
// ---------------------------------------------------------------------------
using Path = std::vector<std::string>;
using StringMember = std::string Persona::*;
using ListMember = std::vector<std::string> Persona::*;

const std::vector<std::pair<Path, StringMember>> kStringFields = {
    {{"title"},                                &Persona::title},
    {{"summary"},                              &Persona::summary},
    {{"color"},                                &Persona::color},

    {{"identity", "name"},                     &Persona::name},
    {{"identity", "age"},                      &Persona::age},
    {{"identity", "ethnicity"},                &Persona::ethnicity},
    {{"identity", "sex"},                      &Persona::sex},
    {{"identity", "gender"},                   &Persona::gender},
    {{"identity", "sexualOrientation"},        &Persona::sexualOrientation},

    {{"presentation", "affect"},               &Persona::affect},
    {{"presentation", "speech"},               &Persona::speech},
    {{"presentation", "misc"},                 &Persona::misc},

    {{"health", "chiefComplaint"},             &Persona::chiefComplaint},
    {{"health", "diagnosis", "actual"},        &Persona::actualDiagnosis},
    {{"health", "psychiatricProfile"},         &Persona::psychiatricProfile},
};

const std::vector<std::pair<Path, ListMember>> kListFields = {
    {{"metadata", "contentWarnings"},          &Persona::contentWarnings},

    {{"health", "diagnosis", "differential"},  &Persona::differentialDiagnosis},
    {{"health", "historyOfPresentIllness", "medicationsAndAllergies"},
                                               &Persona::medicationsAndAllergies},
    {{"health", "pastMedicalHistory"},         &Persona::pastMedicalHistory},
    {{"health", "familyMedicalHistory"},       &Persona::familyMedicalHistory},

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

// "health.diagnosis.actual" — used in error messages.
std::string describe(const Path& path) {
    std::string s;
    for (const auto& part : path) {
        if (!s.empty()) s += '.';
        s += part;
    }
    return s;
}

// Walks/creates nested objects in the outgoing JSON and returns the slot.
crow::json::wvalue& slot(crow::json::wvalue& root, const Path& path) {
    crow::json::wvalue* cur = &root;
    for (const auto& part : path) cur = &(*cur)[part];
    return *cur;
}

// Looks up a nested value in the incoming JSON. Returns nullptr if any step
// along the way is missing (meaning "the client didn't send this field").
const crow::json::rvalue* find(const crow::json::rvalue& root, const Path& path) {
    const crow::json::rvalue* cur = &root;
    for (const auto& part : path) {
        if (cur->t() != crow::json::type::Object || !cur->has(part)) return nullptr;
        cur = &(*cur)[part];
    }
    return cur;
}

}  // namespace

crow::json::wvalue toJson(const Persona& p) {
    crow::json::wvalue out;
    out["id"] = p.id;
    out["createdAt"] = p.createdAt;

    for (const auto& [path, member] : kStringFields) {
        slot(out, path) = p.*member;
    }

    for (const auto& [path, member] : kListFields) {
        std::vector<crow::json::wvalue> arr;
        for (const auto& item : p.*member) arr.emplace_back(item);
        slot(out, path) = std::move(arr);
    }
    return out;
}

bool applyJson(const crow::json::rvalue& body, Persona& p, std::string& error) {
    if (body.t() != crow::json::type::Object) {
        error = "Request body must be a JSON object";
        return false;
    }

    for (const auto& [path, member] : kStringFields) {
        const auto* value = find(body, path);
        if (!value) continue;
        if (value->t() != crow::json::type::String) {
            error = "'" + describe(path) + "' must be a string";
            return false;
        }
        p.*member = std::string(value->s());
    }

    for (const auto& [path, member] : kListFields) {
        const auto* value = find(body, path);
        if (!value) continue;
        std::vector<std::string> items;

        if (value->t() == crow::json::type::List) {
            for (const auto& item : value->lo()) {
                if (item.t() != crow::json::type::String) {
                    error = "Every item in '" + describe(path) + "' must be a string";
                    return false;
                }
                items.emplace_back(item.s());
            }
        } else if (value->t() == crow::json::type::String) {
            // Convenience: accept a single string and treat it as a one-item list.
            std::string s = value->s();
            if (!s.empty()) items.push_back(std::move(s));
        } else {
            error = "'" + describe(path) + "' must be a list of strings";
            return false;
        }
        p.*member = std::move(items);
    }

    if (p.title.empty()) {
        error = "'title' is required";
        return false;
    }
    return true;
}
