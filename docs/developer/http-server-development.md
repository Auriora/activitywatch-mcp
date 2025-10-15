# HTTP Server Development Mode

Last updated: October 15, 2025

## Overview

The ActivityWatch MCP server supports two transport modes:

1. **stdio** (default) - For production use with Claude Desktop and other MCP clients
2. **HTTP/SSE** - For development, allowing server restart without restarting your IDE

## Why HTTP Transport for Development?

When using stdio transport, the MCP server runs as a subprocess of your IDE (e.g., Claude Desktop). This means:

- ❌ Every code change requires restarting the entire IDE
- ❌ Slow development iteration cycle
- ❌ Difficult to debug and test changes

With HTTP transport:

- ✅ Restart only the MCP server, not your IDE
- ✅ Fast development iteration
- ✅ Easy debugging with standard HTTP tools
- ✅ Health check endpoint for monitoring
- ✅ Multiple clients can connect simultaneously

## Quick Start

### 1. Build the Project

```bash
npm run build
```

### 2. Start the HTTP Server

```bash
npm run start:http
```

Or for development with auto-rebuild:

```bash
npm run dev:http
```

Prefer a single command that rebuilds and restarts? Use the helper script:

```bash
./scripts/dev-server.sh
```

The server will start on `http://localhost:3000` by default.

### 3. Configure Your MCP Client

For Claude Desktop, update your config file:

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

### 4. Restart Claude Desktop

After changing the config, restart Claude Desktop to connect to the HTTP server.

## Configuration

### Environment Variables

- `MCP_PORT` - HTTP server port (default: 3000)
- `AW_URL` - ActivityWatch server URL (default: http://localhost:5600)
- `LOG_LEVEL` - Logging level: DEBUG, INFO, WARN, ERROR (default: INFO)
- `MCP_SSE_HEARTBEAT_INTERVAL` - Interval (ms) for server-sent event keep-alives. Defaults to 15000; set to `0` to disable. Helps reverse proxies keep the stream open.

Example:

```bash
MCP_PORT=3001 AW_URL=http://localhost:5600 LOG_LEVEL=DEBUG npm run start:http
```

### Helper Commands

```bash
# Build only
npm run build

# Start HTTP server
npm run start:http

# Build and start in one step
npm run dev:http

# Health probe
curl http://localhost:3000/health

# Verbose logging
LOG_LEVEL=DEBUG npm run start:http

# SSE Heartbeats & Proxies

- The HTTP transport now pushes `: keep-alive` comments over the SSE stream. Most proxies terminate idle streams after ~60 s without traffic; the default heartbeat keeps connections alive.
- Adjust `MCP_SSE_HEARTBEAT_INTERVAL` if you deploy behind infrastructure with stricter or more lenient idle timeouts. Lower values (e.g., `5000`) suit aggressive proxy timeouts; higher values reduce chatter on trusted networks.
- Clients should continue to POST MCP messages to `/messages?sessionId=…`; the heartbeat does not replace client-originated traffic.
```

### Concurrency & Isolation

- **Multiple instances:** Start additional HTTP/SSE servers on distinct `MCP_PORT` values. If a port is already bound, the listener throws `EADDRINUSE`, logs an error, and the process exits with status `1` so containers fail fast.
- **Session state:** The server keeps a `Map` of session IDs (`Mcp-Session-Id` header) to transports. Requests, SSE streams, and DELETE calls are keyed by that ID, isolating each host even when they share the same server process.
- **Stdio transport:** `node dist/index.js` runs in the foreground. You can launch one per host integration; each exits automatically when its parent process or terminal terminates.

### Admin Endpoint

The HTTP transport exposes a simple admin hook that drains active sessions and optionally retargets the backing ActivityWatch instance:

```bash
curl -X POST http://localhost:3000/admin/reload-server \
  -H "Content-Type: application/json" \
  -d '{"awUrl":"http://localhost:5601"}'
```

Use this when you change `AW_URL` or need to clear cached state without restarting the process.

## Development Workflow

### Typical Development Cycle

1. **Start the HTTP server**:
   ```bash
   npm run start:http
   ```

2. **Make code changes** in your editor

3. **Rebuild and restart** the server:
   ```bash
   npm run build && npm run start:http
   ```

4. **Test in Claude Desktop** - no need to restart Claude!

### Using the Health Check Endpoint

Check if the server is running:

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "ok",
  "activeSessions": 2,
  "awUrl": "http://localhost:5600",
  "timestamp": "2025-10-11T10:30:00.000Z"
}
```

## Architecture

### HTTP Endpoints

- `GET /health` - Health check endpoint
- `POST /mcp` - MCP tool calls and initialization
- `GET /mcp` - SSE stream for server-to-client messages
- `DELETE /mcp` - Session termination

### Session Management

The HTTP server maintains sessions using the `Mcp-Session-Id` header:

1. **Initialization**: Client sends POST without session ID
2. **Server Response**: Returns `Mcp-Session-Id` header
3. **Subsequent Requests**: Client includes session ID in all requests
4. **SSE Stream**: Client opens GET request with session ID for server messages

### Transport Comparison

| Feature | stdio | HTTP/SSE |
|---------|-------|----------|
| Production Ready | ✅ | ✅ |
| Development Friendly | ❌ | ✅ |
| Requires IDE Restart | ✅ | ❌ |
| Multiple Clients | ❌ | ✅ |
| Health Monitoring | ❌ | ✅ |
| Network Accessible | ❌ | ✅ |

## Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=DEBUG npm run start:http
```

### Monitor HTTP Traffic

Use tools like:

- **curl** - Command-line HTTP client
- **Postman** - GUI HTTP client
- **Browser DevTools** - Network tab
- **tcpdump/Wireshark** - Packet capture

### Example: Test Tool Call

```bash
# Initialize session
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

# Call a tool (use session ID from response)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "aw_get_capabilities",
      "arguments": {}
    }
  }'
```

## Troubleshooting

### Server Won't Start

**Error**: `EADDRINUSE: address already in use`

**Solution**: Another process is using port 3000. Either:
- Stop the other process
- Use a different port: `MCP_PORT=3001 npm run start:http`

### Claude Desktop Can't Connect

**Check**:
1. Server is running: `curl http://localhost:3000/health`
2. Config file has correct URL
3. Claude Desktop was restarted after config change

### Session Errors

**Error**: `Invalid or missing session ID`

**Cause**: Session expired or server restarted

**Solution**: Restart Claude Desktop to create a new session

## Production Deployment

For production, use the stdio transport:

```json
{
  "mcpServers": {
    "activitywatch": {
      "command": "node",
      "args": ["/path/to/activitywatch-mcp/dist/index.js"]
    }
  }
}
```

The HTTP server is designed for development and testing, not production deployment.

## Advanced Topics

### Custom Port Configuration

```bash
# Start on custom port
MCP_PORT=8080 npm run start:http
```

Update Claude config:

```json
{
  "mcpServers": {
    "activitywatch": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

### Multiple Server Instances

Run multiple instances for different projects:

```bash
# Terminal 1 - Project A
MCP_PORT=3000 npm run start:http

# Terminal 2 - Project B
MCP_PORT=3001 npm run start:http
```

### Network Access

To allow network access (e.g., from another machine):

**⚠️ Security Warning**: Only do this on trusted networks!

The server already binds to `0.0.0.0`, so it's accessible from the network. Configure your firewall as needed.

## See Also

- [MCP Protocol Documentation](https://modelcontextprotocol.io/docs/concepts/transports)
- [Logging and Health Checks](./logging-and-health.md)
- [Testing Guide](./testing.md)
