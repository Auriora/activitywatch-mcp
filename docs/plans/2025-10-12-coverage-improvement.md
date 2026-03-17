# Coverage Improvement Plan

Last updated: 2026-03-17  
Owner(s): Testing Working Group  
Status: Completed

## Summary
- The planned coverage uplift work has been implemented across utilities, client code, services, and transport tests.
- The repository now carries Vitest coverage thresholds in configuration and the current suite exceeds the global targets.
- The remaining gap is operational: keep the reported thresholds aligned with actual enforcement behavior in CI and the active coverage provider.

## Scope
- **In scope**: Coverage uplift across utilities/config loaders, ActivityWatch client APIs, core services, transports, and vitest threshold configuration.
- **Out of scope**: Feature development, unrelated refactors, CI pipeline redesign, or documentation-only updates.

## Objectives & Success Criteria
- Achieve ≥80 % global coverage and ≥75 % per-file coverage.
- Address known blind spots in QueryService, CategoryService, AfkActivityService, and UnifiedActivityService.
- Document the implementation work in `docs/updates/` and keep active planning docs aligned with the current repo state.

## Milestones
- [x] Phase 1 — Utilities & configuration loaders covered.
- [x] Phase 2 — ActivityWatch client resiliency scenarios completed.
- [x] Phase 3 — Core services uplifted with canonical scenarios.
- [x] Phase 4 — Transport lifecycle, logging, and health coverage finalised.
- [x] Phase 5 — Coverage thresholds added to `vitest.config.ts`.

## Current State
- `vitest.config.ts` defines global thresholds of 80% and per-file thresholds of 75%.
- `npm run test:coverage` currently reports overall coverage above the global targets.
- Active transport, health, runtime-config, service, and formatter suites now exist in `tests/unit/` and `tests/integration/`.
- CI currently runs `npm test`; if strict coverage enforcement is required in CI, the workflow should invoke `npm run test:coverage` and verify threshold handling with the active Vitest configuration.

## Approach
- Keep this document as a record of the completed coverage initiative rather than an open roadmap.
- Track any new coverage gaps as targeted follow-up work in `docs/updates/` or a new plan if the scope becomes multi-phase again.
- Treat CI enforcement alignment as a small tooling task, not a reopening of the full coverage programme.

## Risks & Mitigations
- **Risk**: Threshold enforcement surfaces flaky tests. *Mitigation*: introduce warn-only thresholds first, stabilise suites, then fail builds.*
- **Risk**: Contributor bandwidth delays multiple phases. *Mitigation*: assign backup owners per phase and maintain a shared progress tracker.*

## Dependencies
- Existing ActivityWatch test data fixtures and shared mocks in `tests/helpers/`.
- CI resources capable of running coverage reports for the full suite.

## Communication
- Keep `docs/plans/index.md` and related `docs/updates/` entries aligned with the implemented state.
- Record any future enforcement changes or threshold adjustments in a task-scoped update.

## References
- docs/plans/2025-10-12-test-coverage-expansion.md
- Coverage improvement execution updates from 2025-10-12.
- `.agents/rules/preferences.md`, `.agents/rules/testing.md`.
