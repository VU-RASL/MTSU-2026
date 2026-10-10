// =============================================================================
// persona_store.cpp — how the store does its work
// =============================================================================
//
// BIG PICTURE
// -----------
// The method bodies for PersonaStore (declared in persona_store.h).
// Every method follows the same pattern:
//
//   1. Lock the mutex, so no other request can touch the map right now.
//   2. Do the work on the map (personas_).
//   3. Return. The lock is released automatically when the method ends.
//
// Step 3 works because of std::lock_guard: it locks when it's created and
// unlocks when it goes out of scope (at the closing } of the method), even
// if the method returns early. So there's no way to forget to unlock.
//
// When we switch to the database, the bodies of these five methods are
// what get rewritten; their signatures stay the same.
// =============================================================================

#include "persona_store.h"

#include <algorithm>  // std::transform, used in toLower
#include <cctype>     // std::tolower
#include <ctime>      // std::time, std::strftime, for today's date

// Helpers private to this file (see the note in persona.cpp).
namespace {

// toLower
// Returns a lowercase copy of a string, so searches ignore case:
// "MMR" and "mmr" both become "mmr".
// (The string is taken by value, so changing it doesn't affect the caller's.)
std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),  // go through every character...
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });  // ...and lowercase it
    return s;
}

// todayIso
// Returns today's date as text in "YYYY-MM-DD" form, e.g. "2026-10-02".
std::string todayIso() {
    std::time_t now = std::time(nullptr);  // current time, as seconds since 1970
    char buf[11];                          // "YYYY-MM-DD" is 10 characters, +1 for the end marker
    std::strftime(buf, sizeof(buf), "%Y-%m-%d", std::localtime(&now));  // format it into buf
    return buf;                            // converts to std::string automatically
}

}  // namespace

// -----------------------------------------------------------------------------
// list
// Goes through every persona and keeps the ones whose title contains the
// search text. An empty search keeps everything.
// -----------------------------------------------------------------------------
std::vector<Persona> PersonaStore::list(const std::string& search) const {
    std::lock_guard<std::mutex> lock(mutex_);  // lock until this method ends
    const std::string needle = toLower(search);  // the text we're looking for, lowercased

    std::vector<Persona> result;
    for (const auto& [id, p] : personas_) {  // each map entry unpacks into its id and persona
        // Keep it if there's no search, OR the lowercased title contains the search.
        // find() returns std::string::npos when the text isn't found.
        if (needle.empty() || toLower(p.title).find(needle) != std::string::npos) {
            result.push_back(p);  // add a copy to the results
        }
    }
    return result;  // already sorted by id, because std::map keeps its keys in order
}

// -----------------------------------------------------------------------------
// get
// Looks up one persona by id.
// -----------------------------------------------------------------------------
std::optional<Persona> PersonaStore::get(int id) const {
    std::lock_guard<std::mutex> lock(mutex_);   // lock until this method ends
    auto it = personas_.find(id);               // search the map for this id
    if (it == personas_.end()) return std::nullopt;  // end() means "not found"
    return it->second;                          // it->first is the id, it->second is the persona
}

// -----------------------------------------------------------------------------
// create
// Gives the persona a new id and today's date, then saves it.
// `p` is taken by value (a copy), so we can set its id without changing the
// caller's persona.
// -----------------------------------------------------------------------------
Persona PersonaStore::create(Persona p) {
    std::lock_guard<std::mutex> lock(mutex_);  // lock until this method ends
    p.id = nextId_++;                          // use the next id, THEN add 1 for next time
    p.createdAt = todayIso();                  // stamp today's date
    personas_[p.id] = p;                       // save it in the map under its id
    return p;                                  // return the saved version (with id and date)
}

// -----------------------------------------------------------------------------
// update
// Overwrites an existing persona. Fails if the id isn't in the map.
// -----------------------------------------------------------------------------
bool PersonaStore::update(const Persona& p) {
    std::lock_guard<std::mutex> lock(mutex_);  // lock until this method ends
    auto it = personas_.find(p.id);            // find the stored persona with this id
    if (it == personas_.end()) return false;   // no such persona
    it->second = p;                            // replace the stored copy with the new one
    return true;
}

// -----------------------------------------------------------------------------
// remove
// Deletes a persona by id.
// -----------------------------------------------------------------------------
bool PersonaStore::remove(int id) {
    std::lock_guard<std::mutex> lock(mutex_);  // lock until this method ends
    return personas_.erase(id) > 0;            // erase() returns how many it removed (0 or 1)
}
