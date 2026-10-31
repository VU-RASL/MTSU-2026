// =============================================================================
// educator_routes.h — the Educator Portal API
// =============================================================================
//
// Kept out of main.cpp so main.cpp only needs one call:
//   registerEducatorRoutes(app, assignments, results);
//
// Routes (details in educator_routes.cpp and docs/educator-portal.md):
//   GET    /api/assignments                  list (filters: studentId, status, scenarioId)
//   POST   /api/assignments                  assign a scenario to a student
//   GET    /api/assignments/<id>             one assignment
//   PUT    /api/assignments/<id>             change status
//   DELETE /api/assignments/<id>             unassign
//   GET    /api/assignments/<id>/results     every attempt for an assignment
//   POST   /api/assignments/<id>/results     save an attempt (transcript + auto score)
//   GET    /api/results/<id>                 one attempt
//   PUT    /api/results/<id>/review          educator score + feedback
// =============================================================================

#pragma once

#include "crow.h"
#include "crow/middlewares/cors.h"

class AssignmentStore;
class PersonaStore;
class ScenarioStore;
class SessionResultStore;

using EducatorApp = crow::App<crow::CORSHandler>;

void registerEducatorRoutes(EducatorApp& app, AssignmentStore& assignments, 
							SessionResultStore& results, PersonaStore& personas,
							ScenarioStore& scenarios);