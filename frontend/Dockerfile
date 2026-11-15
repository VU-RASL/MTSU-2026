# Start with Node.js 24 and npm on a small Debian Linux image.
FROM node:24-bookworm-slim

# Run subsequent instructions and startup commands from /app.
WORKDIR /app
# Copy frontend files into /app, excluding .dockerignore patterns.
# Compose mounts your current host source over this copy during development.
COPY . .

# Document Vite's port; Compose's ports setting publishes it on your computer.
EXPOSE 5173

# Install from the lockfile at startup, including after dependency edits.
# sh -c runs the command; npm ci installs exactly the locked dependencies.
# && starts Vite only if installation succeeds; exec lets it receive stop signals.
# --host accepts container network traffic; --port sets 5173; --strictPort prevents fallback to another port.
CMD ["sh", "-c", "npm ci && exec npm run dev -- --host 0.0.0.0 --port 5173 --strictPort"]
