// wl 10/27/26

// all the includes
#include "auth.h"

#include <curl/curl.h>

#include <algorithm>
#include <cstdlib>
#include <limits>
#include <memory>
#include <string_view>

namespace {

// set bounds
constexpr size_t maxTokenBytes = 8192;
constexpr size_t maxResponseBytes = 1024 * 1024;

// is it a profile ID? 
// if not empty and less than 18 places and not beginning with 0
// and totally made up of 0-9, yes
bool isProfileId(const std::string& id) {
    return !id.empty() && id.size() <= 18 && id.front() != '0' &&
           std::all_of(id.begin(), id.end(), [](unsigned char c) {
               return c >= '0' && c <= '9';
           });
}

// is the UUID the correct format?
bool isUuid(const std::string& id) {
    if (id.size() != 36) return false;
    for (size_t i = 0; i < id.size(); ++i) {
        if (i == 8 || i == 13 || i == 18 || i == 23) {
            if (id[i] != '-') return false;
        } else if (!((id[i] >= '0' && id[i] <= '9') ||
                     (id[i] >= 'a' && id[i] <= 'f'))) {
            return false;
        }
    }
    return true;
}

// what role is a user? 
std::optional<Role> parseRole(const std::string& role) {
    if (role == "student") return Role::Student;
    if (role == "educator") return Role::Educator;
    if (role == "admin") return Role::Admin;
    return std::nullopt;
}

// get the bearer token from the request
// this checks its format; Supabase verifies whether it is actually valid later
std::optional<std::string> bearerToken(const crow::request& req) {
    // there must be exactly one Authorization header
    if (req.headers.count("Authorization") != 1) return std::nullopt;

    // reject headers that are empty, too short, or too large
    const std::string& header = req.get_header_value("Authorization");
    if (header.size() < 8 || header.size() > maxTokenBytes + 7) return std::nullopt;

    // the header must start with "Bearer"
    // capitalization does not matter
    constexpr std::string_view scheme = "bearer";
    for (size_t i = 0; i < scheme.size(); ++i) {
        unsigned char c = header[i];
        if (c >= 'A' && c <= 'Z') c += 'a' - 'A';
        if (c != scheme[i]) return std::nullopt;
    }

    // there must be a space between "Bearer" and the token
    if (header[6] != ' ') return std::nullopt;

    // everything after "Bearer " is the token
    std::string token = header.substr(7);
    size_t dots = 0;
    bool segmentEmpty = true;

    // Supabase access tokens are JWTs with three parts separated by dots
    // only letters, numbers, hyphens, and underscores are allowed inside each part
    for (unsigned char c : token) {
        if (c == '.') {
            if (segmentEmpty) return std::nullopt;
            ++dots;
            segmentEmpty = true;
        } else {
            if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                  (c >= '0' && c <= '9') || c == '-' || c == '_')) {
                return std::nullopt;
            }
            segmentEmpty = false;
        }
    }

    // three nonempty parts means exactly two dots and a nonempty final part
    if (dots != 2 || segmentEmpty) return std::nullopt;
    return token;
}

// curl calls this whenever part of the response arrives
// append it to the response body without letting it grow beyond our limit
size_t receiveBody(char* data, size_t size, size_t count, void* output) noexcept {
    // make sure multiplying size and count will not overflow
    if (size != 0 && count > std::numeric_limits<size_t>::max() / size) return 0;

    const size_t bytes = size * count;
    auto& body = *static_cast<std::string*>(output);

    // returning 0 tells curl to stop if this chunk would exceed the limit
    if (bytes > maxResponseBytes - body.size()) return 0;

    try {
        body.append(data, bytes);
        return bytes;
    } catch (...) {
        // do not let a C++ exception escape through curl's callback
        return 0;
    }
}

// get a required setting from the environment
std::string requiredSetting(const char* name) {
    const char* value = std::getenv(name);

    // stop if the setting is missing or empty
    if (!value || !*value) {
        throw AuthUnavailable(std::string("Missing authentication setting: ") + name);
    }

    // reject spaces, line breaks, and other unexpected characters
    // these settings will be used in URLs or HTTP headers
    std::string result = value;
    if (!std::all_of(result.begin(), result.end(), [](unsigned char c) {
            return c >= 33 && c <= 126;
        })) {
        throw AuthUnavailable("Invalid authentication configuration");
    }

    return result;
}

// keep the HTTP status code and response text together
struct HttpResponse {
    long status = 0;
    std::string body;
};

