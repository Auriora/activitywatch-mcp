# HTTP Session Management Fix

**Date**: October 11, 2025  
**Type**: Bug Fix  
**Status**: Complete

## Summary

Fixed a critical race condition in the HTTP/SSE transport session management that prevented the MCP server from properly storing and retrieving sessions, causing all subsequent requests after initialization to fail with "Invalid request: no session ID and not an initialization request" errors.

## Problem

The HTTP server was experiencing a session management failure where:

1. **Initialization succeeded**: The server would create a session and return a session ID in the `Mcp-Session-Id` header
2. **Subsequent requests failed**: When the client sent the session ID back in the next request, the server couldn't find it in the sessions map
3. **Error message**: `[WARN] Invalid request: no session ID and not an initialization request`

### Root Cause

The issue was a **race condition** in the session storage timing:

```typescript
// BEFORE (buggy code):
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  // ...
});

await server.connect(transport);

sessionData = { transport, server };

// BUG: transport.sessionId is undefined here!
if (transport.sessionId) {
  sessions.set(transport.sessionId, sessionData);
}

// Session ID gets set INSIDE handleRequest
await transport.handleRequest(req, res, req.body);
```

The problem:
- `transport.sessionId` is `undefined` until `handleRequest()` is called
- `handleRequest()` internally calls the initialization logic which sets `transport.sessionId`
- By the time the session ID exists, we've already tried (and failed) to store it in the map

### Evidence from Logs

```
[INFO] Session initialized with ID: 4e4c0d43-0735-4ee6-9ea8-8ce9d8fd9e02
[DEBUG] Received MCP request for session: 4e4c0d43-0735-4ee6-9ea8-8ce9d8fd9e02
[WARN] Invalid request: no session ID and not an initialization request
```

The second request **did** include the session ID, but the server couldn't find it because it was never stored.

## Solution

Move the session storage into the `onsessioninitialized` callback, which is called **after** the session ID has been generated:

```typescript
// AFTER (fixed code):
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: (newSessionId) => {
    logger.info(`Session initialized with ID: ${newSessionId}`);
    // Store the session immediately when it's initialized
    sessionData = { transport, server };
    sessions.set(newSessionId, sessionData);
    logger.debug(`Session stored in map with ID: ${newSessionId}`);
  },
  // ...
});

await server.connect(transport);

// Handle the initialization request
// Note: sessionData will be set by the onsessioninitialized callback
await transport.handleRequest(req, res, req.body);
```

### Why This Works

1. `handleRequest()` processes the initialization request
2. During processing, it generates the session ID
3. **Immediately** after generation, it calls `onsessioninitialized(newSessionId)`
4. Our callback stores the session in the map with the correct ID
5. Subsequent requests can now find the session

## Additional Improvements

### Better Error Handling

Added comprehensive error handlers to prevent silent failures:

```typescript
// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception - server will exit', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection - server will exit', { reason, promise });
  process.exit(1);
});

// Server error handler
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${MCP_PORT} is already in use. Please stop the other process or use a different port.`);
  } else {
    logger.error('Server error', error);
  }
  process.exit(1);
});
```

### Improved Shutdown Handling

```typescript
// Graceful shutdown with timeout
process.on('SIGINT', async () => {
  logger.info('Shutting down server...');

  // Close all active sessions
  for (const [sessionId, sessionData] of sessions.entries()) {
    try {
      logger.info(`Closing session ${sessionId}`);
      await sessionData.transport.close();
      sessions.delete(sessionId);
    } catch (error) {
      logger.error(`Error closing session ${sessionId}`, error);
    }
  }

  // Close the HTTP server
  server.close(() => {
    logger.info('Server shutdown complete');
    process.exit(0);
  });

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.warn('Forcing shutdown after timeout');
    process.exit(1);
  }, 5000);
});
```

## Testing

### Test Procedure

1. Start the HTTP server with DEBUG logging:
   ```bash
   LOG_LEVEL=DEBUG node dist/http-server.js
   ```

2. Send initialization request:
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{
       "jsonrpc": "2.0",
       "id": 1,
       "method": "initialize",
       "params": {
         "protocolVersion": "2024-11-05",
         "capabilities": {},
         "clientInfo": {"name": "test", "version": "1.0.0"}
       }
     }'
   ```

3. Extract session ID from response headers and send a second request:
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -H "Mcp-Session-Id: <session-id>" \
     -H "Mcp-Protocol-Version: 2024-11-05" \
     -d '{
       "jsonrpc": "2.0",
       "id": 2,
       "method": "tools/list",
       "params": {}
     }'
   ```

### Expected Results

Server logs should show:
```
[DEBUG] Received MCP request (no session)
[INFO] Creating new MCP session
[INFO] Session initialized with ID: b7f9f56c-55a2-4634-b313-e4a09d2e647e
[DEBUG] Session stored in map with ID: b7f9f56c-55a2-4634-b313-e4a09d2e647e
[DEBUG] Initialization response sent with session ID: b7f9f56c-55a2-4634-b313-e4a09d2e647e
[DEBUG] Received MCP request for session: b7f9f56c-55a2-4634-b313-e4a09d2e647e
[DEBUG] Reusing existing session: b7f9f56c-55a2-4634-b313-e4a09d2e647e
```

✅ **All tests passed successfully**

## Files Modified

- `src/http-server.ts`:
  - Fixed session storage timing (moved to `onsessioninitialized` callback)
  - Added global error handlers
  - Improved server error handling
  - Enhanced graceful shutdown with timeout
  - Added SIGTERM handler

## Impact

### Before Fix
- ❌ HTTP/SSE transport was completely broken
- ❌ Only initialization requests worked
- ❌ All subsequent requests failed
- ❌ Silent failures with unclear error messages

### After Fix
- ✅ HTTP/SSE transport fully functional
- ✅ Sessions properly stored and retrieved
- ✅ Multiple requests work correctly
- ✅ Clear error messages for common issues (port in use, etc.)
- ✅ Graceful shutdown handling

## Compatibility

- No breaking changes
- Fully backward compatible with stdio transport
- No changes to MCP protocol implementation
- No changes to tool definitions or handlers

## References

- [MCP Specification - Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [MCP SDK - StreamableHTTPServerTransport](https://github.com/modelcontextprotocol/typescript-sdk)
- Original implementation: `docs/updates/http-server-implementation.md`

## Conclusion

The HTTP/SSE transport is now fully functional and can be used for development with Augment MCP tool or any other MCP client that supports HTTP transport. The session management race condition has been resolved, and additional error handling ensures better debugging experience.

