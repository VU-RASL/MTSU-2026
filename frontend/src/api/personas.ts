// =============================================================================
// personas.ts — how the React app talks to the backend
// =============================================================================
//
// One function per backend route:
//
//   listPersonas()            GET     /api/personas        get every persona
//   getPersona(id)            GET     /api/personas/<id>   get one persona
//   createPersona(persona)    POST    /api/personas        save a new persona
//   updatePersona(id, ...)    PUT     /api/personas/<id>   change an existing one
//   deletePersona(id)         DELETE  /api/personas/<id>   remove one
//
// Pages import these instead of calling fetch themselves, so if a URL ever
// changes, it only changes here.
//
// HOW EVERY FUNCTION WORKS
//   1. fetch()          send the request and wait for the server to answer
//   2. response.ok      check it worked; if not, throw an error and stop
//   3. response.json()  read the data the server sent back (if any)
//
// URLs start with "/api", and the Vite proxy forwards them to the C++ server
// (port 18080), so no "localhost" or port number is needed here.
//
// `export` lets other files import a function.
// `async` / `await` let a function wait on the network without freezing the
// page. Callers must `await` these functions too.
//
// If anything fails, these functions throw an Error. The page calling them
// decides what to show the user.
// =============================================================================

// -----------------------------------------------------------------------------
// listPersonas
// Gets every persona.
// Returns: an array of persona objects (empty [] if there are none).
// -----------------------------------------------------------------------------
export async function listPersonas() {
  // GET is fetch's default, so no options are needed
  const response = await fetch("/api/personas");

  // fetch doesn't treat error codes (404, 500...) as failures on its own,
  // so we check: ok is true only for success codes (200-299)
  if (!response.ok) {
    throw new Error("Could not load Personas.");
  }

  // Turn the JSON text in the body into JavaScript data
  const data = await response.json();
  return data;
}

// -----------------------------------------------------------------------------
// getPersona
// Gets one persona by its id.
// Returns: that persona. Throws if no persona has that id (the server sends 404).
// -----------------------------------------------------------------------------
export async function getPersona(id: number) {
  // Backticks + ${} put the id into the URL: getPersona(3) -> "/api/personas/3"
  const response = await fetch(`/api/personas/${id}`);

  if (!response.ok) {
    throw new Error("Could not load requested Persona.");
  }

  const data = await response.json();
  return data;
}

// -----------------------------------------------------------------------------
// createPersona
// Saves a new persona.
//   persona  the data from the form, e.g. { title: "...", identity: { name: "..." } }
//            (don't include an id; the server assigns one)
// Returns: the saved persona, including its new id and createdAt date.
// -----------------------------------------------------------------------------
export async function createPersona(persona: object) {
  const response = await fetch("/api/personas", {
    method: "POST",                        // POST = create something new
    headers: {
      "Content-Type": "application/json",  // tells the server the body is JSON
    },
    body: JSON.stringify(persona),         // turn the object into JSON text to send
  });

  if (!response.ok) {
    throw new Error("Could not create Persona.");
  }

  const data = await response.json();
  return data;
}

// -----------------------------------------------------------------------------
// updatePersona
// Changes an existing persona.
//   id       which persona to change
//   persona  only the fields that changed, e.g. { summary: "new text" }
//            (fields you leave out keep their current values)
// Returns: the full updated persona.
// -----------------------------------------------------------------------------
export async function updatePersona(id: number, persona: object) {
  const response = await fetch(`/api/personas/${id}`, {
    method: "PUT",                         // PUT = change something that already exists
    headers: {
      "Content-Type": "application/json",  // tells the server the body is JSON
    },
    body: JSON.stringify(persona),         // the changes, as JSON text
  });

  if (!response.ok) {
    throw new Error("Could not update changes to Persona.");
  }

  const data = await response.json();
  return data;
}

// -----------------------------------------------------------------------------
// deletePersona
// Removes a persona.
//   id  which persona to delete
// Returns: nothing. The server answers 204 ("No Content"), so there's no body
// to read. Calling response.json() here would crash on the empty body.
// -----------------------------------------------------------------------------
export async function deletePersona(id: number) {
  // No headers or body needed: the id in the URL says everything
  const response = await fetch(`/api/personas/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Could not delete Persona.");
  }
}