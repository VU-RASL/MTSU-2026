# Docker development guide

Use Docker to run the frontend and backend together while editing source files
with your usual editor. Docker supplies Node.js, npm, the C++ compiler, CMake,
and Asio, so you do not need to install those tools on your computer.

All commands below run from the repository root, where `compose.yaml` lives.

## Basic concepts

| Term | Meaning in this project |
| --- | --- |
| Host | Your computer, where your editor, browser, and repository live. |
| Image | A template containing Linux files and tools used to create a container. |
| Dockerfile | Instructions for building an image. Each service has its own. |
| Container | An isolated environment running a process, such as Vite or the C++ server. |
| Compose | A tool that builds and runs the services described in `compose.yaml`. |
| Service | A named application in Compose: `frontend` or `backend`. |
| Bind mount | A host folder made available inside a container, so edits are visible immediately. |
| Named volume | A directory managed by Docker that survives container removal. |
| Port mapping | A connection from a port on your computer to a port inside a container. |

Docker provides the runtime; Compose coordinates the two services. For more on
isolation, see Docker's [container introduction](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/).

## First start

Install [Docker Desktop](https://docs.docker.com/get-started/get-docker/), or Docker
Engine with the Compose plugin on Linux. Start Docker and check:

```sh
docker --version
docker compose version
```

Then start both services:

```sh
docker compose up --build
```

The first run downloads base images and installs backend tools. The backend
container configures and compiles the C++ server, then starts it on port 18080.
Compose waits for a successful backend health check before starting the frontend.
The frontend installs dependencies from `package-lock.json`, then starts Vite on
port 5173. Wait for Vite's ready message and open **http://localhost:5173**.

Keep this terminal open for logs. Use a second terminal for restart commands and
API checks. The startup wait uses Compose's
[health-based dependency ordering](https://docs.docker.com/compose/how-tos/startup-order/).

## Daily workflow

Edit source files on your computer and save them normally. The source folders
are mounted into the containers at `/app`, so you do not copy files manually.

| What changed? | What to do |
| --- | --- |
| Frontend React, TypeScript, or CSS | Save the file; Vite automatically updates the browser. |
| Backend C++ or CMake files | Run `docker compose restart backend`; it rebuilds and runs the server. |
| Frontend dependencies and lockfile | Run `docker compose restart frontend`; startup runs `npm ci` again. |
| A Dockerfile or its base image/tools | Run `docker compose up --build` to rebuild and apply it. |
| Compose settings, such as environment variables or port mappings | Run `docker compose up -d` to apply the configuration. |

Here, restarting the backend compiles code because its Dockerfile's startup
command explicitly runs CMake. Restarting a container normally just reruns its
startup command; it does not rebuild its Docker image. Compose configuration
changes also require `up`, rather than `restart`, as explained in the
[restart reference](https://docs.docker.com/reference/cli/docker/compose/restart/).

Stop both services with **Ctrl+C** in the `up` terminal. To remove the stopped
containers and their network:

```sh
docker compose down
```

Your source files and the two named volumes remain. Start the next session with
`docker compose up`; add `--build` when image changes need rebuilding.

If you prefer running in the background:

```sh
docker compose up --build -d
docker compose logs --follow
```

With background services, Ctrl+C ends log viewing only. Stop the services with
`docker compose down`.

## Environment variables and custom settings

The `x-environment` section at the top of `compose.yaml` collects the supported
settings in one place:

| Variable | Default | What it changes |
| --- | --- | --- |
| `FRONTEND_PORT` | `5173` | The port you open in your browser on your computer. |
| `BACKEND_PORT` | `18080` | The port for direct API requests from your computer. |
| `API_PROXY_TARGET` | `http://backend:18080` | The address Vite uses to reach the API from inside its container. |

For a shared default change, edit the value after `:-` in that section. For
example, `${FRONTEND_PORT:-5173}` uses 5173 unless an override is set. The YAML
`&frontend-port` gives that setting a name; `*frontend-port` reuses it in the
service configuration. The `x-` prefix lets Compose accept this extra settings
section. Only values referenced by a service are applied; the section does not
automatically export every variable into both containers.

For your own settings, create a file named `.env` beside `compose.yaml`:

```dotenv
FRONTEND_PORT=5174
BACKEND_PORT=18081
```

The root `.env` is ignored by Git. Compose reads it automatically when run from
the repository root. These overrides let you use different host ports without
editing the shared Compose file. Leave `API_PROXY_TARGET` at its default when
using the included backend service; change it only to intentionally use another
API reachable from the frontend container.

Apply your settings and inspect the resolved configuration:

```sh
docker compose config
docker compose up -d
```

Use `up --build -d` instead if you also changed a Dockerfile. `restart` does not
apply changed Compose environment variables or port mappings. With the example
above, open **http://localhost:5174**, test the API directly at
`http://localhost:18081/api/health`, or test the proxy at
`http://localhost:5174/api/health`.

The internal ports remain **5173 for Vite** and **18080 for the backend**. Changing
`BACKEND_PORT` does not require changing `API_PROXY_TARGET`, because traffic
between containers uses the internal port. Relative `fetch('/api/personas')`
calls also need no edits: the browser uses the port where you opened the app.
Examples elsewhere in this guide use the default host ports.

An exported shell variable overrides the corresponding `.env` value; `.env`
overrides the default in Compose. See Docker's
[variable interpolation guide](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
and [extension documentation](https://docs.docker.com/reference/compose-file/extension/)
for details.

## How requests reach the backend

Frontend code should use relative API URLs:

```ts
const response = await fetch('/api/personas')
const personas = await response.json()
```

The request follows this path:

```text
Browser on your computer
  -> http://localhost:5173/api/personas
  -> Vite in the frontend container
  -> http://backend:18080/api/personas
  -> C++ server in the backend container
```

Compose puts both containers on a shared network and resolves service names such
as `backend`. Its `API_PROXY_TARGET` setting tells Vite where to forward `/api`.
The browser uses localhost; only Vite uses the container service name. See
[Compose networking](https://docs.docker.com/compose/how-tos/networking/) for details.

For a step-by-step explanation, see the FAQ:
[How does a relative API URL reach the backend?](#how-does-a-relative-api-url-reach-the-backend)

The Vite config also defaults to `http://localhost:18080` when running without
Docker. This accommodates the proxy proposed in PR #10 without requiring that
PR's merge or its persona model changes. When combining changes later, keep the
configurable proxy target. The current sample UI still needs API calls added
where appropriate; a proxy alone does not connect its sample data to the backend.

## Practical verification

While both services are running, use another terminal:

```sh
# Validate Compose syntax and inspect running services.
docker compose config --quiet
docker compose ps

# Test the backend directly, then through Vite's proxy.
curl --fail http://localhost:18080/api/health
curl --fail http://localhost:5173/api/health

# List personas and create a test persona through the proxy.
curl --fail http://localhost:5173/api/personas
curl --fail -X POST http://localhost:5173/api/personas \
  -H 'Content-Type: application/json' \
  -d '{"title":"Docker test persona"}'
```

Both health requests should return `{"status":"ok"}`; whitespace may differ.
The persona list initially includes Gloria, and the create request should return
a new persona with an ID. On Windows PowerShell, use `curl.exe` if `curl` invokes
a PowerShell command; enter the POST command on one line instead of using `\`.

For frontend reload verification, change visible text in a component and check
the browser. For backend rebuild verification, change the health response in
`backend/src/main.cpp`, restart the backend, and repeat the health requests.
Restore those edits after checking.

## FAQ

### What is the intended workflow? Do I edit inside Docker?

Edit on your computer. Docker runs the tools and servers. Frontend edits reload
automatically; backend edits require `docker compose restart backend`. You do
not need to open a shell in a container for routine development. The backend
source mount is read-only. The frontend mount is writable so Docker can mount
its separate dependency volume at `/app/node_modules`; avoid running commands
that modify frontend source or package files unless those changes are intended.

### Where do compile errors appear when I restart the backend?

Compiler output goes to the backend container logs. If `docker compose up` is
still running in another terminal, the output appears there. The restart command
itself generally reports restart progress, not compiler diagnostics.

```sh
# Read recent output, including file names, line numbers, and errors.
docker compose logs --tail 100 backend

# Follow new compiler and server output live.
docker compose logs --follow backend

# Include stopped containers when checking status.
docker compose ps --all
```

If configuration or compilation fails, the startup command stops and the
container exits. The API is unavailable; it does not launch an older executable.
Fix the source and run `docker compose restart backend` again. A successful
restart command alone does not prove compilation succeeded; check the logs and
the health endpoint.

### What are the roles of the two named volumes?

| Volume | Container location | Contents and purpose |
| --- | --- | --- |
| `backend_build` | `/build` | CMake settings, object files, and the server executable. Keeps Linux builds separate from host builds and enables incremental compilation. |
| `frontend_node_modules` | `/app/node_modules` | Linux npm dependencies. Keeps them separate from any host `node_modules`, avoiding platform conflicts. |

These are different from the source bind mounts. They survive `restart` and
`docker compose down`. Frontend startup runs `npm ci`, which reinstalls the locked
dependencies in its volume each time. To clear both volumes:

```sh
docker compose down --volumes
docker compose up --build
```

This deletes generated dependencies and build files, **not your source code**.
Docker usually prefixes volume names with the Compose project name.

### Does a volume preserve personas across restarts?

No. Personas currently live in server memory, not in either volume. Backend
restarts reset them to the startup sample. This configuration does not include
Supabase; that integration is separate work.

### How does a relative API URL reach the backend?

1. The browser runs your frontend code. With the page loaded from
   `http://localhost:5173`, `fetch('/api/personas')` requests
   `http://localhost:5173/api/personas`. The leading `/` makes the path relative
   to the website's root, regardless of the current page's path.
2. Compose's frontend port mapping sends that request to Vite on port 5173
   inside the frontend container.
3. Vite's proxy rule matches `/api`. Compose sets `API_PROXY_TARGET` to
   `http://backend:18080`, so Vite forwards the request there, keeping the
   `/api/personas` path unchanged.
4. Docker resolves the service name `backend` on the shared container network.
   The C++ server receives the request on port 18080 and returns JSON through
   Vite to the browser. `response.json()` parses that JSON.

The proxy rule in `frontend/vite.config.ts` is:

```ts
proxy: {
  '/api': process.env.API_PROXY_TARGET || 'http://localhost:18080',
}
```

Compose supplies `API_PROXY_TARGET=http://backend:18080`. When that variable is
unset, Vite uses `http://localhost:18080` for development without Docker.

The browser communicates with `localhost:5173` throughout; only Vite uses the
Docker hostname `backend`. This internal connection does not use the backend's
published host port.

### Why not use localhost as the proxy target inside Docker?

Inside a container, localhost refers to that container. Vite would try to reach
port 18080 in the frontend container, where no API server is running. Using
`backend:18080` reaches the backend service on Compose's shared network.

### Why does the backend need a health check?

Its process starts by compiling, so a running container does not yet mean a
running API. The health check requests `/api/health`; Compose starts the frontend
after it succeeds. There is a two-minute initial grace period for compilation.
This controls initial startup; it does not stop the frontend or automatically
restart the backend if the backend later fails. During a backend restart, API
requests may temporarily fail until the server is ready again.

### What if a port is already in use?

Stop another local Vite or backend server using port 5173 or 18080, then start
Compose again, or override `FRONTEND_PORT` or `BACKEND_PORT` as described in
[Environment variables and custom settings](#environment-variables-and-custom-settings).
Both published ports are bound to `127.0.0.1`, so this setup is intended for
access from your own computer. Use relative API calls through Vite if you change
the frontend host port; the backend's direct-call CORS setting allows port 5173.

### What if frontend edits do not reload?

Check that Vite is running with `docker compose logs frontend`. On some Docker
Desktop or WSL setups, file events may not reach the container. Add
`watch: { usePolling: true }` under `server` in `frontend/vite.config.ts` and
restart frontend. Polling uses more CPU, so enable it only when needed.

### What if frontend dependency installation fails?

Read `docker compose logs frontend`. `npm ci` requires matching `package.json`
and `package-lock.json`; update and commit both when dependencies change. The
frontend will not start if installation fails. Internet access is needed for
image downloads, backend package installation during image builds, and npm
installation at frontend startup.

### Can I run builds and other commands inside the containers?

For a command that does not need to modify source, use a running service:

```sh
docker compose exec frontend npm run lint
```

The backend source directory is mounted read-only. The frontend source directory
is writable, so commands such as `npm run build` can write `dist/` and `npm
install` can edit package files on your computer. Run those only when the
resulting changes are intended. Changes to container files outside mounts
disappear when that container is removed.

### Is this ready for production hosting?

This is a development environment: it runs Vite's development server and keeps
compiler tools available for rebuilds. Deployment would need a separate setup
for built frontend assets, backend packaging, and persistent storage.

## Files to look at

- [compose.yaml](compose.yaml): services, networking, source mounts, caches, and startup ordering.
- [backend/Dockerfile](backend/Dockerfile): backend tools and its compile-and-run command.
- [frontend/Dockerfile](frontend/Dockerfile): Node.js and its install-and-run command.
- [backend/.dockerignore](backend/.dockerignore) and [frontend/.dockerignore](frontend/.dockerignore): files excluded from image build contexts.
- [frontend/vite.config.ts](frontend/vite.config.ts): the configurable API proxy.
- [Backend README](backend/README.md) and [frontend README](frontend/README.md): service-specific instructions.
