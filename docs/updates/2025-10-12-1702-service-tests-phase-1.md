# Title: Service layer test coverage expansion

Date: 2025-10-12-1702
Author: AI Agent
Related:
Tags: testing

## Summary
- Extended QueryService specs to cover AFK-filtered window/browser/editors paths and canonical aggregation queries.
- Expanded CategoryService tests for categorisation accuracy, ActivityWatch sync, and CRUD error handling.
- Added AfkActivityService unit tests for bucket absence, AFK period aggregation, and stats wrapper behaviour.

## Changes


- Updated `tests/unit/services/query.test.ts` to assert query composition, AFK filters, and canonical event aggregation.
- Expanded `tests/unit/services/category.test.ts` to validate server/env loading, categoriseEvents output, and add/update/delete flows.
- Introduced `tests/unit/services/afk-activity.test.ts` covering AFK summary calculations and simplified stats accessors.

## Impact
- Increases confidence in service-layer logic ahead of further MCP tooling work.
- Documents expected ActivityWatch interactions via deterministic mocks, easing future refactors.
- Test-only change; no production behaviour impacted.

## Validation
- `npm run test:unit`

## Follow-ups / TODOs
- None. The transport and server-factory follow-up work described here was completed in later test updates.

## Links
- ../developer/test-coverage-expansion-plan.md
- Rules consulted: .agents/rules/preferences.md, .agents/rules/planning.md, .agents/rules/testing.md
