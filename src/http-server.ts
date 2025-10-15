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
import { logStartupDiagnostics, performHealthCheck } from './utils/health.js';

/** Session state held for active MCP transports */
export interface SessionData {
  transport: StreamableHTTPServerTransport | SSEServerTransport;
  server: Server;
}
interface HttpServerOptions {
  awUrl?: string;
  serverFactory?: (awUrl: string) => Promise<Server>;
  enableResourceLogging?: boolean;
}

interface HttpServerState {
  awUrl: string;
  sharedServerPromise: Promise<Server> | null;
  sessions: Map<string, SessionData>;
}

const DEFAULT_SSE_HEARTBEAT_INTERVAL_MS = 15000;

interface HttpServerInstance {
  app: ReturnType<typeof express>;
  state: HttpServerState;
  getSharedServer(): Promise<Server>;
  resetSharedServer(): Promise<void>;
  closeAllSessions(reason: string): Promise<void>;
  setAwUrl(url: string): void;
  getAwUrl(): string;
}

function startResourceLogging(_app: ReturnType<typeof express>, state: HttpServerState): void {
  const resourceLogIntervalMs = Number.parseInt(process.env.MCP_RESOURCE_LOG_INTERVAL ?? '60000', 10);
  if (Number.isNaN(resourceLogIntervalMs) || resourceLogIntervalMs <= 0) {
    return;
  }

  const snapshot = (): void => {
    const mem = process.memoryUsage();
    const usage = typeof process.resourceUsage === 'function' ? process.resourceUsage() : undefined;
    const handles = typeof (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles === 'function'
      ? (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles!().length
      : undefined;

    const toMB = (value: number): number => Math.round((value / 1024 / 1024) * 100) / 100;

    logger.debug('Resource usage snapshot', {
      sessions: state.sessions.size,
      memory: {
        rssMB: toMB(mem.rss),
        heapUsedMB: toMB(mem.heapUsed),
        heapTotalMB: toMB(mem.heapTotal),
        externalMB: toMB(mem.external),
        arrayBuffersMB: toMB(mem.arrayBuffers),
      },
      cpu: usage
        ? {
            userSec: Math.round((usage.userCPUTime / 1_000_000) * 100) / 100,
            systemSec: Math.round((usage.systemCPUTime / 1_000_000) * 100) / 100,
            maxRSSMB: usage.maxRSS / 1024,
          }
        : undefined,
      activeHandles: handles,
    });
  };

  setInterval(snapshot, resourceLogIntervalMs).unref();
}

export function createHttpServer(options: HttpServerOptions = {}): HttpServerInstance {
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: '*',
    exposedHeaders: ['Mcp-Session-Id']
  }));

  const state: HttpServerState = {
    awUrl: options.awUrl ?? process.env.AW_URL ?? 'http://localhost:5600',
    sharedServerPromise: null,
    sessions: new Map<string, SessionData>(),
  };

  const serverFactory = options.serverFactory ?? createMCPServer;

  const getSharedServer = async (): Promise<Server> => {
    if (!state.sharedServerPromise) {
      state.sharedServerPromise = serverFactory(state.awUrl).catch(error => {
        state.sharedServerPromise = null;
        throw error;
      });
    }
    return state.sharedServerPromise;
  };

  const resetSharedServer = async (): Promise<void> => {
    if (!state.sharedServerPromise) {
      return;
    }

    try {
      const server = await state.sharedServerPromise;
      const closable = server as unknown as { close?: () => Promise<void> | void; dispose?: () => Promise<void> | void };
      if (typeof closable.close === 'function') {
        await closable.close();
      } else if (typeof closable.dispose === 'function') {
        await closable.dispose();
      }
    } catch (error) {
      logger.warn('Unable to close existing MCP server during reset', error);
    } finally {
      state.sharedServerPromise = null;
    }
  };

  const closeAllSessions = async (reason: string): Promise<void> => {
    const closures: Promise<unknown>[] = [];

    for (const [sessionId, sessionData] of state.sessions.entries()) {
      state.sessions.delete(sessionId);
      logger.info(`Closing session ${sessionId}`, { reason });
      const transportAny = sessionData.transport as unknown as { close?: () => Promise<void> | void };
      if (typeof transportAny.close === 'function') {
        closures.push(
          Promise.resolve()
            .then(() => transportAny.close!.call(sessionData.transport))
            .catch(error => logger.warn(`Failed to close transport for session ${sessionId}`, error))
        );
      }
    }

    if (closures.length > 0) {
      await Promise.allSettled(closures);
    }
  };

  app.get('/health', async (_req, res) => {
    try {
      const { ActivityWatchClient } = await import('./client/activitywatch.js');
      const client = new ActivityWatchClient(state.awUrl);
      const result = await performHealthCheck(client);
      const status = result.healthy ? 200 : 503;
      res.status(status).json({
        status: result.healthy ? 'ok' : 'unhealthy',
        activeSessions: state.sessions.size,
        awUrl: state.awUrl,
        timestamp: new Date().toISOString(),
        details: result,
      });
    } catch (error) {
      logger.error('Health endpoint failed', error);
      res.status(500).json({
        status: 'error',
        activeSessions: state.sessions.size,
        awUrl: state.awUrl,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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

    if (sessionId && state.sessions.has(sessionId)) {
      // Reuse existing session
      sessionData = state.sessions.get(sessionId)!;
      logger.debug(`Reusing existing session: ${sessionId}`);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      logger.info('Creating new MCP session');

      // Create a new server instance for this session
      const server = await getSharedServer();

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          logger.info(`Session initialized with ID: ${newSessionId}`);
          // Store the session immediately when it's initialized
          sessionData = { transport, server };
          state.sessions.set(newSessionId, sessionData);
          logger.debug(`Session stored in map with ID: ${newSessionId}`);
        },
        onsessionclosed: (closedSessionId) => {
          logger.info(`Session closed: ${closedSessionId}`);
          state.sessions.delete(closedSessionId);
        }
      });

      // Set up cleanup on transport close
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && state.sessions.has(sid)) {
          logger.info(`Transport closed for session ${sid}, cleaning up`);
          state.sessions.delete(sid);
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

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    logger.debug(`GET /mcp request received`, {
      sessionId,
      hasSessionId: !!sessionId,
      sessionExists: sessionId ? state.sessions.has(sessionId) : false,
      activeSessions: Array.from(state.sessions.keys()),
      headers: req.headers
    });

    if (sessionId) {
      if (!state.sessions.has(sessionId)) {
        logger.warn(`Session not found for Streamable HTTP SSE stream: ${sessionId}`, {
          activeSessions: Array.from(state.sessions.keys())
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

      const sessionData = state.sessions.get(sessionId)!;

      if (sessionData.transport instanceof StreamableHTTPServerTransport) {
        await sessionData.transport.handleRequest(req, res);
      } else {
        logger.warn('GET to /mcp with existing SSE session - unexpected');
        res.status(400).send('SSE stream already established');
      }
      return;
    }

    logger.info('Creating new pure SSE session (no session ID in header)');

    let clearHeartbeat: (() => void) | undefined;

    try {
      const transport = new SSEServerTransport('/messages', res);
      const newSessionId = transport.sessionId;

      logger.info(`Pure SSE session created with ID: ${newSessionId}`);

      const server = await getSharedServer();

      const sessionData = { transport, server };
      state.sessions.set(newSessionId, sessionData);
      logger.debug(`Pure SSE session stored in map with ID: ${newSessionId}`);

      clearHeartbeat = (() => {
        let heartbeatTimer: NodeJS.Timeout | null = null;

        const stop = (): void => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        };

        const start = (): void => {
          const configured = Number.parseInt(process.env.MCP_SSE_HEARTBEAT_INTERVAL ?? `${DEFAULT_SSE_HEARTBEAT_INTERVAL_MS}`, 10);
          if (Number.isNaN(configured) || configured <= 0) {
            logger.debug('SSE heartbeat disabled via MCP_SSE_HEARTBEAT_INTERVAL', {
              sessionId: newSessionId,
              configured,
            });
            return;
          }

          const sendHeartbeat = (): void => {
            if (res.writableEnded || res.writableFinished) {
              stop();
              return;
            }

            try {
              res.write(': keep-alive\n\n');
            } catch (heartbeatError) {
              logger.debug('Failed to write SSE heartbeat', {
                sessionId: newSessionId,
                error: heartbeatError instanceof Error ? heartbeatError.message : heartbeatError,
              });
              stop();
            }
          };

          sendHeartbeat();
          heartbeatTimer = setInterval(sendHeartbeat, configured);
          if (typeof heartbeatTimer.unref === 'function') {
            heartbeatTimer.unref();
          }
        };

        start();

        res.on('close', stop);
        res.on('error', stop);

        return stop;
      })();

      transport.onclose = () => {
        clearHeartbeat?.();
        logger.info(`Pure SSE transport closed for session ${newSessionId}, cleaning up`);
        state.sessions.delete(newSessionId);
      };

      await server.connect(transport);

      logger.debug(`Pure SSE stream established with session ID: ${newSessionId}`);
    } catch (error) {
      clearHeartbeat?.();
      logger.error('Error establishing pure SSE stream', error);
      if (!res.headersSent) {
        res.status(500).send('Error establishing SSE stream');
      }
    }
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string | undefined;

    logger.info('POST /messages request received', {
      sessionId,
      hasSessionId: !!sessionId,
      sessionExists: sessionId ? state.sessions.has(sessionId) : false,
      activeSessions: Array.from(state.sessions.keys())
    });

    if (!sessionId) {
      logger.warn('No session ID provided in /messages request');
      res.status(400).send('Missing sessionId parameter');
      return;
    }

    if (!state.sessions.has(sessionId)) {
      logger.warn(`Session not found for /messages request: ${sessionId}`, {
        activeSessions: Array.from(state.sessions.keys())
      });
      res.status(404).send('Session not found');
      return;
    }

    try {
      const sessionData = state.sessions.get(sessionId)!;

      if ('handlePostMessage' in sessionData.transport) {
        await sessionData.transport.handlePostMessage(req, res, req.body);
        logger.info('SSE message delivered to transport', {
          sessionId,
          contentLength: req.headers['content-length'] ?? null,
        });
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

  app.post('/admin/reload-server', async (req, res) => {
    const requestedUrl = typeof req.body?.awUrl === 'string' ? req.body.awUrl : undefined;

    try {
      if (requestedUrl && requestedUrl !== state.awUrl) {
        state.awUrl = requestedUrl;
        logStartupDiagnostics(state.awUrl);
      }

      await closeAllSessions('admin reload');
      await resetSharedServer();
      await getSharedServer();

      res.json({
        status: 'reloaded',
        awUrl: state.awUrl,
        activeSessions: state.sessions.size,
      });
    } catch (error) {
      logger.error('Failed to reload MCP server', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !state.sessions.has(sessionId)) {
      logger.warn(`Invalid or missing session ID for termination: ${sessionId}`);
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    logger.info(`Received session termination request for session ${sessionId}`);

    try {
      const sessionData = state.sessions.get(sessionId)!;

      if (sessionData.transport instanceof StreamableHTTPServerTransport) {
        await sessionData.transport.handleRequest(req, res);
      } else {
        logger.info(`Closing SSE session ${sessionId}`);
        await sessionData.transport.close();
        state.sessions.delete(sessionId);
        res.status(200).send('Session terminated');
      }
    } catch (error) {
      logger.error('Error handling session termination', error);
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination');
      }
    }
  });

  if (options.enableResourceLogging !== false) {
    startResourceLogging(app, state);
  }

  const setAwUrl = (url: string): void => {
    state.awUrl = url;
  };

  const getAwUrl = (): string => state.awUrl;

  return {
    app,
    state,
    getSharedServer,
    resetSharedServer,
    closeAllSessions,
    setAwUrl,
    getAwUrl,
  } satisfies HttpServerInstance;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  import('./http-server-cli.js')
    .then(module => module.runHttpServerCli())
    .catch(error => {
      logger.error('Failed to start HTTP server CLI', error);
      process.exit(1);
    });
}
