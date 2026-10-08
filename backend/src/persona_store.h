#pragma once

#include <map>
#include <mutex>
#include <optional>
#include <string>
#include <vector>
#include "persona.h"

// Holds every persona in memory. When we move to a real database later, only
// this class has to change; the routes in main.cpp stay the same.
//
// Crow handles requests on several threads at once, so every method locks a
// mutex. Without it, two requests editing the map at the same time could
// corrupt it.
class PersonaStore {
public:
    // All personas, optionally filtered by a case-insensitive title search.
    std::vector<Persona> list(const std::string& search = "") const;

    std::optional<Persona> get(int id) const;

    // Assigns id and createdAt, then stores it. Returns the stored copy.
    Persona create(Persona p);

    // Replaces the persona with this id. Returns false if it doesn't exist.
    bool update(const Persona& p);

    // Returns false if nothing had that id.
    bool remove(int id);

private:
    mutable std::mutex mutex_;
    std::map<int, Persona> personas_;   // id -> persona, kept sorted by id
    int nextId_ = 1;
};
