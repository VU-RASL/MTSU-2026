// =============================================================================
// supabase_client.h — a small helper for talking to Supabase
// =============================================================================
//
// Supabase exposes every table as a REST API at
//   <SUPABASE_URL>/rest/v1/<table>?<filters>
// This class sends one HTTP request there and returns the response body.
// Any store (learning topics, scenarios, ...) can use it instead of writing
// its own libcurl code.
//
// It reads SUPABASE_URL and SUPABASE_SECRET_KEY from the environment (the
// same variables the rest of the backend uses). The request logic is adapted
// from PersonaStore::request in persona_store.cpp.
//
// Errors (network failure, non-2xx status) are thrown as std::runtime_error.
// main.cpp's exception handler turns those into a 500 response.
// =============================================================================

#pragma once

#include <string>
#include "crow.h"

class SupabaseClient {
public:
    // Reads the environment variables. Throws if they're missing or the
    // URL isn't https.
    SupabaseClient();

    // Sends one request.
    //   method  "GET", "POST", "PATCH", or "DELETE"
    //   path    table plus query string, e.g. "learning_topics?id=eq.3"
    //   body    JSON text to send (empty for GET/DELETE)
    // Returns the response body. For POST/PATCH/DELETE, Supabase is asked to
    // send back the affected rows ("Prefer: return=representation").
    std::string request(const std::string& method,
                        const std::string& path,
                        const std::string& body = "") const;

    // Parses a response that should be a JSON array of rows.
    // Throws if it isn't.
    static crow::json::rvalue parseRows(const std::string& response);

private:
    std::string baseUrl_;
    std::string secretKey_;
};
