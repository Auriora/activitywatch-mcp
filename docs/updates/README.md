# Updates (What Was Implemented)

A dedicated home for short, task-scoped "What Was Implemented" docs that AI agents and contributors write after completing work.

Use this area to capture the context, changes, and follow-ups for each discrete piece of work, without cluttering the main concept or reference docs.

## When to write an Update

Create an update when you:
- Complete a task, feature, bugfix, or migration
- Finish a docs refactor or structural change
- Make cross-cutting improvements (logging, performance, DX)

These updates complement (and do not replace) the project CHANGELOG. The CHANGELOG stays high-level per release; Updates here are task-scoped and can be more verbose and instructional.

## File naming convention

- Format: `YYYY-MM-DD-descriptive-slug.md`
- Examples:
  - `2025-10-11-docs-restructure-phase-1.md`
  - `2025-10-12-canonical-events-consolidation.md`

## Front matter (optional)

At the top of each update, include a brief block (YAML or a simple header list):

```yaml
---
Title: Docs Restructuring — Phase 1
Date: 2025-10-11
Author: AI Agent
Related:
  - PR: #123
  - Issue: #456
Tags: [docs, refactor]
---
```

Alternatively, you can use simple bold headings:

```
Title: Docs Restructuring — Phase 1
Date: 2025-10-11
Author: AI Agent
Related: PR #123, Issue #456
Tags: docs, refactor
```

## Recommended sections

- Summary — 3–5 bullet points of what changed and why
- Changes — What was implemented (files, endpoints, behaviors)
- Impact — User-visible effects, risks, deprecations
- Validation — How it was tested, sample outputs, screenshots
- Follow-ups — Next steps, TODOs, tech debt
- Links — PRs, issues, references

See the `_TEMPLATE.md` for a copy-paste skeleton.

## Relationship to other docs

- CHANGELOG.md — Keep release-level highlights here. Link from updates into the changelog entry (and vice versa when appropriate).
- docs/archive — Historic status/update docs from prior phases. New work should use docs/updates.
- docs/reference/tools.md — Update tool specs here; do not embed API reference in updates.

## Process checklist

- [ ] Create a new file in `docs/updates/` with the naming convention
- [ ] Fill in the template sections concisely
- [ ] Add an entry to `docs/updates/index.md` under the Latest Updates list
- [ ] If relevant, add a short note in CHANGELOG.md linking to this update

## Examples

- Implementation log for category integration
- Post-mortem for a flaky query issue
- Migration notes when changing tool parameters
