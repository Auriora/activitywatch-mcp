# Title: Retire aw_get_daily_summary tool

Date: 2025-10-11
Author: AI Agent (Codex)
Related: N/A
Tags: tooling, docs

## Summary
- Removed the redundant `aw_get_daily_summary` MCP tool now that `aw_get_period_summary` covers daily and multi-day summaries.
- Updated user- and developer-facing docs so guidance consistently points to `aw_get_period_summary`.
- Followed project rules from `.augment/rules/preferences.md` (priority 50) and `.augment/rules/planning.md` (priority 30) to plan and document the work.

## Changes
- Deleted the DailySummary service, schema, types, and server handlers; `aw_get_period_summary` now handles all summary calls.
- Refreshed README, reference docs, best practices, and configuration guidance to remove or reframe daily-summary references.
- Added changelog notes and capabilities updates to reflect the new tool roster.

## Impact
- Breaking change: MCP clients must call `aw_get_period_summary` for daily summaries; the old tool no longer exists.
- Simplifies maintenance by consolidating formatting/utilities around period summaries only.
- Capability suggestions now surface `aw_get_period_summary` without mentioning the legacy tool.

## Validation
- `npm run build`
- Manual grep to confirm `aw_get_daily_summary` is absent from `src/`

## Follow-ups / TODOs
- Monitor downstream clients for any lingering references to `aw_get_daily_summary`.
- Consider pruning historical docs if a lighter archive is desired.

## Links
- Docs index: docs/updates/index.md
