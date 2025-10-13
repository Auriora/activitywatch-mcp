# HTTP Server Mode - Quick Start

## TL;DR

For faster development without restarting your IDE:

```bash
# Build and start HTTP server
npm run build
npm run start:http
```

Then configure Claude Desktop to use HTTP transport:

```json
{
  "mcpServers": {
    "activitywatch": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Restart Claude Desktop once. Now you can restart just the MCP server without restarting Claude!

## Why?

**stdio mode** (default):
- MCP server runs as subprocess of Claude Desktop
- Every code change = restart entire IDE
- Slow development cycle

**HTTP mode** (development):
- MCP server runs independently
- Restart only the server, not Claude
- Fast iteration, easy debugging

## Commands

```bash
# Build the project
npm run build

# Start HTTP server
npm run start:http

# Build and start (development)
npm run dev:http

# Check if server is running
curl http://localhost:3000/health
```

## Configuration

### Concurrency & Sessions

- You can run multiple HTTP/SSE instances on the same machine as long as each listens on a different `MCP_PORT`. The server exits with a non-zero status when the chosen port is already in use, which makes container launches fail fast instead of lingering.
- Each connected client receives a unique `Mcp-Session-Id`. Requests and SSE streams are routed by that session key, so concurrent hosts share a single process but keep their state isolated.
- If you rely on Docker, publish the container with an explicit host port (for example `-p 3000:3000`) to let Docker enforce a single instance per port while still allowing other ports for additional copies.

### Environment Variables

```bash
# Custom port
MCP_PORT=3001 npm run start:http

# Custom ActivityWatch URL
AW_URL=http://localhost:5600 npm run start:http

# Debug logging
LOG_LEVEL=DEBUG npm run start:http

# Resource telemetry snapshot interval (ms)
MCP_RESOURCE_LOG_INTERVAL=60000 npm run start:http
```

### Admin Endpoint

The HTTP server exposes a lightweight admin hook for refreshing the pooled MCP server or retargeting ActivityWatch:

```bash
curl -X POST http://localhost:3000/admin/reload-server \
  -H "Content-Type: application/json" \
  -d '{"awUrl":"http://localhost:5601"}'
```

This drains active sessions, resets the shared MCP server instance, and (optionally) updates the backing `AW_URL`.

### Claude Desktop Config

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "activitywatch": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Development Workflow

1. Start HTTP server: `npm run start:http`
2. Make code changes
3. Rebuild: `npm run build`
4. Restart server: `npm run start:http`
5. Test in Claude (no restart needed!)

## Switching Back to stdio

For production or final testing, use stdio mode:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/absolute/path/to/activitywatcher-mcp/dist/index.js"]
    }
  }
}
```

The stdio entrypoint runs in the foreground and exits with its host process (it uses `exec` inside the Docker entrypoint), so it is safe to run separate stdio instances for different MCP clients when needed.

## Troubleshooting

### Port Already in Use

```bash
# Use different port
MCP_PORT=3001 npm run start:http
```

### Claude Can't Connect

1. Check server is running: `curl http://localhost:3000/health`
2. Verify config file path and URL
3. Restart Claude Desktop after config change

### Session Errors

Restart Claude Desktop to create a new session.

## Full Documentation

See [docs/developer/http-server-development.md](docs/developer/http-server-development.md) for complete documentation.
