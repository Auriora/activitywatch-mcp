import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { AddressInfo } from 'node:net';

import { createHttpServer } from '../../src/http-server.js';

const RUN_LIVE = process.env.RUN_LIVE_AW_TESTS === 'true';
const AW_URL = process.env.AW_URL || 'http://localhost:5600';

const initializeRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'live-test-client',
      version: '1.0.0',
    },
  },
};

describe.skipIf(!RUN_LIVE)('Live MCP activity tool calls', () => {
  let instance: ReturnType<typeof createHttpServer>;
  let server: ReturnType<ReturnType<typeof createHttpServer>['app']['listen']>;
  let baseUrl: string;
  let sessionId: string;

  const startServer = async () => {
    instance = createHttpServer({ awUrl: AW_URL, enableResourceLogging: false });
    server = instance.app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  };

  const initSession = async (): Promise<string> => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(initializeRequest),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('[live-mcp-activity] init failed', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText,
      });
    }

    expect(response.ok).toBe(true);
    const newSessionId = response.headers.get('mcp-session-id');
    expect(newSessionId).toBeTruthy();
    return newSessionId!;
  };

  const callTool = async (args: Record<string, unknown>, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'mcp-session-id': sessionId,
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'aw_get_activity',
            arguments: args,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('[live-mcp-activity] tool call failed', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText,
        });
      }

      expect(response.ok).toBe(true);
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('text/event-stream')
        ? await parseStreamedResponse(response)
        : await response.json();
      expect(payload.result).toBeDefined();
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  };

  const parseStreamedResponse = async (response: Response) => {
    const body = await response.text();
    const dataLines = body
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.replace(/^data:\s?/, '').trim())
      .filter(Boolean);

    for (const line of dataLines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && (parsed.result || parsed.error)) {
          return parsed;
        }
      } catch {
        // Ignore non-JSON data lines.
      }
    }

    throw new Error('No JSON payload found in SSE response');
  };

  beforeAll(async () => {
    await startServer();
    sessionId = await initSession();
  }, 30000);

  afterAll(async () => {
    if (instance) {
      await instance.closeAllSessions('live test cleanup');
    }
    if (server) {
      server.close();
    }
  });

  it('handles project grouping without timing out', async () => {
    await callTool({
      time_period: 'last_7_days',
      group_by: 'project',
      top_n: 5,
      min_duration_seconds: 5,
      response_format: 'detailed',
    });
  }, 60000);

  it('handles category top-level grouping without timing out', async () => {
    await callTool({
      time_period: 'last_7_days',
      group_by: 'category_top_level',
      top_n: 5,
      min_duration_seconds: 5,
      response_format: 'detailed',
    });
  }, 60000);
});
