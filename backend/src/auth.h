// wl 10/27/26

#pragma once

// includes
#include <optional>
#include <stdexcept>
#include <string>

#include "crow.h"

// carryover of the enumerated class made in supabase
enum class Role { Student, Educator, Admin };

// every user gets an ID and a role. Other stuff too but for here, this is it
struct CurrentUser {
    std::string id;
    Role role;
};

// if you can't auth, you can't get in
class AuthUnavailable : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

// it's as it sounds
void initializeAuth();

// from the crow request, ID the current user
std::optional<CurrentUser> currentUser(const crow::request& req);

// as it sounds
std::optional<Role> lookupRole(const std::string& profileId);

// 
inline bool isEducatorRole(Role role) { return role == Role::Educator || role == Role::Admin; }