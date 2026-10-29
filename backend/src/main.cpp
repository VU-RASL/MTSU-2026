// TODO: pick up with guards in handlers

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
#include <curl/curl.h>
#include <iostream>
#include <stdexcept>

#include "auth.h"					  // authorization framework
#include "crow.h"                     // the Crow web framework
#include "crow/middlewares/cors.h"    // CORS support (explained in main below)
#include "persona.h"                  // Persona, toJson(), applyJson()
#include "persona_store.h"            // PersonaStore
#include "scenario.h"
#include "scenario_store.h"           // ScenarioStore
#include "learning_topic.h"           // LearningTopic, toJson(), applyJson()
#include "learning_topic_store.h"     // LearningTopicStore
#include "assignment_store.h"         // AssignmentStore (Educator Portal)
#include "session_result_store.h"     // SessionResultStore (Educator Portal)
#include "educator_routes.h"          // registerEducatorRoutes()

// Helpers private to this file.
namespace {

size_t receiveBody(char* data, size_t size, size_t count, void* output) {
    const size_t bytes = size * count;
    static_cast<std::string*>(output)->append(data, bytes);
    return bytes;
}

void checkSupabase() {
    const char* baseUrl = std::getenv("SUPABASE_URL");
    const char* secretKey = std::getenv("SUPABASE_SECRET_KEY");

    if (!baseUrl || !*baseUrl || !secretKey || !*secretKey) {
        throw std::runtime_error("Missing Supabase environment variables");
    }

    CURL* curl = curl_easy_init();
    if (!curl) {
        throw std::runtime_error("Could not initialize HTTP client");
    }

    std::string url = std::string(baseUrl) + "/rest/v1/personas?select=id&limit=1";
    std::string keyHeader = std::string("apikey: ") + secretKey;
    std::string body;


    curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, keyHeader.c_str());
    headers = curl_slist_append(headers, "Accept: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, receiveBody);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &body);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 15L);

    const CURLcode result = curl_easy_perform(curl);

    long status = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &status);

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (result != CURLE_OK) {
        throw std::runtime_error(curl_easy_strerror(result));
    }

    if (status != 200) {
        throw std::runtime_error("Supabase connection check returned HTTP " + std::to_string(status));
    }

    std::cout << "Supabase connection successful\n";
}

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

std::optional<crow::response> requireIdentity(const crow::request& req, bool educatorOnly) {
    const auto user = currentUser(req);
    if (!user) {
        auto response = jsonError(401, "Login required");
        response.set_header("WWW-Authenticate", "Bearer");
        return response;
    }
    if (educatorOnly && !isEducatorRole(user->role)) {
        return jsonError(403, "Educators only");
    }
    return std::nullopt;
}

}  // namespace

