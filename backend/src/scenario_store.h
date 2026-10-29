#pragma once

#include <optional>  // std::optional, for "a persona, or nothing"
#include <string>
#include <vector>
#include <mutex>
#include <map>
#include "scenario.h" 

 /* 
 This class manages the scenarios created by educators. 

 The store is responsible for creating, retrieving, updating, and deleting scenarios. 
 It communicates with Supabase, while main.cpp handles HTTP requests.
 */

 class ScenarioStore {
public:
    // Reads the Supabase connection settings from environment variables.
     ScenarioStore();

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
    // Supabase project URL and server-side secret key. 
    std::string baseUrl_; 
    std::string secretKey_; 
    
    // Sends an HTTP request to the Supabase REST API. 
    std::string request(
        const std::string& method, 
        const std::string& path, 
        const std::string& body = "" 
    ) const; 
};