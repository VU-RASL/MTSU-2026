// =============================================================================
// class_routes.h — classes, modules, and the student picker (issue #73)
// =============================================================================
//
// Tables and SQL functions: database/16_classes_modules.sql
//
// All routes are educators/admins only. Educators only see and change their
// own classes and modules; admins can see and change all of them.
//
//   GET    /api/students                        real student accounts
//                                               [{id, email, name}]
//   GET    /api/modules                         [{id, name, scenarioId, personaId, createdAt}]
//   POST   /api/modules                         {name, scenarioId, personaId}
//   DELETE /api/modules/<id>                    -> {removed, kept}
//
//   GET    /api/classes                         [{id, courseCode, section,
//                                                 studentIds, moduleIds, createdAt}]
//   POST   /api/classes                         {courseCode, section?, studentIds?}
//   DELETE /api/classes/<id>                    -> {removed, kept}
//   POST   /api/classes/<id>/students           {studentId} -> {created}
//   DELETE /api/classes/<id>/students/<sid>     -> {removed, kept}
//   POST   /api/classes/<id>/modules            {moduleId}  -> {created}
//   DELETE /api/classes/<id>/modules/<mid>      -> {removed, kept}
//
// Giving a module to a class creates one assignment per student ("created").
// A student added later automatically gets the class's existing modules.
// Removing/deleting only deletes assignments nobody has started ("removed");
// started ones are kept with their practice history ("kept").
// =============================================================================

#pragma once

#include "educator_routes.h"

void registerClassRoutes(EducatorApp& app);
