#pragma once

#include <vector>
#include "scenario.h" 

 /* 
 This class manages the scenarios created by educators. 

 The store is responsible for creating, retrieving, updating, 
 and deleting scenarios. It does not handle HTTP requests directly.
 */

 class ScenarioStore {
public:
    // Returns a list of all scenarios, optionally filtered by a case-insensitive title search.
    std::vector<Scenario> list(const std::string& search = "") const;
    
    // Retrieves a scenario by its ID. Returns an optional that is empty if the scenario does not exist.
    std::optional<Scenario> get(int id) const;
    
    // Creates a new scenario, assigns it an ID and creation timestamp, and stores it. Returns the stored copy.
    Scenario create(Scenario s);
    
    // Updates an existing scenario. Returns false if the scenario does not exist.
    bool update(const Scenario& s);
    
    // Removes a scenario by its ID. Returns false if the scenario does not exist.
    bool remove(int id);
        
private:
    mutable std::mutex mutex_;  // Mutex to ensure thread safety for concurrent access.
    std::map<int, Scenario> scenarios_;  // Map of scenario ID to Scenario object
    int nextId_ = 1;  // Next available ID for a new scenario.  
};

