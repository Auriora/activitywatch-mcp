# Title: Update Docker release workflow for Node 24 action runtime

Date: 2026-03-17-1735
Author: Codex
Related: Release v0.3.2
Tags: ci, docker, github-actions

## Summary
- Updated the Docker release workflow to action majors that support the GitHub Actions Node 24 runtime.
- Removed the Node 20 deprecation warning from the release publish path before the June 2026 runtime switch.
- Kept the existing release behavior and image tags unchanged.

## Changes
- Updated `.github/workflows/docker-release.yml` to use `actions/checkout@v5`.
- Updated Docker actions to `docker/setup-buildx-action@v4`, `docker/login-action@v4`, and `docker/build-push-action@v7`.

## Impact
- Non-breaking CI maintenance change.
- Future release image builds should continue to run cleanly as GitHub changes JavaScript action defaults.
- No change to image names, tags, or registry destination.

## Validation
- Reviewed the workflow diff against the release warning output.
- Confirmed the workflow still builds from the same Dockerfile and pushes the same version and `latest` tags.

## Follow-ups / TODOs
- If other workflows start emitting the same warning, update their action majors as well.

## Links
- Rules consulted: `preferences.md` (priority 50), `documentation.md` (priority 20), `git.md` (priority 15)
- Rules applied: task-scoped update entry, conventional commit format
- Overrides: none
