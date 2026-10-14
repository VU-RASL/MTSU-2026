#include "scenario.h"

#include <utility>

namespace {

/* 
---------------------------------------------------------------------------
   Field tables

   Each row says: "this JSON location <-> this C++ field".
   The C++ field &Scenario::title identifies which Scenario member to access. 
   
   Adding a field means adding it to scenario.h and adding a row here.
---------------------------------------------------------------------------
*/

using Path = std::vector<std::string>; 
using StringMember = std::string Scenario::*; 
using ListMember = std::vector<std::string> Scenario::*;

// Maps single-value JSON field to their corresponding Scenario fields.
const std::vector<std::pair<Path, StringMember>> kStringFields = {
    {{"title"},                                &Scenario::title},
    {{"summary"},                              &Scenario::summary},
    {{"setting"},                              &Scenario::setting},
    {{"difficulty"},                           &Scenario::difficulty},
    {{"instructions"},                         &Scenario::instructions},
    {{"patientSituation"},                     &Scenario::patientSituation},
};

// Maps JSON arrays to their corresponding Scenario members.
const std::vector<std::pair<Path, ListMember>> kListFields = { 
    {{"learningObjectives"},                   &Scenario::learningObjectives}, 
    {{"requiredTasks"},                        &Scenario::requiredTasks}, 
};

// readable string for error messages.
std::string describe(const Path& path) { 
    std::string result; 
    
    for (const auto& part : path) { 
        if (!result.empty()) result += '.';
        result += part; 
    }
    return result;
}

// Finds a field in the incoming JSON object. 
// Returns nullptr if the field is missing. 
// Missing fields are left unchanged when updating a Scenario.
const crow::json::rvalue* find(const crow::json::rvalue& root, const Path& path) {
    const crow::json::rvalue* current = &root;

    for (const auto& part : path) {
        if (current->t() != crow::json::type::Object || !current->has(part)) return nullptr;
        current = &(*current)[part];
    }

    return current;
}

}  //namespace ends

// Converts a C++ Scenario object into JSON. 
// This is the format the backend can return to the frontend.
crow::json::wvalue toJson(const Scenario& scenario) {
    crow::json::wvalue output;

    output["id"] = scenario.id; 
    output["createdAt"] = scenario.createdAt;

    // Convert all single-value fields into JSON properties.
    for (const auto& [path, member] : kStringFields) {
        output[path[0]] = scenario.*member;
    }

    // Convert C++ vectors into JSON arrays.
    for (const auto& [path, member] : kListFields) {
        std::vector<crow::json::wvalue> items;

        for (const auto& item : scenario.*member) {
            items.emplace_back(item);
        }
        output[path[0]] = std::move(items);
    }
    return output;
}

// Converts incoming JSON into a C++ Scenario object. 
// Only fields present in the JSON are updated, allowing this function 
// to be used for both creating a new Scenario and updating an existing one.
// Returns false and fills "error" if a field has the wrong type.
bool applyJson(const crow::json::rvalue& body, Scenario& scenario, std::string& error) {
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
        scenario.*member = std::string(value->s());
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
        }

        else if (value->t() == crow::json::type::String) { 
            std::string item = value->s(); 
            if (!item.empty()) { 
                items.push_back(std::move(item)); 
            } 
        } 
        else { 
            error = "'" + describe(path) + "' must be a list of strings"; 
            return false; 
        } 
        scenario.*member = std::move(items);
    }
    
    if (scenario.title.empty()) { 
        error = "'title' is required"; 
        return false; 
    } 
    return true;  
}
