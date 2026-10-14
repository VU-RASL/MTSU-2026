# Start with a small Debian Linux image.
FROM debian:bookworm-slim

# Refresh package lists, install compiler/build tools, Asio, and curl for health checks,
# then remove package lists to keep the image smaller. Backslashes continue one command.
RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ cmake make libasio-dev curl \
       python3 libcurl4-openssl-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Use /app as the working directory for subsequent instructions and startup.
WORKDIR /app
# Copy the backend build context into /app, excluding .dockerignore patterns.
# Compose mounts your current host source over this copy during development.
COPY . .

# Document the server port; Compose's ports setting makes it reachable from the host.
EXPOSE 18080

# Compile on startup so restarting the container picks up source edits.
# Keep the container build separate from any build made on the host.
# sh -c runs the command; configure a Debug build, then compile with two jobs.
# && stops on a build error; exec runs the server only after a successful build.
CMD ["sh", "-c", "cmake -S . -B /build -DCMAKE_BUILD_TYPE=Debug && cmake --build /build --parallel 2 && exec /build/server"]
