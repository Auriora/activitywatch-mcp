---
type:        "agent_requested"
name:        "Testing conventions"
priority:    25
scope:       "tests/**"
description: "This rule provides a standardized testing format and policy for all projects."
cross_reference: ["preferences.md"]
apply_when:   "task_involves_tests == true"
---

# Testing

- Always place tests next to the code they exercise when practical (e.g., `src/module/__tests__/` or `tests/module.test.ts`).
- Use consistent test file naming: prefer `*.test.ts` or `test_*.ts` depending on project conventions; include the `test` prefix if the project standard requires it.
- Prefer the repository's test runner (`vitest` for this repo); include minimal examples in the rule's `examples` frontmatter when present.

Examples:

- Unit tests for `src/utils/formatters.ts` → `tests/utils/formatters.test.ts` or `src/utils/formatters.test.ts` (follow repo convention).
- Integration tests that exercise multiple modules → `tests/integration/feature-name.test.ts`.

PR Checklist additions when tests are affected:
- [ ] Added/updated unit tests for changed behavior
- [ ] Added/updated minimal integration or smoke tests if public behavior changed
