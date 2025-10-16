import { describe, it, expect } from 'vitest';
import { AddressInfo } from 'node:net';

import { createHttpServer } from '../../src/http-server.js';

const startServer = async (instance: ReturnType<typeof createHttpServer>) => {
  const server = instance.app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return { server, baseUrl };
};

describe('MCP config endpoints', () => {
  it('serves /.well-known/mcp.json with auth_required=false by default', async () => {
    const instance = createHttpServer({ enableResourceLogging: false });
    const { server, baseUrl } = await startServer(instance);
    try {
      const res = await fetch(`${baseUrl}/.well-known/mcp.json`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toContain('no-store');
      const body = await res.json();
      expect(body).toMatchObject({ auth_required: false, name: 'activitywatch-mcp' });
      expect(Array.isArray(body.transports)).toBe(true);
      expect(body.auth).toBeDefined();
      expect(body.auth.required).toBe(false);
      expect(body.auth.type).toBe('none');
      expect(Array.isArray(body.auth.schemes)).toBe(true);
    } finally {
      server.close();
    }
  });

  it('serves /mcp/config as an alias with same payload', async () => {
    const instance = createHttpServer({ enableResourceLogging: false });
    const { server, baseUrl } = await startServer(instance);
    try {
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/.well-known/mcp.json`),
        fetch(`${baseUrl}/mcp/config`),
      ]);
      const [b1, b2] = await Promise.all([res1.json(), res2.json()]);
      expect(b1).toMatchObject(b2);
    } finally {
      server.close();
    }
  });
});
