# Title: Release automation scripts

Date: 2025-10-13-0958
Author: Codex (AI agent)
Related: 
Tags: tooling, release

## Summary
- Added a Node-based release script mirroring aw-import-ical's workflow to bump package versions and create annotated git tags on demand.
- Updated Docker publish tooling to always push versioned and `-dev` images derived from the current package.json version, keeping GitHub workflow ownership of `latest`.
- Documented applied rules (`preferences.md`, `planning.md`, `documentation.md`) to maintain repository compliance and traceability.

## Changes
- Introduced `scripts/release.mjs` with dry-run default, semantic bumping or explicit version setting, clean-tree enforcement, and optional tag creation.
- Refined `scripts/docker-publish.sh` to resolve the current package version, tag builds with `<version>` and `<version>-dev`, and accept optional extra tags without overriding defaults.
- Recorded these updates per documentation rule requirements.

## Impact
- Streamlines release preparation by automating version bumps and annotated tagging without committing or pushing.
- Ensures Docker images shared via the script use consistent semantic tags aligned with repository versioning practices, while leaving `latest` tagging to GitHub Actions.
- No breaking changes; scripts remain manual entry points with clearer output and guardrails.

## Validation
- `node scripts/release.mjs --bump minor` (dry run) to verify version resolution, tagging preview, and guardrails.
- Manual reasoning over `scripts/docker-publish.sh --help` to confirm option surface and tag list output without invoking Docker build in this environment.

## Follow-ups / TODOs
- Consider optional commit automation or push support if future release flow requires it.
- Evaluate adding integration tests for Docker publishing once CI environment supports container builds.

## Links
- Rules consulted: `preferences.md` (priority 50), `planning.md` (priority 30), `documentation.md` (priority 20)
