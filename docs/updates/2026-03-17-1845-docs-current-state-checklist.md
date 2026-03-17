# Title: Clean up active docs and add current-state implementation checklist

Date: 2026-03-17-1845
Author: Codex
Related:
Tags: docs, cleanup, checklist

## Summary
- Updated active plans and implementation notes so they reflect the current repository state instead of stale open work.
- Removed or narrowed follow-ups that are already implemented, superseded, or no longer the right level of backlog detail.
- Added a prioritized implementation checklist for the remaining real work.

## Changes
- Marked the 2025 coverage/testing plans as completed records and documented the remaining CI enforcement gap.
- Closed stale follow-ups in active `docs/updates` entries for coverage, transport tests, timeout/chunking docs, and shipped quickstart timezone examples.
- Normalized active rule-path references from legacy `.augment` paths to the current `.agents/rules` paths.
- Added `docs/checklist/prioritized-implementation-checklist.md`.
- Updated `docs/index.md` and `docs/updates/index.md` to link the new active docs.

## Impact
- Active docs now describe the repo as it exists today rather than preserving outdated open-work language.
- Remaining implementation work is concentrated into one prioritized checklist instead of scattered TODOs.
- Historical archive material remains available without driving current guidance.

## Validation
- `npm run check:links`
- Targeted stale-reference sweep across active docs

## Follow-ups / TODOs
- Keep the checklist current as implementation work lands.

## Links
- Rules consulted: `preferences.md` (priority 50), `documentation.md` (priority 20)
- Rules applied: docs stay under `docs/`, active docs updated for current-state accuracy, task-scoped update entry added and linked
- Overrides: none
