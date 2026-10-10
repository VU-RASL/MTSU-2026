// =============================================================================
// persona_store.h — where the personas are kept
// =============================================================================
//
// BIG PICTURE
// -----------
// PersonaStore is the "filing cabinet" for personas. The routes in main.cpp
// never touch the data directly; they ask the store to list, get, create,
// update, or remove a persona.
//
// RIGHT NOW: everything lives in memory (a std::map). Stopping the server
// erases it all.
//
// LATER (database): this class is the only part that has to change. As long
// as these five methods keep the same names and return types, main.cpp
// doesn't need to know whether the data comes from a map or from Supabase.
//
// WHY A MUTEX?
// ------------
// Crow handles several requests at the same time, on different threads.
// If two requests changed the map at the exact same moment (say, two people
// creating a persona), the map could get corrupted. A mutex is a lock that
// only one thread can hold at a time: each method grabs it before touching
// the map and releases it when done, so they take turns.
//
// WHY A CLASS (AND NOT A STRUCT LIKE Persona)?
// -------------------------------------------
// The map, the lock, and the id counter must only be changed through the
// methods below, or the rules above break (e.g. two personas getting the
// same id). Making them private enforces that.
// =============================================================================

#pragma once  // only include this file once per .cpp, even if #included twice

#include <map>       // std::map, holds the personas
#include <mutex>     // std::mutex, the lock described above
#include <optional>  // std::optional, for "a persona, or nothing"
#include <string>
#include <vector>
#include "persona.h" // the Persona struct

class PersonaStore {
public:
    // -------------------------------------------------------------------------
    // list
    // Returns all personas, sorted by id.
    // If `search` isn't empty, only returns personas whose title contains it
    // (ignoring upper/lower case). Used by GET /api/personas?search=...
    // -------------------------------------------------------------------------
    std::vector<Persona> list(const std::string& search = "") const;

    // -------------------------------------------------------------------------
    // get
    // Finds one persona by id.
    // Returns the persona, or std::nullopt ("nothing") if no persona has that
    // id. std::optional lets one return type say "here it is" OR "not found".
    // Used by GET and PUT /api/personas/<id>.
    // -------------------------------------------------------------------------
    std::optional<Persona> get(int id) const;

    // -------------------------------------------------------------------------
    // create
    // Saves a new persona. The store assigns its id and createdAt date, so
    // whatever the caller put in those fields is ignored.
    // Returns the saved copy, including the new id. Used by POST /api/personas.
    // -------------------------------------------------------------------------
    Persona create(Persona p);

    // -------------------------------------------------------------------------
    // update
    // Replaces the stored persona that has the same id as `p`.
    // Returns false if no persona has that id. Used by PUT /api/personas/<id>.
    // -------------------------------------------------------------------------
    bool update(const Persona& p);

    // -------------------------------------------------------------------------
    // remove
    // Deletes the persona with this id.
    // Returns false if nothing had that id. Used by DELETE /api/personas/<id>.
    // -------------------------------------------------------------------------
    bool remove(int id);

private:
    // `mutable` lets the lock be used inside const methods (list and get).
    // Those methods don't change any personas, but locking still changes the
    // mutex's own state, so the compiler needs this permission.
    mutable std::mutex mutex_;

    std::map<int, Persona> personas_;  // id -> persona; std::map keeps keys sorted, so ids stay in order
    int nextId_ = 1;                   // the id the next new persona will get; goes up by 1 each time
};
