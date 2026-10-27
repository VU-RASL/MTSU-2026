// =============================================================================
// auth.h — who is making this request?
// =============================================================================
//
// Users live in Will's Supabase table:
//   profiles (id bigint, name, email, role: student | educator | admin, created_at)
//
// Every route that cares about users calls currentUser(req) and checks the
// role. The role always comes from the profiles table, never from the request.
//
// HOW THE CALLER IS IDENTIFIED (temporary, until real sign-in exists):
//   X-User-Id: <profiles.id>     header sent by the frontend
//   DEV_USER_ID=<profiles.id>    env var used when the header is missing,
//                                so the current frontend keeps working
// An id that isn't in profiles -> not logged in (401).
//
// This is NOT secure yet: anyone can send someone else's id. When sign-in
// lands, only currentUser() in auth.cpp changes (verify a login token and
// get the profile id from it). The routes stay exactly the same.
// =============================================================================

#pragma once

#include <optional>
#include <string>

#include "crow.h"

enum class Role { Student, Educator, Admin };

struct CurrentUser {
    std::string id;   // profiles.id as text, e.g. "3"
    Role role;
};

// The user making this request, or std::nullopt if not logged in
// (routes answer 401 in that case).
std::optional<CurrentUser> currentUser(const crow::request& req);

// The role of a profile, or std::nullopt if no profile has that id.
// Used to check that a studentId really is a student.
std::optional<Role> lookupRole(const std::string& profileId);

// Educators and admins can use the educator side of the portal.
inline bool isEducatorRole(Role role) { return role == Role::Educator || role == Role::Admin; }
