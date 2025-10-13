# Docker Support

_Last updated: 2025-10-12_

## Overview

The Docker image packages the ActivityWatch MCP server with both HTTP/SSE and stdio transports. The build uses a multi-stage Node 20 image, compiles TypeScript ahead of time, and installs only production dependencies in the runtime layer for a smaller footprint.

## Building the Image

```bash
docker build -f docker/Dockerfile -t activitywatch-mcp .
```

The build context is the repository root; the Dockerfile and entrypoint live in `docker/`. The resulting image contains the compiled `dist/` output and `config/` JSON assets required at runtime.

## Runtime Modes

### HTTP/SSE Server

Run the container as an HTTP/SSE service on port 3000 (default):

```bash
docker compose up
# or specify a different port
MCP_PORT=4000 docker compose up
```

The compose file exposes the health endpoint on `/health`, and defaults `AW_URL` to `http://host.docker.internal:5600` so the container can reach a local ActivityWatch instance. Override `AW_URL` if ActivityWatch is running elsewhere.

### stdio Transport

The entrypoint also supports stdio mode for MCP clients that exec the container:

```bash
docker run --rm -it activitywatch-mcp stdio
```

This prints the MCP handshake over stdio, making it suitable for clients such as Claude Desktop that support containerized servers.

## Environment Variables

- `MCP_PORT` — Port for the HTTP/SSE server (default `3000`).
- `AW_URL` — ActivityWatch base URL (default `http://host.docker.internal:5600`). Linux users can map the host via `--add-host=host.docker.internal:host-gateway` or set `AW_URL` to the host IP.
- `LOG_LEVEL` — Logging verbosity (`DEBUG`, `INFO`, `WARN`, `ERROR`; default `INFO`).

You can pass these through `docker run -e` flags or the `.env` file that Compose automatically reads. Copy `.env.example` to `.env` to start with sensible defaults.

## Publishing Images

### Development pushes

Use the helper script to build and push the `dev` tag to GitHub Container Registry. Authenticate first with `docker login ghcr.io` using a token that has `write:packages` scope.

```bash
./scripts/docker-publish.sh
```

Override the tag with `--tag` or set `IMAGE_REPOSITORY`/`REGISTRY` to publish elsewhere. Append additional Docker build flags by adding them after `--`.

`--build-only` skips the push step (handy for local testing) and `--push-only` reuses an already built image for the given tag.

The script labels images with `org.opencontainers.image.source` so pushes automatically link back to this repository on GitHub.

### Release automation

The workflow at `.github/workflows/docker-release.yml` triggers on GitHub releases and builds tags for the published version (release tag without the leading `v`) and `latest`. The action uses the `docker/build-push-action` runner with Buildx and requires no extra secrets beyond the default `GITHUB_TOKEN` (packages write permission maintained in the workflow). You can also run it manually from the Actions tab and override the version tag when testing.

## docker-compose Profiles

`docker-compose.yml` defines two services:

- `activitywatch-mcp-http` — Default profile providing the HTTP/SSE endpoint, enabled by default.
- `activitywatch-mcp-stdio` — Optional profile that starts the same image in stdio mode. Activate it via `docker compose --profile stdio up activitywatch-mcp-stdio` if you want a long-running stdio container for testing.

Both services share the same build configuration and entrypoint.

## Troubleshooting

- **Health check failures**: Confirm ActivityWatch is reachable at `AW_URL` and the port is free. View logs with `docker compose logs -f`.
- **No ActivityWatch access**: On Linux, add `--add-host=host.docker.internal:host-gateway` to `docker run`, or set `AW_URL` to the host IP.
- **Rebuild needed after code changes**: Re-run `docker build -f docker/Dockerfile -t activitywatch-mcp .` to pick up new source changes.

For additional operational tips, see [http-server-development.md](./http-server-development.md).
