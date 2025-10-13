# Coverage Improvement Plan

Last updated: 2025-10-12  
Owner(s): Testing Working Group  
Status: Draft

## Summary
- Define a five-phase roadmap to exceed global 80 % coverage and ≥75 % per-file thresholds.
- Prioritise high-risk modules (utilities, ActivityWatch client, services, transports) before enabling enforcement.
- Track rule provenance so future updates stay aligned with `.augment/rules/preferences.md` (priority 50) and `.augment/rules/testing.md` (priority 25).

## Scope
- **In scope**: Coverage uplift across utilities/config loaders, ActivityWatch client APIs, core services, transports, and vitest threshold configuration.
- **Out of scope**: Feature development, unrelated refactors, CI pipeline redesign, or documentation-only updates.

## Objectives & Success Criteria
- Achieve ≥80 % global coverage and ≥75 % per-file coverage prior to enforcing thresholds in CI.
- Address known blind spots in QueryService, CategoryService, AfkActivityService, and UnifiedActivityService.
- Produce actionable updates after each phase (captured in `docs/updates/`) to guide implementers.

## Milestones
- [ ] Phase 1 — Utilities & configuration loaders covered (target 2025-10-18).
- [ ] Phase 2 — ActivityWatch client resiliency scenarios completed (target 2025-10-20).
- [ ] Phase 3 — Core services uplifted with canonical scenarios (target 2025-10-24).
- [ ] Phase 4 — Transport lifecycle, logging, and health coverage finalised (target 2025-10-26).
- [ ] Phase 5 — Coverage thresholds enforced in `vitest.config.ts` / CI (target 2025-10-28).

## Approach
- Execute phases sequentially, using new helpers/mocks produced in Phase 1 to accelerate later work.
- Gate enforcement on verified coverage reports and document deltas in `docs/updates`.
- Coordinate closely with maintainers before enabling thresholds to avoid blocking unrelated work.

## Risks & Mitigations
- **Risk**: Threshold enforcement surfaces flaky tests. *Mitigation*: introduce warn-only thresholds first, stabilise suites, then fail builds.*
- **Risk**: Contributor bandwidth delays multiple phases. *Mitigation*: assign backup owners per phase and maintain a shared progress tracker.*

## Dependencies
- ActivityWatch data fixtures and mock client enhancements (see Test Coverage Expansion Plan).
- CI resources capable of running coverage reports for the full suite.
- Agreement from maintainers to raise thresholds and adjust contribution guidelines.

## Communication
- Update plan status and milestone checkboxes weekly; reflect highlights in `docs/plans/index.md`.
- Announce enforcement changes in release notes and shared channels prior to flips.

## References
- docs/plans/2025-10-12-test-coverage-expansion.md
- Coverage improvement execution updates from 2025-10-12.
- `.augment/rules/preferences.md`, `.augment/rules/testing.md`.
