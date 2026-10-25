#pragma once

#include <map>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

#include "scenario.h"

class ScenarioStore {
public:
    std::vector<Scenario> list(const std::string& search = "") const;
    std::optional<Scenario> get(int id) const;
    Scenario create(Scenario scenario);
    bool update(const Scenario& scenario);
    bool remove(int id);

private:
    mutable std::mutex mutex_;
    std::map<int, Scenario> scenarios_;
    int nextId_ = 1;
};
