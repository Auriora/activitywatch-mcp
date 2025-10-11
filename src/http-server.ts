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
  transport: StreamableHTTPServerTransport;
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

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          logger.info(`Session initialized with ID: ${newSessionId}`);
        },
        onsessionclosed: (closedSessionId) => {
          logger.info(`Session closed: ${closedSessionId}`);
          sessions.delete(closedSessionId);
        }
      });

      // Create a new server instance for this session
      const server = await createMCPServer(AW_URL);

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

      sessionData = { transport, server };

      // Store session after initialization
      if (transport.sessionId) {
        sessions.set(transport.sessionId, sessionData);
      }

      // Handle the initialization request
      await transport.handleRequest(req, res, req.body);
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
    await sessionData.transport.handleRequest(req, res, req.body);
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
 */
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    logger.warn(`Invalid or missing session ID for SSE stream: ${sessionId}`);
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const lastEventId = req.headers['last-event-id'] as string | undefined;
  if (lastEventId) {
    logger.debug(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    logger.debug(`Establishing new SSE stream for session ${sessionId}`);
  }

  const sessionData = sessions.get(sessionId)!;
  await sessionData.transport.handleRequest(req, res);
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
    await sessionData.transport.handleRequest(req, res);
  } catch (error) {
    logger.error('Error handling session termination', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

/**
 * Start server
 */
app.listen(MCP_PORT, () => {
  logger.info(`ActivityWatch MCP HTTP Server listening on port ${MCP_PORT}`);
  logger.info(`Health check available at http://localhost:${MCP_PORT}/health`);
  logger.info(`MCP endpoint at http://localhost:${MCP_PORT}/mcp`);
  logger.info(`ActivityWatch URL: ${AW_URL}`);
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

  logger.info('Server shutdown complete');
  process.exit(0);
});

