# Title: Docker support for MCP server

Date: 2025-10-12-1252
Author: AI Agent
Related:
Tags: docs, infrastructure

## Summary
- Added multi-stage Docker image with entrypoint covering HTTP and stdio transports
- Enabled docker-compose workflow for exposing the HTTP/SSE server on localhost
- Documented build/run steps plus environment configuration for container usage

## Changes


- New `docker/` build context with `Dockerfile`, entrypoint script, and ignore rules
- Root-level `docker-compose.yml` orchestrating HTTP and optional stdio profiles
- `scripts/docker-publish.sh` helper for GHCR pushes and `.env.example` defaults (supports `--build-only`, `--push-only`, and auto-applies the OCI source label for package linking)
- GitHub Action workflow `.github/workflows/docker-release.yml` for release tagging
- Documentation updates in `README.md` and `docs/developer/docker.md`
- Added `.env.example` for docker-compose defaults

## Impact
- Developers can run the MCP server in containers for both HTTP and stdio modes
- Simplifies onboarding by bundling dependencies and default ActivityWatch connectivity
- No breaking changes for existing Node-based workflows

## Validation
- Local build instructions: `docker build -f docker/Dockerfile -t activitywatch-mcp .`
- HTTP mode: `docker compose up` and verify `curl http://localhost:3000/health`
- stdio mode: `docker run --rm -it activitywatch-mcp stdio`
- Optional: copy `.env.example` to `.env` to override defaults
- Development publishing: `./scripts/docker-publish.sh --dry-run` to confirm build

## Follow-ups / TODOs
- Automate CI build of the Docker image
- Add integration test harness that runs inside the container

## Links
- `docker/Dockerfile`
- `docker-compose.yml`
- `docs/developer/docker.md`
- `scripts/docker-publish.sh`
- `.github/workflows/docker-release.yml`
