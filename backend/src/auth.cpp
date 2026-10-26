// =============================================================================
// auth.cpp — identify the caller and look up their role in profiles
// =============================================================================
//
// TODO (sign-in): replace how `id` is found in currentUser() with:
//   1. read the "Authorization: Bearer <token>" header
//   2. verify the token
//   3. get the profile id from it
// lookupRole() and everything else stay the same.
// =============================================================================

#include "auth.h"

#include <cctype>
#include <cstdlib>

#include "supabase_client.h"

namespace {

// One shared client, created the first time it's needed.
const SupabaseClient& db() {
    static const SupabaseClient client;
    return client;
}

// profiles.id is a bigint, so only accept digits (also keeps the URL safe).
bool isProfileId(const std::string& id) {
    if (id.empty() || id.size() > 18) return false;
    for (unsigned char c : id) {
        if (!std::isdigit(c)) return false;
    }
    return true;
}

}  // namespace

std::optional<Role> lookupRole(const std::string& profileId) {
    if (!isProfileId(profileId)) return std::nullopt;

    const auto rows = SupabaseClient::parseRows(
        db().request("GET", "profiles?id=eq." + profileId + "&select=role"));
    if (rows.size() == 0 || rows[0].t() != crow::json::type::Object || !rows[0].has("role") ||
        rows[0]["role"].t() != crow::json::type::String) {
        return std::nullopt;
    }

    const std::string role = rows[0]["role"].s();
    if (role == "student") return Role::Student;
    if (role == "educator") return Role::Educator;
    if (role == "admin") return Role::Admin;
    return std::nullopt;  // a role we don't know about -> no access
}

std::optional<CurrentUser> currentUser(const crow::request& req) {
    // Who: X-User-Id header, else DEV_USER_ID from the environment
    std::string id = req.get_header_value("X-User-Id");
    if (id.empty()) {
        if (const char* dev = std::getenv("DEV_USER_ID")) id = dev;
    }

    auto role = lookupRole(id);
    if (!role) return std::nullopt;  // missing or unknown id -> 401

    return CurrentUser{id, *role};
}
