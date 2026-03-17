# Title: Fix release script to tag the version bump commit

Date: 2026-03-17-1710
Author: Codex
Related: Release v0.3.2
Tags: release, automation, git

## Summary
- Fixed the release helper so it commits the version bump before creating the annotated release tag.
- Prevented future release tags from pointing at the pre-bump HEAD with uncommitted version changes left behind.
- Corrected the local `v0.3.2` release flow to align the tag with the actual release commit.

## Changes
- Updated `scripts/release.mjs` to stage and commit `package.json` and `package-lock.json` during `--apply`.
- Preserved the existing `v{version}` tag behavior, but moved tag creation to after the release commit.
- Re-created the local release flow so `v0.3.2` can point at the correct commit.

## Impact
- Non-breaking release automation fix.
- Future release bumps now leave the repository in a cleaner, publishable state.
- Reduces the chance of pushing a release tag that does not contain the corresponding version files.

## Validation
- Reviewed the script flow before and after the fix.
- Will verify with git history and tag placement after recreating the `v0.3.2` release commit locally.

## Follow-ups / TODOs
- Consider adding a small automated test around release script dry-run/apply behavior if the repository starts relying on it more heavily.

## Links
- Rules consulted: `preferences.md` (priority 50), `documentation.md` (priority 20), `git.md` (priority 15)
- Rules applied: task-scoped update entry, conventional commit format, release automation fix
- Overrides: none
