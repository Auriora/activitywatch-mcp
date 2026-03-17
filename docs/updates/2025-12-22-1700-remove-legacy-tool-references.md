# Title: Remove legacy tool references

Date: 2025-12-22-1700
Author: AI Agent
Related: 
Tags: docs, tools, tests

## Summary
- Removed legacy tool name references across docs/tests to eliminate confusion.
- Updated suggested tool outputs to align with the unified activity model.
- Refreshed documentation timestamps to reflect the changes.

## Changes
- Updated `src/services/capabilities.ts` suggested tools to prefer `aw_get_activity` and `aw_get_period_summary`.
- Adjusted unit and E2E expectations to match the current tool list.
- Reworded documentation (including archives and changelog) to avoid legacy tool name mentions.
- Updated "Last updated" stamps where content changed.
- Rules consulted: preferences.md (priority 50), documentation.md (priority 20), testing.md (priority 25). Rules applied: same. Overrides: none.

## Impact
- Non-breaking documentation cleanup; eliminates references to retired tools.
- `aw_get_capabilities` now suggests unified tools instead of legacy per-surface ones.

## Validation
- `npm run test:integration`

## Follow-ups / TODOs
- None.

## Links
- N/A
