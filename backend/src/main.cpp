#include <cstdlib>
#include <string>
#include <vector>

#include "crow.h"
#include "crow/middlewares/cors.h"
#include "persona.h"
#include "persona_store.h"

namespace {

crow::response jsonError(int status, const std::string& message) {
    crow::json::wvalue body;
    body["error"] = message;
    return crow::response(status, body);
}

void seed(PersonaStore& store) {
    Persona p;
    p.title = "Pediatric MMR Vaccination and Anaphylaxis Response";
    p.summary = "A grandmother who is hesitant about vaccinating her 5 year old grandson.";
    p.color = "#F4C542";
    p.name = "Gloria Nellie No Braids";
    p.age = "39";
    p.ethnicity = "Navajo";
    p.sex = "Female";
    p.gender = "Female";
    p.affect = "Hesitant, nervous, and questioning";
    p.speech = "typical";
    p.chiefComplaint = "child coming for MMR vaccine for upcoming school year";
    p.goals = {"achieve vaccinations"};
    p.challenges = {"unfamiliarity and distrust with western medicine"};
    p.thoughtsAndFeelings = {"hesitant", "questions"};
    p.tasksAndActivities = {"administration of MMR vaccine"};
    p.socialDeterminantsOfHealth = {"Lives with grandmother", "no food or housing insecurities"};
    store.create(p);
}

}  // namespace

int main() {
    // CORSHandler lets the React dev server (a different port = a different
    // "origin") call this API. Without it the browser blocks the requests.
    crow::App<crow::CORSHandler> app;

    auto& cors = app.get_middleware<crow::CORSHandler>();
    cors.global()
        .origin("http://localhost:5173")   // Vite's default React dev port
        .methods("GET"_method, "POST"_method, "PUT"_method, "DELETE"_method)
        .headers("Content-Type");

    PersonaStore store;
    seed(store);

    // Quick "is the server up?" check.
    CROW_ROUTE(app, "/api/health")([] {
        crow::json::wvalue body;
        body["status"] = "ok";
        return body;
    });

    // GET /api/personas?search=mmr  -> list (the left "All Personas" column)
    CROW_ROUTE(app, "/api/personas").methods("GET"_method)
    ([&store](const crow::request& req) {
        const char* search = req.url_params.get("search");
        std::vector<crow::json::wvalue> items;
        for (const auto& p : store.list(search ? search : "")) {
            items.push_back(toJson(p));
        }
        return crow::response(200, crow::json::wvalue(std::move(items)));
    });

    // POST /api/personas  -> "New Persona"
    CROW_ROUTE(app, "/api/personas").methods("POST"_method)
    ([&store](const crow::request& req) {
        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        Persona p;
        std::string error;
        if (!applyJson(body, p, error)) return jsonError(400, error);

        return crow::response(201, toJson(store.create(p)));
    });

    // GET /api/personas/3  -> open one in the "Edit Persona" panel
    CROW_ROUTE(app, "/api/personas/<int>").methods("GET"_method)
    ([&store](int id) {
        auto p = store.get(id);
        if (!p) return jsonError(404, "Persona not found");
        return crow::response(200, toJson(*p));
    });

    // PUT /api/personas/3  -> save edits. Only the fields you send change.
    CROW_ROUTE(app, "/api/personas/<int>").methods("PUT"_method)
    ([&store](const crow::request& req, int id) {
        auto existing = store.get(id);
        if (!existing) return jsonError(404, "Persona not found");

        auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        Persona updated = *existing;   // id and createdAt carry over
        std::string error;
        if (!applyJson(body, updated, error)) return jsonError(400, error);

        store.update(updated);
        return crow::response(200, toJson(updated));
    });

    // DELETE /api/personas/3  -> the trash can icon
    CROW_ROUTE(app, "/api/personas/<int>").methods("DELETE"_method)
    ([&store](int id) {
        if (!store.remove(id)) return jsonError(404, "Persona not found");
        return crow::response(204);
    });

    const char* portEnv = std::getenv("PORT");
    const int port = portEnv ? std::atoi(portEnv) : 18080;

    app.port(port).multithreaded().run();
}