int main() {

    if (curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) {
        std::cerr << "Could not initialize libcurl\n";
        return 1;
    }

    try {
        initializeAuth();
        checkSupabase();
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        curl_global_cleanup();
        return 1;
    }
    
    // CORSHandler lets the React dev server (a different port = a different
    // "origin") call this API. Without it the browser blocks the requests.
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

    app.exception_handler([](crow::response& response) {
        try {
            throw;
        } catch (const AuthUnavailable&) {
            response = jsonError(503, "Authentication service unavailable. Please try again.");
            return;
        } catch (const std::exception& error) {
            std::cerr << "Request failed: " << error.what() << '\n';
        } catch (...) {
            std::cerr << "Request failed: unknown error\n";
        }

        response = jsonError(500, "Unable to complete the request. Please try again.");
    });

    // Grab the CORS add-on so we can configure it.
    auto& cors = app.get_middleware<crow::CORSHandler>();
    cors.global()                              // these rules apply to every route
        .origin("http://localhost:5173")       // allow Vite's default React dev port
        .methods("GET"_method, "POST"_method, "PUT"_method, "DELETE"_method)  // allowed methods
        .headers("Content-Type, Authorization");  // React may send this header (needed for JSON bodies)

    // -------------------------------------------------------------------------
    // 2. Create the store and add the sample persona
    // -------------------------------------------------------------------------
    PersonaStore store;
    ScenarioStore scenarios;  // the Scenario page's scenarios (Supabase table: scenarios)
    LearningTopicStore topics;  // the Learning page's topics (Supabase table: learning_topics)
    AssignmentStore assignments;     // Educator Portal (Supabase table: assignments)
    SessionResultStore results;      // Educator Portal (Supabase table: session_results)

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
    
    	if (auto error = requireIdentity(req, true)) return std::move(*error);
    	
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
    
    	if (auto error = requireIdentity(req, true)) return std::move(*error);

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
    ([&store](const crow::request& req, int id) { // id comes from the <int> in the URL
    
    	if (auto error = requireIdentity(req, true)) return std::move(*error);

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
    
    	if (auto error = requireIdentity(req, true)) return std::move(*error);

        auto existing = store.get(id);            // the current version
        if (!existing) return jsonError(404, "Persona not found");

        auto body = crow::json::load(req.body);   // parse the request JSON
        if (!body) return jsonError(400, "Invalid JSON");

        Persona updated = *existing;              // start from a copy, so id and createdAt carry over
        std::string error;
        if (!applyJson(body, updated, error)) return jsonError(400, error);  // apply only the sent fields

        if (!store.update(updated)) {
            return jsonError(404, "Persona not found");
        }

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
    ([&store](const crow::request& req, int id) {
        
        if (auto error = requireIdentity(req, true)) return std::move(*error);

        if (!store.remove(id)) return jsonError(404, "Persona not found");
        return crow::response(204);
    });

    // =========================================================================
    // Learning topics (the Learning page)
    // Same pattern as the persona routes above.
    // =========================================================================

    // GET /api/learning-topics  -> all topics, in page order
    CROW_ROUTE(app, "/api/learning-topics").methods("GET"_method)
    ([&topics](const crow::request& req) {
    
    	if (auto error = requireIdentity(req, false)) return std::move(*error);
        
        std::vector<crow::json::wvalue> items;
        for (const auto& t : topics.list()) {
            items.push_back(toJson(t));
        }
        return crow::response(200, crow::json::wvalue(std::move(items)));
    });

    // POST /api/learning-topics  -> create (title required)
    //   201  the new topic, with id and createdAt
    //   400  bad JSON, wrong type, or no title
    CROW_ROUTE(app, "/api/learning-topics").methods("POST"_method)
    ([&topics](const crow::request& req) {
    
    	if (auto error = requireIdentity(req, true)) return std::move(*error);
        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        LearningTopic t;
        std::string error;
        if (!applyJson(body, t, error)) return jsonError(400, error);

        return crow::response(201, toJson(topics.create(t)));
    });

    // GET /api/learning-topics/<id>  -> one topic
    CROW_ROUTE(app, "/api/learning-topics/<int>").methods("GET"_method)
    ([&topics](const crow::request& req, int id) {
    
    	if (auto error = requireIdentity(req, false)) return std::move(*error);
        auto t = topics.get(id);
        if (!t) return jsonError(404, "Learning topic not found");
        return crow::response(200, toJson(*t));
    });

    // PUT /api/learning-topics/<id>  -> update; only the fields sent change
    CROW_ROUTE(app, "/api/learning-topics/<int>").methods("PUT"_method)
    ([&topics](const crow::request& req, int id) {
    
    	if (auto error = requireIdentity(req, true)) return std::move(*error);
        auto existing = topics.get(id);
        if (!existing) return jsonError(404, "Learning topic not found");

        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        LearningTopic updated = *existing;  // keeps id and createdAt
        std::string error;
        if (!applyJson(body, updated, error)) return jsonError(400, error);

        if (!topics.update(updated)) return jsonError(404, "Learning topic not found");
        return crow::response(200, toJson(updated));
    });

    // DELETE /api/learning-topics/<id>  -> 204 on success, no body
    CROW_ROUTE(app, "/api/learning-topics/<int>").methods("DELETE"_method)
    ([&topics](const crow::request& req, int id) {
    
    	if (auto error = requireIdentity(req, true)) return std::move(*error);
        if (!topics.remove(id)) return jsonError(404, "Learning topic not found");
        return crow::response(204);
    });

	CROW_ROUTE(app, "/api/auth/me").methods("GET"_method)
    ([](const crow::request& req) {
        const auto user = currentUser(req);
        if (!user) {
            auto response = jsonError(401, "Login required");
            response.set_header("WWW-Authenticate", "Bearer");
            return response;
        }

        crow::json::wvalue body;
        body["id"] = user->id;
        body["role"] = user->role == Role::Student ? "student" :
                       user->role == Role::Educator ? "educator" : "admin";

        auto response = crow::response(200, body);
        response.set_header("Cache-Control", "no-store");
        return response;
    });
<<<<<<< HEAD
	
=======

    // =========================================================================
    // Scenarios
    // These routes allow educators to create, view, update, and delete scenarios.
    // =========================================================================

    // GET /api/scenarios -> list all scenarios, optionally searching by title
    CROW_ROUTE(app, "/api/scenarios").methods("GET"_method)
    ([&scenarios](const crow::request& req) {
        const char* search = req.url_params.get("search");

        std::vector<crow::json::wvalue> items;

        for (const auto& scenario : scenarios.list(search ? search : "")) {
            items.push_back(toJson(scenario));
        }

        return crow::response(200, crow::json::wvalue(std::move(items)));
    });

    // POST /api/scenarios -> create a new scenario
    CROW_ROUTE(app, "/api/scenarios").methods("POST"_method)
    ([&scenarios](const crow::request& req) {
        auto body = crow::json::load(req.body);

        if (!body) {
            return jsonError(400, "Invalid JSON");
        }

        Scenario scenario;
        std::string error;

        if (!applyJson(body, scenario, error)) {
            return jsonError(400, error);
        }

        return crow::response(201, toJson(scenarios.create(scenario)));
    });

    // GET /api/scenarios/<id> -> retrieve one scenario
    CROW_ROUTE(app, "/api/scenarios/<int>").methods("GET"_method)
    ([&scenarios](int id) {
        auto scenario = scenarios.get(id);

        if (!scenario) {
            return jsonError(404, "Scenario not found");
        }

        return crow::response(200, toJson(*scenario));
    });

    // PUT /api/scenarios/<id> -> update an existing scenario
    CROW_ROUTE(app, "/api/scenarios/<int>").methods("PUT"_method)
    ([&scenarios](const crow::request& req, int id) {
        auto existing = scenarios.get(id);

        if (!existing) {
            return jsonError(404, "Scenario not found");
        }

        auto body = crow::json::load(req.body);

        if (!body) {
            return jsonError(400, "Invalid JSON");
        }

        Scenario updated = *existing;
        std::string error;

        if (!applyJson(body, updated, error)) {
            return jsonError(400, error);
        }

        if (!scenarios.update(updated)) {
            return jsonError(404, "Scenario not found");
        }

        return crow::response(200, toJson(updated));
    });

    // DELETE /api/scenarios/<id> -> delete a scenario
    CROW_ROUTE(app, "/api/scenarios/<int>").methods("DELETE"_method)
    ([&scenarios](int id) {
        if (!scenarios.remove(id)) {
            return jsonError(404, "Scenario not found");
        }

        return crow::response(204);
    });

>>>>>>> d744353 (Update scenario backend and Supabase integration)
    // Educator Portal: assignments and session results (see educator_routes.cpp)
    registerEducatorRoutes(app, assignments, results);

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

    curl_global_cleanup();
}