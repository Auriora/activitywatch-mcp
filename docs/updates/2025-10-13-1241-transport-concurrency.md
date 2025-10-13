# Title: Document transport concurrency and session isolation

Date: 2025-10-13-1241
Author: Codex (AI agent)
Related: 
Tags: docs, transport

## Summary
- Expanded HTTP/SSE documentation to clarify how multiple instances behave and how port collisions are handled.
- Highlighted session-level isolation semantics so hosts sharing a server know their state remains separate.
- Noted that stdio launches stay in the foreground, enabling one process per host client without background daemons.

## Changes
- Updated `HTTP-SERVER.md` and `docs/developer/http-server-development.md` with a new “Concurrency & Sessions” section and stdio lifecycle notes.
- Added references to the listener’s `EADDRINUSE` exit behaviour for Docker/CLI use.
- Documented that stdio processes exit with their parent and can run side-by-side.

## Impact
- Developers running multiple transports simultaneously have clear guidance on port selection, failure modes, and session boundaries.
- Reduces confusion when several MCP clients hit the same HTTP/SSE server.
- No runtime changes; documentation only.

## Validation
- Manual doc review for structure and links.
- Verified relevant source sections (`src/http-server-cli.ts`, `src/index.ts`) to confirm behaviour described.

## Follow-ups / TODOs
- Consider adding diagrams for session flow in future architecture docs.

## Links
- Rules consulted: `preferences.md` (priority 50), `documentation.md` (priority 20)
