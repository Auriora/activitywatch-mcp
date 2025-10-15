# Title: Stabilize HTTP SSE transport with heartbeats

Date: 2025-10-15-1716
Author: Codex (GPT-5)
Related: Timeout investigation
Tags: transport, reliability, docs

## Summary
- Added server-side SSE heartbeats so HTTP transports stay alive behind idle-sensitive proxies.
- Raised logging visibility for `/messages` traffic to debug stalled MCP requests faster.
- Documented the new `MCP_SSE_HEARTBEAT_INTERVAL` knob for deployers.

## Changes
- Updated `src/http-server.ts` to emit configurable `: keep-alive` comments and clear timers on disconnect.
- Promoted `/messages` handling logs to INFO and captured payload size metadata.
- Extended `docs/developer/http-server-development.md` with heartbeat guidance and environment variable usage.

## Impact
- Prevents MCP clients from losing their SSE channel after ~60 s of inactivity when proxies enforce idle timeouts.
- Improves operability by making it obvious when messages route through the HTTP bridge.
- Non-breaking; disabling the heartbeat is possible via `MCP_SSE_HEARTBEAT_INTERVAL=0`.

## Validation
- Manual reproduction of the failure showed repeated SSE churn; after the change, heartbeats keep the connection active (requires redeploy to confirm under production conditions).
- Checked `docker logs activitywatch-mcp-http` locally to ensure heartbeat logging remains at DEBUG and INFO output shows POST deliveries.

## Follow-ups / TODOs
- Monitor container logs after redeploy; if heartbeats remain insufficient, consider configurable keep-alive payloads per proxy requirements.
- Evaluate adding automated integration coverage for SSE disconnection scenarios.

## Links
- MCP Streamable HTTP transport specification (OpenAI MCP docs)
- Prior update: 2025-10-11-0834-http-session-management-fix.md
