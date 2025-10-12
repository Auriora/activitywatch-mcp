import { describe, it, expect, vi } from 'vitest';
import { AddressInfo } from 'node:net';

import { createHttpServer, type SessionData } from '../../src/http-server.js';

const createStubServer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn().mockResolvedValue(undefined),
});

const startServer = async (instance: ReturnType<typeof createHttpServer>) => {
  const server = instance.app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl };
};

describe('HTTP transport lifecycle', () => {
  it('exposes health endpoint with configured ActivityWatch URL', async () => {
    const serverFactory = vi.fn().mockResolvedValue(createStubServer() as any);
    const instance = createHttpServer({
      awUrl: 'http://aw.local:5600',
      serverFactory,
      enableResourceLogging: false,
    });

    const { server, baseUrl } = await startServer(instance);
    try {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.awUrl).toBe('http://aw.local:5600');
      expect(body.activeSessions).toBe(0);
    } finally {
      server.close();
    }
  });

  it('reuses shared MCP server until reset', async () => {
    const stubServer = createStubServer();
    const serverFactory = vi.fn().mockResolvedValue(stubServer as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    await instance.getSharedServer();
    await instance.getSharedServer();

    expect(serverFactory).toHaveBeenCalledTimes(1);

    await instance.resetSharedServer();
    await instance.getSharedServer();
    expect(serverFactory).toHaveBeenCalledTimes(2);
  });

  it('reload endpoint resets shared server and clears sessions', async () => {
    const stubServer = createStubServer();
    const serverFactory = vi.fn().mockResolvedValue(stubServer as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    await instance.getSharedServer();

    const transport = { close: vi.fn().mockResolvedValue(undefined) } as unknown as SessionData['transport'];
    instance.state.sessions.set('session-1', { transport, server: stubServer as any });

    const { server, baseUrl } = await startServer(instance);
    try {
      const response = await fetch(`${baseUrl}/admin/reload-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awUrl: 'http://aw.new:5600' }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.awUrl).toBe('http://aw.new:5600');
      expect(body.activeSessions).toBe(0);
      expect(serverFactory).toHaveBeenCalledTimes(2);
      expect(transport.close).toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it('rejects non-initial MCP requests without session', async () => {
    const serverFactory = vi.fn().mockResolvedValue(createStubServer() as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    const { server, baseUrl } = await startServer(instance);
    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'unknown', id: 1 }),
      });

      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error?.message).toContain('Bad Request');
    } finally {
      server.close();
    }
  });

  it('returns 400 when posting SSE messages without a session', async () => {
    const serverFactory = vi.fn().mockResolvedValue(createStubServer() as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    const { server, baseUrl } = await startServer(instance);
    try {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'ping' }),
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('Missing sessionId');
    } finally {
      server.close();
    }
  });

  it('closes SSE sessions via DELETE /mcp', async () => {
    const stubServer = createStubServer();
    const serverFactory = vi.fn().mockResolvedValue(stubServer as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    const transport = { close: vi.fn().mockResolvedValue(undefined) } as any;
    instance.state.sessions.set('sse-session', { transport, server: stubServer as any });

    const { server, baseUrl } = await startServer(instance);
    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'DELETE',
        headers: { 'mcp-session-id': 'sse-session' },
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Session terminated');
      expect(transport.close).toHaveBeenCalled();
      expect(instance.state.sessions.size).toBe(0);
    } finally {
      server.close();
    }
  });

  it('reports reload errors when server factory fails', async () => {
    const serverFactory = vi.fn()
      .mockResolvedValueOnce(createStubServer() as any)
      .mockRejectedValueOnce(new Error('boom'));

    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });
    await instance.getSharedServer();

    const { server, baseUrl } = await startServer(instance);
    try {
      const response = await fetch(`${baseUrl}/admin/reload-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ awUrl: 'http://aw.failure:5600' }),
      });

      expect(response.status).toBe(500);
      const payload = await response.json();
      expect(payload.message).toBe('boom');
    } finally {
      server.close();
    }
  });
});
