#include "scenario_routes.h"

#include <optional>
#include <utility>
#include <vector>

#include "auth.h"

namespace {

crow::response jsonError(int status, const std::string& message) {
    crow::json::wvalue body;
    body["error"] = message;
    auto response = crow::response(status, body);
    if (status == 401) response.set_header("WWW-Authenticate", "Bearer");
    return response;
}

// scenario authoring uses the same shared educator catalog as personas
std::optional<crow::response> requireEducator(const crow::request& req) {
    const auto user = currentUser(req);
    if (!user) return jsonError(401, "Login required");
    if (!isEducatorRole(user->role)) return jsonError(403, "Educators only");
    return std::nullopt;
}

}

void registerScenarioRoutes(EducatorApp& app, ScenarioStore& scenarios) {
    CROW_ROUTE(app, "/api/scenarios").methods("GET"_method)
    ([&scenarios](const crow::request& req) {
        if (auto error = requireEducator(req)) return std::move(*error);

        const char* search = req.url_params.get("search");
        std::vector<crow::json::wvalue> items;
        for (const auto& scenario : scenarios.list(search ? search : "")) {
            items.push_back(toJson(scenario));
        }
        return crow::response(200, crow::json::wvalue(std::move(items)));
    });

    CROW_ROUTE(app, "/api/scenarios").methods("POST"_method)
    ([&scenarios](const crow::request& req) {
        if (auto error = requireEducator(req)) return std::move(*error);

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        Scenario scenario;
        std::string error;
        if (!applyJson(body, scenario, error)) return jsonError(400, error);
        return crow::response(201, toJson(scenarios.create(scenario)));
    });

    CROW_ROUTE(app, "/api/scenarios/<int>").methods("GET"_method)
    ([&scenarios](const crow::request& req, int id) {
        if (auto error = requireEducator(req)) return std::move(*error);
        if (id <= 0) return jsonError(400, "Scenario ID must be positive");

        const auto scenario = scenarios.get(id);
        if (!scenario) return jsonError(404, "Scenario not found");
        return crow::response(200, toJson(*scenario));
    });

    CROW_ROUTE(app, "/api/scenarios/<int>").methods("PUT"_method)
    ([&scenarios](const crow::request& req, int id) {
        if (auto error = requireEducator(req)) return std::move(*error);
        if (id <= 0) return jsonError(400, "Scenario ID must be positive");

        auto scenario = scenarios.get(id);
        if (!scenario) return jsonError(404, "Scenario not found");

        const auto body = crow::json::load(req.body);
        if (!body) return jsonError(400, "Invalid JSON");

        std::string error;
        if (!applyJson(body, *scenario, error)) return jsonError(400, error);
        if (!scenarios.update(*scenario)) return jsonError(404, "Scenario not found");
        return crow::response(200, toJson(*scenario));
    });

    CROW_ROUTE(app, "/api/scenarios/<int>").methods("DELETE"_method)
    ([&scenarios](const crow::request& req, int id) {
        if (auto error = requireEducator(req)) return std::move(*error);
        if (id <= 0) return jsonError(400, "Scenario ID must be positive");

        if (!scenarios.remove(id)) return jsonError(404, "Scenario not found");
        return crow::response(204);
    });
}