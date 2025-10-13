# Title: HTTP Server Implementation

Date: 2025-10-11-0756
Author: AI Agent
Related:
Tags: testing, infrastructure

## Summary
- Added an Express-based HTTP/SSE transport so the MCP server can run outside IDE processes.
- Refactored server creation into a shared factory reused by both stdio and HTTP entrypoints.
- Produced developer documentation, configs, and scripts to simplify local experimentation.

## Changes
- Introduced `src/http-server.ts`, `src/server-factory.ts`, and supporting tool definition modules.
- Added HTTP-specific scripts/dependencies plus Claude Desktop config examples and documentation.
- Documented transport behaviour, endpoints, and migration steps for contributors.

### Motivation

Previously, the MCP server only supported stdio transport, which meant:
- The server ran as a subprocess of the IDE (e.g., Claude Desktop)
- Every code change required restarting the entire IDE
- Slow development cycle and difficult debugging
- No way to monitor server health independently

### Solution

Added HTTP/SSE transport support alongside the existing stdio transport:

#### New Files

1. **`src/http-server.ts`** - HTTP server entry point
   - Express-based HTTP server
   - Handles POST, GET, and DELETE requests for MCP protocol
   - Session management with `Mcp-Session-Id` header
   - Health check endpoint at `/health`
   - Graceful shutdown handling

2. **`src/server-factory.ts`** - Shared server creation logic
   - Extracts MCP server creation from `src/index.ts`
   - Shared between stdio and HTTP transports
   - Handles all tool registration and request handling
   - Includes category management tools

3. **`src/tools/definitions.ts`** - Tool definitions
   - Extracted tool definitions for reusability
   - All 9 MCP tools with complete schemas

4. **`docs/developer/http-server-development.md`** - Quick start guide
   - TL;DR for developers
   - Common commands and configurations
   - Troubleshooting tips

5. **`docs/developer/http-server-development.md`** - Complete documentation
   - Architecture overview
   - Development workflow
   - Debugging techniques
   - Production deployment notes

6. **`claude_desktop_config_http.example.json`** - Example config
   - HTTP transport configuration for Claude Desktop

#### Modified Files

1. **`package.json`**
   - Added `express` and `cors` dependencies
   - Added `@types/express` and `@types/cors` dev dependencies
   - New scripts: `start:http` and `dev:http`

2. **`README.md`**
   - Added development mode section
   - HTTP server quick start
   - Links to detailed documentation

### Architecture

#### Transport Comparison

| Aspect | stdio | HTTP/SSE |
|--------|-------|----------|
| **Use Case** | Production | Development |
| **Process Model** | Subprocess of IDE | Independent process |
| **Restart Required** | Full IDE | Server only |
| **Debugging** | Limited | Full HTTP tools |
| **Health Monitoring** | None | `/health` endpoint |
| **Multiple Clients** | No | Yes |

#### HTTP Endpoints

- `GET /health` - Health check (returns status, active sessions, timestamp)
- `POST /mcp` - MCP initialization and tool calls
- `GET /mcp` - SSE stream for server-to-client messages
- `DELETE /mcp` - Session termination

#### Session Management

1. Client sends POST to `/mcp` without session ID (initialization)
2. Server creates session, returns `Mcp-Session-Id` header
3. Client includes session ID in all subsequent requests
4. Client opens GET request to `/mcp` with session ID for SSE stream
5. Server maintains session state until DELETE or timeout

#### Code Reuse

The `createMCPServer()` factory function is shared between both transports:

```typescript
// stdio transport (src/index.ts)
const server = await createMCPServer(AW_URL);
const transport = new StdioServerTransport();
await server.connect(transport);

// HTTP transport (src/http-server.ts)
const server = await createMCPServer(AW_URL);
const transport = new StreamableHTTPServerTransport({...});
await server.connect(transport);
```

### Usage

#### Development Workflow

```bash
# Terminal 1: Start HTTP server
npm run start:http

# Terminal 2: Make changes, rebuild, restart
npm run build
# Ctrl+C in Terminal 1, then restart
npm run start:http
```

#### Configuration

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "activitywatch": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Environment Variables**:
- `MCP_PORT` - Server port (default: 3000)
- `AW_URL` - ActivityWatch URL (default: http://localhost:5600)
- `LOG_LEVEL` - Logging level (default: INFO)

### Future Enhancements

Potential improvements:

1. **Auto-reload**: Watch for file changes and auto-restart server
2. **WebSocket Transport**: Alternative to SSE for bidirectional communication
3. **Authentication**: Add optional auth for network deployments
4. **Metrics**: Prometheus-style metrics endpoint
5. **Docker Support**: Containerized deployment option

### Migration Guide

#### Switching to HTTP Mode

1. Build the project: `npm run build`
2. Start HTTP server: `npm run start:http`
3. Update Claude config to use `url` instead of `command`
4. Restart Claude Desktop

#### Switching Back to stdio

1. Update Claude config to use `command` and `args`
2. Restart Claude Desktop
3. Stop HTTP server (Ctrl+C)

### Conclusion

The HTTP server implementation provides a significant improvement to the development experience while maintaining full compatibility with the existing stdio transport for production use. Developers can now iterate much faster without the overhead of restarting their IDE.

## Impact
#### For Developers

1. **Faster Iteration**
   - Restart server in ~1 second vs ~10+ seconds for IDE
   - No need to close/reopen IDE windows
   - Maintain IDE state and context

2. **Better Debugging**
   - Use curl, Postman, or browser DevTools
   - Monitor HTTP traffic with standard tools
   - Health check endpoint for monitoring

3. **Easier Testing**
   - Test tools independently of IDE
   - Multiple clients can connect simultaneously
   - Automated testing with HTTP clients

#### For Production

- stdio transport remains unchanged
- No impact on production deployments
- Both transports share the same core logic

## Impact
- Enables rapid iterations without restarting the IDE by running the MCP server as a standalone process.
- Provides health checks and observable logging unavailable with stdio transport.
- Lays groundwork for future deployments (Docker, remote hosting) via explicit HTTP entrypoint.

## Validation
- `npm run build` to confirm TypeScript compilation.
- `npm run start:http` to boot the server and observe SSE session lifecycle.
- Manual checks of `/health`, `/mcp` initialization, and SSE stream connectivity.

## Follow-ups / TODOs
- None.

## Links
- [MCP Protocol - Transports](https://modelcontextprotocol.io/docs/concepts/transports)
- [MCP SDK - StreamableHTTPServerTransport](https://github.com/modelcontextprotocol/typescript-sdk)
- [Express.js Documentation](https://expressjs.com/)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
