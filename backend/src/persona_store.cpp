#include "persona_store.h"

#include <algorithm>
#include <cctype>
#include <ctime>

namespace {

std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

std::string todayIso() {
    std::time_t now = std::time(nullptr);
    char buf[11];
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", std::localtime(&now));
    return buf;
}

}  // namespace

std::vector<Persona> PersonaStore::list(const std::string& search) const {
    std::lock_guard<std::mutex> lock(mutex_);
    const std::string needle = toLower(search);

    std::vector<Persona> result;
    for (const auto& [id, p] : personas_) {
        if (needle.empty() || toLower(p.title).find(needle) != std::string::npos) {
            result.push_back(p);
        }
    }
    return result;
}

std::optional<Persona> PersonaStore::get(int id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = personas_.find(id);
    if (it == personas_.end()) return std::nullopt;
    return it->second;
}

Persona PersonaStore::create(Persona p) {
    std::lock_guard<std::mutex> lock(mutex_);
    p.id = nextId_++;
    p.createdAt = todayIso();
    personas_[p.id] = p;
    return p;
}

bool PersonaStore::update(const Persona& p) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = personas_.find(p.id);
    if (it == personas_.end()) return false;
    it->second = p;
    return true;
}

bool PersonaStore::remove(int id) {
    std::lock_guard<std::mutex> lock(mutex_);
    return personas_.erase(id) > 0;
}
