# Test Coverage Expansion Plan

Last updated: 2025-10-12  
Owner(s): Testing Working Group  
Status: In Progress

## Summary
- Coordinate staged additions to unit, integration, and HTTP transport suites following the October 2025 coverage review.
- Lift statement coverage above 60 % immediately, with priority services trending toward 80 %+.
- Keep documentation and tooling updates aligned so contributors can adopt new patterns consistently.

## Scope
- **In scope**: Tests for ActivityWatch client, services, transport lifecycle, schema validation, formatting utilities, and supporting helpers.
- **Out of scope**: Tool behaviour changes, production code refactors unrelated to enabling tests, or CI pipeline restructuring.

## Objectives & Success Criteria
- Achieve ≥60 % statements coverage across the codebase with targeted service layers above 80 %.
- Provide reusable mocks/helpers that unblock subsequent test additions without rewriting scaffolding.
- Update contributor docs (`tests/README.md`, `docs/developer/testing.md`) to reflect new expectations.

## Milestones
- [ ] Milestone 1 — ActivityWatch client and helper enhancements ready (target: 2025-10-20).
- [ ] Milestone 2 — Service-layer suites (Query, Category, Afk) expanded with canonical scenarios (target: 2025-10-24).
- [ ] Milestone 3 — Transport lifecycle and formatter/schema coverage completed; docs refreshed (target: 2025-10-28).

## Approach
- Phase workstreams by dependency chain (client → services → transports → docs) to reduce rework.
- Capture shared setup logic in `tests/helpers/` and update the mock client to emit `AWError`/timeout cases.
- Update docs alongside code so expectations stay in sync with the testing guide.

## Risks & Mitigations
- **Risk**: Sandbox CI instability hides failing suites — *Mitigation*: run targeted commands locally and document known sandbox gaps.*
- **Risk**: Scope creep into production refactors — *Mitigation*: track optional refactors separately and gate them on explicit approval.*

## Dependencies
- ActivityWatch test data fixtures (existing `tests/fixtures` assets).
- Availability of CI resources to run new suites once stabilised.
- Coordination with maintainers for doc updates and threshold enforcement.

## Communication
- Share weekly status in `docs/plans/index.md` (Latest Plans section) and tag maintainers in relevant issues.
- Note milestone progress in commit/PR descriptions referencing this plan.

## References
- Coverage review summary (internal discussion, pending issue link).
- Repository testing guidelines (`tests/README.md`).