// handles the Supabase requests needed to identify users and load their profiles
class AuthClient {
public:
    // read the project URL and keys when the client is created
    AuthClient()
        : baseUrl_(requiredSetting("SUPABASE_URL")),
          publishableKey_(requiredSetting("SUPABASE_PUBLISHABLE_KEY")),
          secretKey_(requiredSetting("SUPABASE_SECRET_KEY")) {
        // allow the configured URL to end with a slash
        while (!baseUrl_.empty() && baseUrl_.back() == '/') baseUrl_.pop_back();

        // require HTTPS and a project origin without a path, query, or credentials
        if (baseUrl_.rfind("https://", 0) != 0 || baseUrl_.size() <= 8 ||
            baseUrl_.find_first_of("/?#@", 8) != std::string::npos) {
            throw AuthUnavailable("SUPABASE_URL must be an HTTPS project origin");
        }
    }

    // ask Supabase Auth whether this token belongs to a valid user
    // return that user's UUID if it does
    std::optional<std::string> verify(const std::string& token) const {
        const auto response = request("/auth/v1/user", "GET", publishableKey_, token);

        // Supabase rejected the credentials
        if (response.status == 401 || response.status == 403) return std::nullopt;

        // other failures are service problems, not a successful login
        if (response.status != 200) throw AuthUnavailable("Authentication service unavailable");

        // make sure the response contains the fields and types we expect
        auto user = crow::json::load(response.body);
        if (!user || user.t() != crow::json::type::Object ||
            !user.has("id") || user["id"].t() != crow::json::type::String ||
            !user.has("is_anonymous") ||
            (user["is_anonymous"].t() != crow::json::type::True &&
             user["is_anonymous"].t() != crow::json::type::False)) {
            throw AuthUnavailable("Invalid authentication service response");
        }

        // require a regular account instead of an anonymous Supabase account
        if (user["is_anonymous"].b()) return std::nullopt;

        // check the returned UUID before using it in a database query
        const std::string id = user["id"].s();
        if (!isUuid(id)) throw AuthUnavailable("Invalid authentication user ID");

        return id;
    }

    // read database rows using the backend's secret key
    crow::json::rvalue rows(const std::string& path) const {
        const auto response = request("/rest/v1/" + path, "GET", secretKey_);
        if (response.status != 200) throw AuthUnavailable("Profile lookup unavailable");

        // database queries should return a JSON array, even when it is empty
        auto result = crow::json::load(response.body);
        if (!result || result.t() != crow::json::type::List) {
            throw AuthUnavailable("Invalid profile service response");
        }

        return result;
    }

    // create a profile for a verified account that does not have one yet
    void provision(const std::string& authId) const {
        crow::json::wvalue body;
        body["auth_user_id"] = authId;

        // new profiles always start as students
        // the request cannot choose educator or admin
        body["role"] = "student";

        // auth_user_id is unique
        // request() adds a header that ignores a duplicate instead of overwriting it
        const auto response = request(
            "/rest/v1/profiles?on_conflict=auth_user_id",
            "POST", secretKey_, "", body.dump());

        if (response.status < 200 || response.status >= 300) {
            throw AuthUnavailable("Profile creation unavailable");
        }
    }

private:
    // send one HTTP request to the configured Supabase project
    HttpResponse request(const std::string& path, const char* method,
                         const std::string& key, const std::string& token = "",
                         const std::string& body = "") const {
        // automatically clean up curl when this function finishes or throws
        std::unique_ptr<CURL, decltype(&curl_easy_cleanup)> curl(
            curl_easy_init(), &curl_easy_cleanup);
        if (!curl) throw AuthUnavailable("Could not create authentication client");

        // automatically clean up the HTTP header list too
        std::unique_ptr<curl_slist, decltype(&curl_slist_free_all)> headers(
            nullptr, &curl_slist_free_all);

        // add a header and keep ownership of the updated list
        auto addHeader = [&headers](const std::string& value) {
            curl_slist* updated = curl_slist_append(headers.get(), value.c_str());
            if (!updated) throw AuthUnavailable("Could not create authentication headers");

            // release ownership without freeing the existing list
            // then take ownership of the updated list
            headers.release();
            headers.reset(updated);
        };

        // the API key identifies the application
        addHeader("apikey: " + key);
        addHeader("Accept: application/json");

        // the bearer token identifies the signed-in user
        if (!token.empty()) addHeader("Authorization: Bearer " + token);

        if (!body.empty()) {
            addHeader("Content-Type: application/json");

            // if another request already created this profile, leave it alone
            // we do not need the inserted row returned in this response
            addHeader("Prefer: resolution=ignore-duplicates,return=minimal");
        }

        // check that curl accepts each option instead of ignoring setup errors
        auto setOption = [&curl](CURLoption option, auto value) {
            if (curl_easy_setopt(curl.get(), option, value) != CURLE_OK) {
                throw AuthUnavailable("Could not configure authentication client");
            }
        };

        const std::string url = baseUrl_ + path;
        HttpResponse response;

        // tell curl where to send the request and where to put the response
        setOption(CURLOPT_URL, url.c_str());
        setOption(CURLOPT_CUSTOMREQUEST, method);
        setOption(CURLOPT_HTTPHEADER, headers.get());
        setOption(CURLOPT_WRITEFUNCTION, &receiveBody);
        setOption(CURLOPT_WRITEDATA, &response.body);

        // allow 5 seconds to connect and 15 seconds for the entire request
        setOption(CURLOPT_CONNECTTIMEOUT, 5L);
        setOption(CURLOPT_TIMEOUT, 15L);

        // avoid curl's signal handling in the multithreaded server
        setOption(CURLOPT_NOSIGNAL, 1L);

        // do not follow redirects to another location with our credentials
        setOption(CURLOPT_FOLLOWLOCATION, 0L);

        // verify the server certificate and that it matches the requested hostname
        setOption(CURLOPT_SSL_VERIFYPEER, 1L);
        setOption(CURLOPT_SSL_VERIFYHOST, 2L);

        // attach the JSON body when this request has one
        if (!body.empty()) {
            setOption(CURLOPT_POSTFIELDS, body.c_str());
            setOption(CURLOPT_POSTFIELDSIZE_LARGE, static_cast<curl_off_t>(body.size()));
        }

        // perform the request and read its HTTP status code
        if (curl_easy_perform(curl.get()) != CURLE_OK ||
            curl_easy_getinfo(curl.get(), CURLINFO_RESPONSE_CODE, &response.status) != CURLE_OK) {
            // do not include tokens, keys, or response bodies in the error
            throw AuthUnavailable("Authentication dependency request failed");
        }

        return response;
    }

