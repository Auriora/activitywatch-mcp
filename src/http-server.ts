#!/usr/bin/env node

/**
 * ActivityWatch MCP HTTP Server
 *
 * HTTP/SSE transport version for easier development.
 * Allows server restart without restarting the IDE.
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { createMCPServer } from './server-factory.js';
import { logger } from './utils/logger.js';

/**
 * Configuration
 */
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3000;
const AW_URL = process.env.AW_URL || 'http://localhost:5600';

/**
 * Create Express app
 */
const app = express();
app.use(express.json());

// Enable CORS and expose session ID header
app.use(cors({
  origin: '*',
  exposedHeaders: ['Mcp-Session-Id']
}));

/**
 * Map to store transports and servers by session ID
 */
interface SessionData {
  transport: StreamableHTTPServerTransport | SSEServerTransport;
  server: Server;
}

const sessions = new Map<string, SessionData>();

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    awUrl: AW_URL,
    timestamp: new Date().toISOString()
  });
});

/**
 * MCP POST endpoint - handles initialization and tool calls
 */
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId) {
    logger.debug(`Received MCP request for session: ${sessionId}`);
  } else {
    logger.debug('Received MCP request (no session)');
  }

  try {
    let sessionData: SessionData | undefined;

    if (sessionId && sessions.has(sessionId)) {
      // Reuse existing session
      sessionData = sessions.get(sessionId)!;
      logger.debug(`Reusing existing session: ${sessionId}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      logger.info('Creating new MCP session');

      // Create a new server instance for this session
      const server = await createMCPServer(AW_URL);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          logger.info(`Session initialized with ID: ${newSessionId}`);
          // Store the session immediately when it's initialized
          sessionData = { transport, server };
          sessions.set(newSessionId, sessionData);
          logger.debug(`Session stored in map with ID: ${newSessionId}`);
        },
        onsessionclosed: (closedSessionId) => {
          logger.info(`Session closed: ${closedSessionId}`);
          sessions.delete(closedSessionId);
        }
      });

      // Set up cleanup on transport close
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          logger.info(`Transport closed for session ${sid}, cleaning up`);
          sessions.delete(sid);
        }
      };

      // Connect the transport to the server
      await server.connect(transport);

      // Handle the initialization request
      // Note: sessionData will be set by the onsessioninitialized callback
      await transport.handleRequest(req, res, req.body);

      // Log the session ID that should be in the response header
      logger.debug(`Initialization response sent with session ID: ${transport.sessionId}`);
      logger.debug(`Response headers: ${JSON.stringify(res.getHeaders())}`);
      return;
    } else {
      // Invalid request
      logger.warn('Invalid request: no session ID and not an initialization request');
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided or not an initialization request'
        },
        id: null
      });
      return;
    }

    // Handle the request with existing session
    if (sessionData.transport instanceof StreamableHTTPServerTransport) {
      await sessionData.transport.handleRequest(req, res, req.body);
    } else {
      // SSEServerTransport doesn't handle POST to /mcp, only to /messages
      logger.warn('POST to /mcp with SSE transport - should use /messages endpoint');
      res.status(400).send('Use /messages endpoint for SSE transport');
    }
  } catch (error) {
    logger.error('Error handling MCP request', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error'
        },
        id: null
      });
    }
  }
});

/**
 * MCP GET endpoint - handles SSE streams
 * Supports both Streamable HTTP (with session ID in header) and pure SSE (no session ID)
 */
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  logger.debug(`GET /mcp request received`, {
    sessionId,
    hasSessionId: !!sessionId,
    sessionExists: sessionId ? sessions.has(sessionId) : false,
    activeSessions: Array.from(sessions.keys()),
    headers: req.headers
  });

  // Check if this is Streamable HTTP (has session ID) or pure SSE (no session ID)
  if (sessionId) {
    // Streamable HTTP mode - session ID provided in header
    if (!sessions.has(sessionId)) {
      logger.warn(`Session not found for Streamable HTTP SSE stream: ${sessionId}`, {
        activeSessions: Array.from(sessions.keys())
      });
      res.status(404).send('Session not found');
      return;
    }

    const lastEventId = req.headers['last-event-id'] as string | undefined;
    if (lastEventId) {
      logger.debug(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
    } else {
      logger.debug(`Establishing Streamable HTTP SSE stream for session ${sessionId}`);
    }

    const sessionData = sessions.get(sessionId)!;

    if (sessionData.transport instanceof StreamableHTTPServerTransport) {
      await sessionData.transport.handleRequest(req, res);
    } else {
      // SSEServerTransport doesn't handle GET requests after initial connection
      logger.warn('GET to /mcp with existing SSE session - unexpected');
      res.status(400).send('SSE stream already established');
    }
  } else {
    // Pure SSE mode - no session ID, create new session
    logger.info('Creating new pure SSE session (no session ID in header)');

    try {
      // Create a new transport for pure SSE mode
      // The endpoint '/messages' is where the client will POST messages
      const transport = new SSEServerTransport('/messages', res);
      const newSessionId = transport.sessionId;

      logger.info(`Pure SSE session created with ID: ${newSessionId}`);

      // Create a new server instance for this session
      const server = await createMCPServer(AW_URL);

      // Store the session
      const sessionData = { transport, server };
      sessions.set(newSessionId, sessionData);
      logger.debug(`Pure SSE session stored in map with ID: ${newSessionId}`);

      // Set up cleanup on transport close
      transport.onclose = () => {
        logger.info(`Pure SSE transport closed for session ${newSessionId}, cleaning up`);
        sessions.delete(newSessionId);
      };

      // Connect the transport to the server
      // This will call transport.start() which sends the endpoint event
      await server.connect(transport);

      logger.debug(`Pure SSE stream established with session ID: ${newSessionId}`);
    } catch (error) {
      logger.error('Error establishing pure SSE stream', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  }
});

/**
 * Messages endpoint for pure SSE transport
 * Handles POST requests from SSE clients with sessionId as query parameter
 */
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;

  logger.debug(`POST /messages request received`, {
    sessionId,
    hasSessionId: !!sessionId,
    sessionExists: sessionId ? sessions.has(sessionId) : false,
    activeSessions: Array.from(sessions.keys())
  });

  if (!sessionId) {
    logger.warn('No session ID provided in /messages request');
    res.status(400).send('Missing sessionId parameter');
    return;
  }

  if (!sessions.has(sessionId)) {
    logger.warn(`Session not found for /messages request: ${sessionId}`, {
      activeSessions: Array.from(sessions.keys())
    });
    res.status(404).send('Session not found');
    return;
  }

  try {
    const sessionData = sessions.get(sessionId)!;

    // SSEServerTransport has a handlePostMessage method
    if ('handlePostMessage' in sessionData.transport) {
      await sessionData.transport.handlePostMessage(req, res, req.body);
    } else {
      logger.error(`Transport for session ${sessionId} does not support handlePostMessage`);
      res.status(500).send('Invalid transport type for SSE messages');
    }
  } catch (error) {
    logger.error('Error handling SSE message', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing message');
    }
  }
});

/**
 * MCP DELETE endpoint - handles session termination
 */
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    logger.warn(`Invalid or missing session ID for termination: ${sessionId}`);
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  logger.info(`Received session termination request for session ${sessionId}`);

  try {
    const sessionData = sessions.get(sessionId)!;

    if (sessionData.transport instanceof StreamableHTTPServerTransport) {
      await sessionData.transport.handleRequest(req, res);
    } else {
      // SSEServerTransport doesn't have handleRequest for DELETE
      // Just close the session manually
      logger.info(`Closing SSE session ${sessionId}`);
      await sessionData.transport.close();
      sessions.delete(sessionId);
      res.status(200).send('Session terminated');
    }
  } catch (error) {
    logger.error('Error handling session termination', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

/**
 * Global error handlers
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception - server will exit', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection - server will exit', { reason, promise });
  process.exit(1);
});

/**
 * Start server
 */
const server = app.listen(MCP_PORT, () => {
  logger.info(`ActivityWatch MCP HTTP Server listening on port ${MCP_PORT}`);
  logger.info(`Health check available at http://localhost:${MCP_PORT}/health`);
  logger.info(`MCP endpoint at http://localhost:${MCP_PORT}/mcp`);
  logger.info(`ActivityWatch URL: ${AW_URL}`);
});

// Handle server errors
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${MCP_PORT} is already in use. Please stop the other process or use a different port.`);
  } else {
    logger.error('Server error', error);
  }
  process.exit(1);
});

/**
 * Graceful shutdown
 */
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

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.emit('SIGINT' as any);
});

