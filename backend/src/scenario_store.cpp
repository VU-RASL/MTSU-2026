#include "scenario_store.h"

#include <algorithm>
#include <cctype>
#include <ctime>

namespace { 

// Helper function to convert a string to lowercase for case-insensitive comparisons.
std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

// Helper function to get the current date in ISO format (YYYY-MM-DD).
std::string todayIso() {
    std::time_t now = std::time(nullptr);
    char buf[11];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", std::localtime(&now));
    return buf;
}

}  // namespace 

// Lists all scenarios, optionally filtered by a case-insensitive title search.
std::vector<Scenario> ScenarioStore::list(const std::string& search) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const std::string needle = toLower(search);

    std::vector<Scenario> result;
    for (const auto& [id, s] : scenarios_) {
        if (needle.empty() || toLower(s.title).find(needle) != std::string::npos) {
            result.push_back(s);
        }
    }
    return result;
}

// Retrieves a scenario by its ID. Returns an optional that is empty if the scenario does not exist.
std::optional<Scenario> ScenarioStore::get(int id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = scenarios_.find(id);
    if (it == scenarios_.end()) return std::nullopt;
    return it->second;
}

// Creates a new scenario, assigns it an ID and creation timestamp, and stores it. Returns the stored copy.
Scenario ScenarioStore::create(Scenario s) {
    std::lock_guard<std::mutex> lock(mutex_);
    s.id = nextId_++;
    s.createdAt = todayIso();
    scenarios_[s.id] = s;
    return s;
}

// Updates an existing scenario. Returns false if the scenario does not exist.
bool ScenarioStore::update(const Scenario& s) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = scenarios_.find(s.id);
    if (it == scenarios_.end()) return false;

    // Preserve the original creation date when updating a scenario.
    Scenario updatedScenario = s;
    updatedScenario.createdAt = it->second.createdAt;
    it->second = updatedScenario;
    return true;
}

// Removes a scenario by its ID. Returns false if the scenario does not exist.
bool ScenarioStore::remove(int id) {     
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = scenarios_.find(id);
    if (it == scenarios_.end()) return false;
    scenarios_.erase(it);
    return true;
}
