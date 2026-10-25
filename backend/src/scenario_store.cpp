#include "scenario_store.h"

#include <algorithm>
#include <cctype>
#include <ctime>
#include <stdexcept>
#include <utility>

namespace {

std::string toLower(std::string text) {
    std::transform(text.begin(), text.end(), text.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return text;
}

std::string todayIso() {
    const std::time_t now = std::time(nullptr);
    std::tm date{};
#ifdef _WIN32
    localtime_s(&date, &now);
#else
    localtime_r(&now, &date);
#endif

    char buffer[11]{};
    if (std::strftime(buffer, sizeof(buffer), "%Y-%m-%d", &date) == 0) {
        throw std::runtime_error("Could not format scenario creation date");
    }
    return buffer;
}

}  // namespace

std::vector<Scenario> ScenarioStore::list(const std::string& search) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const std::string needle = toLower(search);

    std::vector<Scenario> result;
    for (const auto& [id, scenario] : scenarios_) {
        if (needle.empty() ||
            toLower(scenario.title).find(needle) != std::string::npos) {
            result.push_back(scenario);
        }
    }
    return result;
}

std::optional<Scenario> ScenarioStore::get(int id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto it = scenarios_.find(id);
    if (it == scenarios_.end()) {
        return std::nullopt;
    }
    return it->second;
}

Scenario ScenarioStore::create(Scenario scenario) {
    std::lock_guard<std::mutex> lock(mutex_);
    scenario.id = nextId_++;
    scenario.createdAt = todayIso();
    scenarios_[scenario.id] = scenario;
    return scenario;
}

bool ScenarioStore::update(const Scenario& scenario) {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto it = scenarios_.find(scenario.id);
    if (it == scenarios_.end()) {
        return false;
    }

    Scenario updated = scenario;
    updated.createdAt = it->second.createdAt;
    it->second = std::move(updated);
    return true;
}

bool ScenarioStore::remove(int id) {
    std::lock_guard<std::mutex> lock(mutex_);
    return scenarios_.erase(id) != 0;
}
