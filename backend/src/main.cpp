// =============================================================================
// main.cpp — the "front desk" of the server
// =============================================================================
//
// BIG PICTURE
// -----------
// This is where the program starts. It:
//   1. Creates the Crow web server.
//   2. Turns on CORS, so the React app is allowed to call us.
//   3. Creates the PersonaStore and puts one sample persona in it.
//   4. Defines the ROUTES: which code runs for which URL + HTTP method.
//   5. Starts listening for requests (port 18080 by default).
//
// WHAT A ROUTE IS
// ---------------
// A route pairs a URL and a method with the code that handles it:
//
//   GET    /api/health          is the server up?
//   GET    /api/personas        list all personas (optional ?search=)
//   POST   /api/personas        create a persona
//   GET    /api/personas/<id>   get one persona
//   PUT    /api/personas/<id>   update a persona
//   DELETE /api/personas/<id>   delete a persona
//
// Same URL, different method = different route. That's how
// GET /api/personas (list) and POST /api/personas (create) can share a URL.
//
// HOW A ROUTE IS WRITTEN IN CROW
// ------------------------------
//   CROW_ROUTE(app, "/api/personas/<int>").methods("GET"_method)
//   ([&store](int id) {
//       ... build and return a response ...
//   });
//
//   CROW_ROUTE(app, url)   registers the URL. <int> captures a number from
//                          the URL and passes it to the handler as `id`.
//   .methods(...)          which HTTP method(s) this route answers.
//   [&store](...) { }      a LAMBDA: a small unnamed function written right
//                          here. [&store] lets it use the store variable
//                          from main(). Its parameters are what Crow passes
//                          in: the request (req) and/or the <int> from the URL.
//
// HTTP STATUS CODES USED HERE
// ---------------------------
//   200 OK            success, here's the data
//   201 Created       a new persona was made
//   204 No Content    success, nothing to send back (used for delete)
//   400 Bad Request   the JSON was broken or a field had the wrong type
//   404 Not Found     no persona with that id
//
// Each route's job is small: read the request, call the store, and turn the
// result into a response. The real work happens in persona.cpp (JSON) and
// persona_store.cpp (data).
// =============================================================================

#include <cstdlib>   // std::getenv, std::atoi, for reading the PORT setting
#include <string>
#include <vector>

#include "crow.h"                     // the Crow web framework
#include "crow/middlewares/cors.h"    // CORS support (explained in main below)
#include "persona.h"                  // Persona, toJson(), applyJson()
#include "persona_store.h"            // PersonaStore

// Helpers private to this file.
namespace {

// -----------------------------------------------------------------------------
// jsonError
// Builds an error response like  {"error": "Persona not found"}  with the
// given status code, so every error the API sends has the same shape.
// React can always check the "error" key.
// -----------------------------------------------------------------------------
crow::response jsonError(int status, const std::string& message) {
    crow::json::wvalue body;       // empty JSON object
    body["error"] = message;       // {"error": "..."}
    return crow::response(status, body);
}

// -----------------------------------------------------------------------------
// seed
// Adds one sample persona at startup so the page isn't empty while testing.
// Fields not set here stay blank (empty strings and empty lists).
//
// NOTE: This goes away when we switch to Supabase. The sample persona will
// become a row in the database instead of being typed into the code.
// -----------------------------------------------------------------------------
void seed(PersonaStore& store) {
    Persona p;  // starts with every field empty

    // Top of page
    p.title = "Pediatric MMR Vaccination and Anaphylaxis Response";
    p.summary = "A grandmother who is hesitant about vaccinating her 5 year old grandson.";
    p.color = "#F4C542";

    // Identity
    p.name = "Gloria Nellie No Braids";
    p.age = "39";
    p.ethnicity = "Navajo";
    p.sex = "Female";
    p.gender = "Female";

    // Presentation
    p.affect = "Hesitant, nervous, and questioning";
    p.speech = "typical";

    // Health
    p.chiefComplaint = "child coming for MMR vaccine for upcoming school year";

    // Lists: {"a", "b"} creates a list with those items
    p.goals = {"achieve vaccinations"};
    p.challenges = {"unfamiliarity and distrust with western medicine"};
    p.thoughtsAndFeelings = {"hesitant", "questions"};
    p.tasksAndActivities = {"administration of MMR vaccine"};
    p.socialDeterminantsOfHealth = {"Lives with grandmother", "no food or housing insecurities"};

    store.create(p);  // the store assigns id 1 and today's date
}

}  // namespace

