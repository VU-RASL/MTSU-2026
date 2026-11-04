#pragma once

#include <map>
#include <mutex>
#include <optional>
#include <string>
#include <vector>
#include "scenario.h"
#include "supabase_client.h" 


class ScenarioStore {
public:
    std::vector<Scenario> list(const std::string& search = "") const;
    std::optional<Scenario> get(int id) const;
    
    // Creates a new scenario, assigns it an ID and creation timestamp, and stores it. Returns the stored copy.
    Scenario create(Scenario scenario);
    
    // Updates an existing scenario. Returns false if the scenario does not exist.
    bool update(const Scenario& scenario);
    
    // Removes a scenario by its ID. Returns false if the scenario does not exist.
    bool remove(int id);

private:
    mutable std::mutex mutex_;
    std::map<int, Scenario> scenarios_;
    int nextId_ = 1;
	SupabaseClient db_;  
};
