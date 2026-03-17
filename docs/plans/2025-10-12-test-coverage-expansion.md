# Test Coverage Expansion Plan

Last updated: 2026-03-17  
Owner(s): Testing Working Group  
Status: Completed

## Summary
- The staged unit, integration, and HTTP transport test expansion described here has been carried out.
- Coverage is now well beyond the original ≥60% objective, and the repo contains dedicated suites for client, services, transport lifecycle, schemas, formatters, and helpers.
- This plan remains as a completion record; further test work should be tracked as focused follow-ups rather than as this still-open programme.

## Scope
- **In scope**: Tests for ActivityWatch client, services, transport lifecycle, schema validation, formatting utilities, and supporting helpers.
- **Out of scope**: Tool behaviour changes, production code refactors unrelated to enabling tests, or CI pipeline restructuring.

## Objectives & Success Criteria
- Achieve ≥60 % statements coverage across the codebase with targeted service layers above 80 %.
- Provide reusable mocks/helpers that unblock subsequent test additions without rewriting scaffolding.
- Update contributor docs and active implementation notes to match the shipped test structure.

## Milestones
- [x] Milestone 1 — ActivityWatch client and helper enhancements ready.
- [x] Milestone 2 — Service-layer suites (Query, Category, Afk) expanded with canonical scenarios.
- [x] Milestone 3 — Transport lifecycle and formatter/schema coverage completed; docs refreshed.

## Current State
- Shared mocks and failure helpers exist in `tests/helpers/`.
- Client resiliency, service-layer coverage, runtime config, health checks, HTTP lifecycle, server-factory handlers, schemas, and formatter behavior all have active tests.
- The current remaining testing concerns are incremental and specific, such as optional release-script coverage or container-focused integration tests.

## Approach
- Keep this plan as a historical record of the completed testing expansion.
- Use targeted `docs/updates/` entries for any further testing work instead of reopening this plan unless another multi-phase test programme is needed.

## Risks & Mitigations
- **Risk**: Sandbox CI instability hides failing suites — *Mitigation*: run targeted commands locally and document known sandbox gaps.*
- **Risk**: Scope creep into production refactors — *Mitigation*: track optional refactors separately and gate them on explicit approval.*

## Dependencies
- ActivityWatch test data fixtures (existing `tests/fixtures` assets).
- Availability of CI resources to run new suites once stabilised.
- Coordination with maintainers for doc updates and threshold enforcement.

## Communication
- Reflect completion in `docs/plans/index.md`.
- Note future test additions in task-scoped updates or PR descriptions instead of treating this plan as active.

## References
- Coverage review summary from October 2025.
- Repository testing guidelines (`tests/README.md`).
