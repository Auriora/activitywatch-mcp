# Title: Extend MCP Surface Beyond Tools

Last updated: 2025-10-16  
Owner(s): Codex (GPT-5)  
Status: Draft

## Summary
- Capture how the ActivityWatch MCP server can expose richer MCP capabilities (resources, prompts, sampling, elicitation) alongside the existing tool-first surface.
- Enable ChatGPT hosts to cache data, drive UI components, and manage human-in-the-loop flows without bespoke logic per tool.
- Provide implementation pointers into the current codebase so future work can proceed incrementally.

## Scope
- **In scope**: Converting high-signal, read-only outputs (`aw_get_capabilities`, canned activity summaries, calendar snapshots) into MCP resources; registering prompt metadata; integrating sampling handoffs; adding elicitation for missing parameters/confirmation; documentation updates.
- **Out of scope**: Changes to the underlying ActivityWatch client APIs; large-scale refactors of service logic; front-end widget implementations.

## Objectives & Success Criteria
- Objective 1 — Register at least three reusable resources (capabilities, activity summary presets, meeting snapshots) that keep parity with the corresponding tools.
- Objective 2 — Move summary formatting from server-generated Markdown to host-managed sampling for `aw_get_activity` and `aw_get_meeting_context` while retaining structured payloads.
- Objective 3 — Ensure destructive or underspecified tool calls (raw events, category CRUD) route through elicitation confirmations/error recovery.

## Milestones
- [ ] Milestone 1 — Resource scaffolding in `createMCPServer`, including `resources/list`, `read`, and subscription hooks; target 2025-10-25.
- [ ] Milestone 2 — Prompt metadata library and sampling integration for activity + meeting summaries; target 2025-11-01.
- [ ] Milestone 3 — Elicitation flows for raw-event bucket selection and category updates/deletions; target 2025-11-08.

## Approach
- Introduce resource registration alongside the existing tool registry, leveraging cached data from `CapabilitiesService`, `UnifiedActivityService`, and `CalendarService`. Map canned time ranges (`today`, `yesterday`, `last_7_days`) to resource URIs and reuse service calls for actual fetching.
- Extend `Server` initialization in `src/server-factory.ts` to advertise `resources`, `prompts`, `sampling`, and `elicitation` capabilities. Mirror the existing `sendToolListChanged` pattern to emit resource change notifications when ActivityWatch buckets or categories change.
- Create prompt definitions derived from `src/tools/definitions.ts` (“WHEN TO USE/WHEN NOT TO USE”) and store them in a new registry so the host can surface recommended actions.
- Refactor `aw_get_activity` and `aw_get_meeting_context` handlers to return structured JSON only; trigger host-driven summarisation via `sampling/create` with brief system prompts and pass-through metadata.
- Wrap tools that currently fail on missing params (`aw_get_raw_events`, category CRUD operations) with elicitation handlers that request user input/confirmation using JSON schemas before proceeding.
- Update developer docs (`docs/developer/http-server-development.md`) and configuration samples to describe the new capabilities, including any new environment toggles for subscriptions or sampling hints.

## Risks & Mitigations
- **Risk**: Increased response payload complexity confusing downstream clients — *Mitigation: maintain backward-compatible tool outputs while introducing resources incrementally; document migration path.*
- **Risk**: Subscription noise if ActivityWatch data updates frequently — *Mitigation: throttle resource change notifications and scope subscriptions to high-value feeds (capabilities, upcoming meetings).* 

## Dependencies
- ActivityWatch server availability for testing resource subscriptions and sampling flows.
- MCP SDK support for `resources/subscribe`, `sampling/create`, and `elicitation` in the targeted host (ChatGPT, DevDay clients).

## Communication
- Share progress via weekly notes in `docs/updates/` and link to this plan from `docs/plans/index.md`.
- Request reviews from maintainers familiar with MCP integration before enabling new capabilities by default.

## References
- `src/server-factory.ts`, `src/tools/definitions.ts`, `src/services/*` for current tool implementations.
- MCP documentation: developers.openai.com/apps-sdk/build/mcp-server/, developers.openai.com/apps-sdk/concepts/user-interaction.
- Existing calendar and activity tooling design notes in `docs/updates/2025-10-12-1232-calendar-integration.md` and `docs/updates/2025-10-12-1752-server-factory-tests.md`.
