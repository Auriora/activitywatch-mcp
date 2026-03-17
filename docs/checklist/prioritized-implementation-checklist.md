# Prioritized Implementation Checklist

Last updated: 2026-03-17

This checklist captures the remaining implementation work that is still relevant after the documentation cleanup. Completed or superseded items were intentionally left out.

## P0: Align CI with coverage policy

- [ ] Update CI to run `npm run test:coverage`, not just `npm test`.
- [ ] Confirm the configured Vitest thresholds are actually enforced with the current coverage provider and fail the workflow when expected.
- [ ] Narrow or adjust threshold configuration if provider behavior does not match the declared `each` targets.

Why this matters:
- The repo declares coverage thresholds in `vitest.config.ts`, but the current workflow only runs the normal test suite.
- This is the main remaining gap between documented policy and actual enforcement.

Validation:
- `npm run test:coverage`
- CI pull request run fails when thresholds are intentionally violated

## P1: Add release-script coverage

- [ ] Add targeted automated tests for `scripts/release.mjs`.
- [ ] Cover dry-run behavior, version bumping, tag formatting, and dirty-tree guards.

Why this matters:
- The script is part of the release workflow but currently relies on manual verification.
- This is a contained tooling task with low implementation risk.

Validation:
- Automated tests for argument parsing and non-destructive git-path behavior

## P2: Add container-path regression coverage if needed

- [ ] Decide whether Docker/container regressions are frequent enough to justify test coverage.
- [ ] If yes, add one container-focused smoke path covering build plus a basic startup/health check.

Why this matters:
- Docker build and publish workflows exist, but there is no container-specific regression suite.
- This should stay conditional on actual operational value.

Validation:
- Container build succeeds
- Containerized server responds to a basic health or startup check

## P3: Improve capability feedback for omitted tools

- [ ] Add an optional hint in capabilities output explaining why `aw_get_activity` is not suggested when window tracking is unavailable.
- [ ] Keep the hint concise and machine-readable enough for MCP clients or agents to surface directly.

Why this matters:
- The current capabilities payload explains what is available, but not always why a familiar tool is missing.
- This is useful for browser/editor-only ActivityWatch setups.

Validation:
- Capabilities response includes the omission hint in a browser/editor-only fixture
- Existing capability tests still pass

## P4: Revisit period-summary verbosity only if there is demand

- [ ] Only implement configurable breakdown tag rendering if users complain about noisy breakdown lines.
- [ ] If requested, add a small control for which breakdown tags appear in concise period summaries.

Why this matters:
- The current formatter already adds dominant app/category context.
- Additional tag controls are product/UX work, not an accuracy or correctness issue.

Validation:
- Formatter tests cover the default and reduced-verbosity paths

## P5: Treat observability enhancements as strategic, not backlog-default

- [ ] Revisit structured logs, metrics, tracing, or dashboards only if deployment/ops needs justify them.
- [ ] Keep stage timing logs as the current baseline unless there is a concrete operational requirement.

Why this matters:
- Stage-level timing already exists in the unified activity pipeline.
- Broader observability work is optional infrastructure, not unfinished core behavior.

Validation:
- Scope a concrete deployment or support need before implementation
