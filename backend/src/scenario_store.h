#pragma once

#include <optional>
#include <string>
#include <vector>
#include "scenario.h"
#include "supabase_client.h" 


class ScenarioStore {
public:
    // Returns a list of all scenarios, optionally filtered by a case-insensitive title search.
    std::vector<Scenario> list(const std::string& search = "") const;
    
    // Retrieves a scenario by its ID. Returns an optional that is empty if the scenario does not exist.
    std::optional<Scenario> get(int id) const;
    
    // Creates a new scenario, assigns it an ID and creation timestamp, and stores it. Returns the stored copy.
    Scenario create(Scenario scenario);
    
    // Updates an existing scenario. Returns false if the scenario does not exist.
    bool update(const Scenario& scenario);
    
    // Removes a scenario by its ID. Returns false if the scenario does not exist.
    bool remove(int id);
        
private:
	SupabaseClient db_;  
};

