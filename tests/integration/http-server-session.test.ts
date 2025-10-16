import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AddressInfo } from 'node:net';

const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0',
    },
  },
};

describe('HTTP server session flows with mocked transports', () => {
  const transports: any[] = [];
  const sseTransports: any[] = [];
  let createHttpServer: typeof import('../../src/http-server.js').createHttpServer;
  let createStubServer: () => { connect: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();
    transports.length = 0;
    sseTransports.length = 0;

    vi.doMock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
      // noinspection JSUnusedGlobalSymbols
      class MockStreamableTransport {
        public sessionId: string | null = null;
        public onclose?: () => void;
        constructor(private options: any) {
          transports.push(this);
        }

        async handleRequest(_req: any, res: any, body?: any) {
          if (!this.sessionId && body) {
            this.sessionId = this.options.sessionIdGenerator();
            this.options.onsessioninitialized?.(this.sessionId);
            res.setHeader('Mcp-Session-Id', this.sessionId);
            res.status(200).json({ jsonrpc: '2.0', id: body.id ?? null, result: { serverInfo: {} } });
          } else {
            res.status(200).json({ jsonrpc: '2.0', id: body?.id ?? null, result: { ok: true } });
          }
        }

        async close() {
          this.onclose?.();
        }
      }

      return { StreamableHTTPServerTransport: MockStreamableTransport };
    });

    vi.doMock('@modelcontextprotocol/sdk/server/sse.js', () => {
      // noinspection JSUnusedGlobalSymbols
      class MockSSETransport {
        public sessionId: string;
        public onclose?: () => void;
        private res: any;
        constructor(_path: string, res: any) {
          this.sessionId = `sse-${Math.random().toString(16).slice(2, 8)}`;
          this.res = res;
          sseTransports.push(this);
        }

        async start() {
          this.res.setHeader('Content-Type', 'text/event-stream');
          this.res.status(200);
          this.res.write('data: ok\n\n');
        }

        async handlePostMessage(_req: any, res: any, _body: any) {
          res.status(200).json({ acknowledged: true });
        }

        async close() {
          this.res.end();
          this.onclose?.();
        }
      }

      return { SSEServerTransport: MockSSETransport };
    });

    vi.doMock('../../src/utils/logger.js', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }));

    ({ createHttpServer } = await import('../../src/http-server.js'));

    createStubServer = () => ({
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const startServer = async (instance: ReturnType<typeof createHttpServer>) => {
    const server = instance.app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    return { server, baseUrl: `http://127.0.0.1:${port}` };
  };

  it('creates and reuses streamable HTTP sessions', async () => {
    const stubServer = createStubServer();
    const instance = createHttpServer({ serverFactory: vi.fn().mockResolvedValue(stubServer as any), enableResourceLogging: false });

    const { server, baseUrl } = await startServer(instance);
    try {
      const initResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initializeRequest),
      });

      expect(initResponse.status).toBe(200);
      const sessionId = initResponse.headers.get('mcp-session-id');
      expect(sessionId).toBeTruthy();
      expect(instance.state.sessions.has(sessionId!)).toBe(true);

      const followUp = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId!,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }),
      });

      expect(followUp.status).toBe(200);
      expect(transports[0]?.sessionId).toBe(sessionId);

      const streamResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: { 'mcp-session-id': sessionId! },
      });
      expect(streamResponse.status).toBe(200);

      const terminateResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: { 'mcp-session-id': sessionId! },
      });
      expect(terminateResponse.status).toBe(200);

      transports[0]?.onclose?.();
      expect(instance.state.sessions.has(sessionId!)).toBe(false);
    } finally {
      server.close();
    }
  });

  it('establishes SSE sessions and supports message posting', async () => {
    const stubServer = createStubServer();
    const instance = createHttpServer({ serverFactory: vi.fn().mockResolvedValue(stubServer as any), enableResourceLogging: false });

    const { server, baseUrl } = await startServer(instance);
    try {
      const sseResponse = await fetch(`${baseUrl}/mcp`);
      expect(sseResponse.status).toBe(200);
      const createdSessionId = sseTransports[0]?.sessionId;
      expect(createdSessionId).toBeDefined();
      expect(instance.state.sessions.has(createdSessionId!)).toBe(true);

      const messageResponse = await fetch(`${baseUrl}/messages?sessionId=${createdSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'notify' }),
      });

      expect(messageResponse.status).toBe(200);

      const missingSessionResponse = await fetch(`${baseUrl}/mcp`, {
        method: 'GET',
        headers: { 'mcp-session-id': 'missing-session' },
      });
      expect(missingSessionResponse.status).toBe(404);

      // Closing should remove session entry
      await instance.closeAllSessions('test');
      expect(instance.state.sessions.size).toBe(0);
    } finally {
      server.close();
    }
  });
});
