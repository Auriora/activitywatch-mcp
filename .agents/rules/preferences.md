---
type:        "always_apply"
name:        "General preferences"
priority:    50
scope:       ".*"
description: "General project preferences and guidance for coordinating and applying other rules"
cross_reference: ["documentation.md","git.md","planning.md","testing.md"]
apply_when:   "always"
---

# General Preferences

- Code must follow SOLID and DRY principles
- Code reviews must be thorough with refactoring suggestions to improve code quality
- Prefer direct implementation to extensive planning and analysis phases where appropriate
- Always double-check during testing or implementation if any changes have been lost or overwritten (e.g., after merges/sanitization), and verify via git diff/log before proceeding


## How Augment should apply other rules

This file contains project-level preferences plus explicit guidance for the agent (Augment) on discovering, prioritizing, and consistently applying other rule files in `/.augment/rules/`.

1. Discover: always load the set of rule documents from `/.augment/rules/` at the start of a task.
2. Classify applicability:
   - Filter rules by `type` and `scope` (if present). Treat `always_apply` rules as globally applicable unless a more specific rule overrides them.
   - Consider `agent_requested` rules when the task involves agent behavior, planning, or output formatting.
3. Prioritize:
   - Prefer higher-specificity rules (a rule that names a file/path or task scope wins over a global preference).
   - When rules conflict, prefer (in order): explicit task instruction > rule with higher `priority` (numeric) > more specific `scope` > `always_apply` default.
   - If equal specificity and conflict remains, pause and ask the user for resolution.
4. Apply and document:
   - For every non-trivial change, list which rules were consulted and which were applied in the implementation notes (e.g., `docs/updates/` entry or PR description).
   - If a rule was intentionally not applied (e.g., to avoid regressions), state the reason.


## Recommended metadata for rule files

To make rules easy to evaluate programmatically, include a short frontmatter block in each rule with the following (useful fields):

- `name`: short human-friendly name (optional)
- `type`: one of `always_apply`, `agent_requested`, `informational` (existing convention preserved)
- `description`: single-line summary
- `priority`: integer (higher = stronger preference). Default: `0` for neutral
- `scope`: optional glob or short description of what the rule targets (e.g., `src/**`, `docs/**`, `git-*`, `planning-flow`)
- `examples`: short examples of how to apply the rule (optional)
- `cross_reference`: list of other rule filenames this rule builds on or expects
- `apply_when`: optional short predicate describing when the rule should be considered (e.g., `task_type == "refactor"`)

Example frontmatter (recommended):

```markdown
---
# name: "Testing conventions"
# type: "agent_requested"
# description: "Testing file locations and naming"
# priority: 10
# scope: "tests/**"
# cross_reference: ["preferences.md", "documentation.md"]
# apply_when: "task_involves_tests == true"
---
```

## Examples of coordinated application

- When implementing new features that change public APIs, Augment MUST consult `documentation.md` for docs placement and `git.md` for commit message format. Document this in the `docs/updates/` entry.
- When writing tests, consult `testing.md` for naming/placement and `preferences.md` for logging of applied rules.
- For planning-driven work, follow `planning.md`'s stop/confirm tokens (`<<AWAIT_CONFIRM: ...?>>`) unless the user explicitly requests executing immediately.


## Enforcement & transparency

- Agents should add a single-line note to the PR description or `docs/updates/` entry summarizing: "Rules consulted: [list] — Rules applied: [list] — Overrides: [list with rationale]".
- When a numeric `priority` field is present, include it in the summary to aid reviewers.


## Minimal checklist for rule authors

When creating or editing a rule file, include:
- frontmatter with `type`, `description`, and optional `priority` and `scope`
- at least one short example of application
- cross-reference to related rules (if applicable)


## Quality and safety notes

- Do not modify other rule files without documenting the reason in `docs/updates/` and a clear test or review step.
- Prefer conservative change: if unsure whether a rule applies, prefer asking the user rather than making silent overrides.


<!-- end of file -->
