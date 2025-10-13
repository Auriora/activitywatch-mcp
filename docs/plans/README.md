# Plans (Forward-Looking Work)

A dedicated home for forward-looking, multi-step plans that guide substantial efforts (coverage uplift programmes, multi-phase refactors, rollouts). Plans capture intent, scope, sequencing, and owners so contributors can align before or while implementing work.

## When to create a plan
- You are coordinating multi-step work that spans multiple pull requests or contributors.
- The task has significant risk, cross-team impact, or requires stakeholder buy-in before execution.
- You need a living document to track milestones, status, risks, and dependencies over time.
- The work redefines process or policy (e.g., new testing standards, migration strategy).

## When *not* to create a plan
- You already completed the work — use `docs/updates/` for implementation logs instead.
- The change is a single PR/task with limited scope; rely on the PR description or issue instead.
- You are capturing foundational knowledge or how-to guides — write in `docs/concepts/`, `docs/developer/`, or related directories.
- You only need a quick checklist or TODO — track it in the issue tracker or `docs/updates` follow-ups list.

## File naming convention

- Format: `YYYY-MM-DD-slug.md` (date reflects when the plan was first drafted).
- Use short, descriptive slugs: `2025-10-12-test-coverage-expansion.md`.
- Update the **Last updated** metadata inside the document when the plan changes; the filename should remain stable.

### Location of active plans

- Store living plans directly in this folder.
- Move superseded or completed plans to `docs/archive/` (preserve the filename) once the work is fully delivered or deprecated.
- Surface the latest plans in `docs/plans/index.md` so collaborators can locate them quickly.

## Template & formatting

- Copy `_TEMPLATE.md` when starting a new plan.
- Keep sections concise; add tables or checklists when it improves clarity.
- Document ownership and communication cadence so contributors know how to stay aligned.
- Link relevant issues, updates, and docs from the References section — avoid duplicating content.

## Maintenance checklist

- [ ] Create or update an entry in `docs/plans/index.md`.
- [ ] Keep **Status**, **Last updated**, and milestone checkboxes current.
- [ ] Link related implementation updates (`docs/updates/`) as they land.
- [ ] Archive the plan or mark it *Completed* when all milestones are delivered.

See `_TEMPLATE.md` for the recommended structure, and `docs/updates/README.md` for guidance on capturing completed work after the plan executes.