    // these values belong to the backend and are loaded from its environment
    std::string baseUrl_;
    std::string publishableKey_;
    std::string secretKey_;
};

// share one configured client
// each HTTP request still creates its own curl handle
const AuthClient& auth() {
    static const AuthClient client;
    return client;
}

// find the application profile linked to a verified authentication UUID
std::optional<CurrentUser> profileFor(const std::string& authId) {
    const auto rows = auth().rows(
        "profiles?auth_user_id=eq." + authId + "&select=profile_key,role&limit=2");

    // no profile yet; currentUser() can create one
    if (rows.size() == 0) return std::nullopt;

    // there should be exactly one profile with a text ID and a text role
    // asking for up to two rows lets us detect an unexpected duplicate
    if (rows.size() != 1 || rows[0].t() != crow::json::type::Object ||
        !rows[0].has("profile_key") || rows[0]["profile_key"].t() != crow::json::type::String ||
        !rows[0].has("role") || rows[0]["role"].t() != crow::json::type::String) {
        throw AuthUnavailable("Invalid profile mapping");
    }

    // profile_key is the numeric profile ID represented as text
    // the role comes from our database, not from the browser
    const std::string id = rows[0]["profile_key"].s();
    const auto role = parseRole(rows[0]["role"].s());
    if (!isProfileId(id) || !role) throw AuthUnavailable("Invalid profile identity");

    return CurrentUser{id, *role};
}

}

// initialize the shared client during server startup
// this checks configuration but does not make an HTTP request
void initializeAuth() {
    (void)auth();
}

// look up a profile's role by its application ID
// assignment routes use this to check whether an assigned user is a student
std::optional<Role> lookupRole(const std::string& profileId) {
    if (!isProfileId(profileId)) return std::nullopt;

    const auto rows = auth().rows(
        "profiles?id=eq." + profileId + "&select=role&limit=2");

    // no matching profile
    if (rows.size() == 0) return std::nullopt;

    // reject an unexpected response instead of guessing a role
    if (rows.size() != 1 || rows[0].t() != crow::json::type::Object ||
        !rows[0].has("role") || rows[0]["role"].t() != crow::json::type::String) {
        throw AuthUnavailable("Invalid profile role response");
    }

    const auto role = parseRole(rows[0]["role"].s());
    if (!role) throw AuthUnavailable("Invalid profile role");
    return role;
}

// identify the person making this request
std::optional<CurrentUser> currentUser(const crow::request& req) {
    // get a correctly formatted bearer token
    const auto token = bearerToken(req);
    if (!token) return std::nullopt;

    // have Supabase verify it and return the account's UUID
    const auto authId = auth().verify(*token);
    if (!authId) return std::nullopt;

    // find the profile connected to that account
    auto profile = profileFor(*authId);

    // on the first verified login, create a student profile
    if (!profile) {
        auth().provision(*authId);

        // read it again so we get the database-assigned ID and stored role
        profile = profileFor(*authId);
        if (!profile) throw AuthUnavailable("Profile provisioning incomplete");
    }

    // routes receive the application profile ID and its database role
    return profile;
}