int main() {
    // -------------------------------------------------------------------------
    // 1. Create the server, with CORS turned on
    //
    // Browsers treat a different port as a different "origin" (website).
    // React runs on port 5173 and we run on 18080, so by default the browser
    // BLOCKS React from reading our responses. CORS is how a server says
    // "requests from that origin are allowed."
    //
    // crow::App<crow::CORSHandler> = a Crow app with the CORS add-on built in.
    // -------------------------------------------------------------------------
    crow::App<crow::CORSHandler> app;

    // Grab the CORS add-on so we can configure it.
    auto& cors = app.get_middleware<crow::CORSHandler>();
    cors.global()                              // these rules apply to every route
        .origin("http://localhost:5173")       // allow Vite's default React dev port
        .methods("GET"_method, "POST"_method, "PUT"_method, "DELETE"_method)  // allowed methods
        .headers("Content-Type");              // React may send this header (needed for JSON bodies)

    // -------------------------------------------------------------------------
    // 2. Create the store and add the sample persona
    // -------------------------------------------------------------------------
    PersonaStore store;
    seed(store);

    // -------------------------------------------------------------------------
    // GET /api/health
    // A quick "is the server up?" check. Always returns {"status": "ok"}.
    // CROW_ROUTE with no .methods() answers GET by default.
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/health")([] {
        crow::json::wvalue body;
        body["status"] = "ok";
        return body;  // a JSON value is sent with status 200 automatically
    });

    // -------------------------------------------------------------------------
    // GET /api/personas            all personas
    // GET /api/personas?search=mmr only personas whose title contains "mmr"
    //
    // Feeds the "All Personas" list on the page.
    // Returns 200 with a JSON array of personas (possibly empty: []).
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/personas").methods("GET"_method)
    ([&store](const crow::request& req) {
        // Read ?search=... from the URL. get() returns nullptr if it's not there.
        const char* search = req.url_params.get("search");

        std::vector<crow::json::wvalue> items;  // the JSON array we'll send
        // No search given -> pass "" so the store returns everything.
        for (const auto& p : store.list(search ? search : "")) {
            items.push_back(toJson(p));         // convert each persona to JSON
        }
        return crow::response(200, crow::json::wvalue(std::move(items)));
    });

    // -------------------------------------------------------------------------
    // POST /api/personas
    // Creates a new persona from the JSON body. Used by "New Persona".
    //
    //   201  the new persona, including its id and createdAt
    //   400  broken JSON, a field of the wrong type, or no title
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/personas").methods("POST"_method)
    ([&store](const crow::request& req) {
        auto body = crow::json::load(req.body);   // parse the raw text into JSON
        if (!body) return jsonError(400, "Invalid JSON");  // parsing failed

        Persona p;                                // start from an empty persona
        std::string error;
        if (!applyJson(body, p, error)) return jsonError(400, error);  // fill it in from the JSON

        // Save it; the store assigns the id and date. Send back the saved version.
        return crow::response(201, toJson(store.create(p)));
    });

    // -------------------------------------------------------------------------
    // GET /api/personas/<id>      e.g. /api/personas/3
    // Gets one persona. Used when opening the "Edit Persona" panel.
    //
    //   200  the persona
    //   404  no persona with that id
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/personas/<int>").methods("GET"_method)
    ([&store](int id) {                           // id comes from the <int> in the URL
        auto p = store.get(id);                   // a std::optional: the persona, or nothing
        if (!p) return jsonError(404, "Persona not found");
        return crow::response(200, toJson(*p));   // *p takes the persona out of the optional
    });

    // -------------------------------------------------------------------------
    // PUT /api/personas/<id>
    // Saves edits. Only the fields included in the JSON change; everything
    // else keeps its current value (see applyJson in persona.cpp).
    //
    //   200  the updated persona
    //   400  broken JSON or a field of the wrong type
    //   404  no persona with that id
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/personas/<int>").methods("PUT"_method)
    ([&store](const crow::request& req, int id) {
        auto existing = store.get(id);            // the current version
        if (!existing) return jsonError(404, "Persona not found");

        auto body = crow::json::load(req.body);   // parse the request JSON
        if (!body) return jsonError(400, "Invalid JSON");

        Persona updated = *existing;              // start from a copy, so id and createdAt carry over
        std::string error;
        if (!applyJson(body, updated, error)) return jsonError(400, error);  // apply only the sent fields

        store.update(updated);                    // save the new version
        return crow::response(200, toJson(updated));
    });

    // -------------------------------------------------------------------------
    // DELETE /api/personas/<id>
    // Deletes a persona. Used by the trash can icon.
    //
    //   204  deleted (no body is sent back)
    //   404  no persona with that id
    // -------------------------------------------------------------------------
    CROW_ROUTE(app, "/api/personas/<int>").methods("DELETE"_method)
    ([&store](int id) {
        if (!store.remove(id)) return jsonError(404, "Persona not found");
        return crow::response(204);
    });

    // -------------------------------------------------------------------------
    // 3. Start the server
    //
    // Use the PORT environment variable if it's set
    // (e.g.  PORT=9000 ./build-server/server), otherwise 18080.
    // -------------------------------------------------------------------------
    const char* portEnv = std::getenv("PORT");                 // nullptr if PORT isn't set
    const int port = portEnv ? std::atoi(portEnv) : 18080;     // atoi turns "9000" into 9000

    // multithreaded() lets Crow handle several requests at once (this is why
    // PersonaStore needs its mutex). run() starts listening and doesn't return
    // until the server is stopped (Ctrl+C).
    app.port(port).multithreaded().run();
}
