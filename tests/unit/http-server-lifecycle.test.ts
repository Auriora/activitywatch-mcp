import { describe, it, expect, vi } from 'vitest';

import { createHttpServer } from '../../src/http-server.js';

const createClosableServer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
});

const createDisposableServer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn().mockResolvedValue(undefined),
});

describe('HTTP server lifecycle helpers', () => {
  it('closes all tracked sessions', async () => {
    const serverFactory = vi.fn().mockResolvedValue(createClosableServer() as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    const closableTransport = { close: vi.fn().mockResolvedValue(undefined) } as any;
    const passiveTransport = {} as any;

    instance.state.sessions.set('session-1', { transport: closableTransport, server: {} as any });
    instance.state.sessions.set('session-2', { transport: passiveTransport, server: {} as any });

    await instance.closeAllSessions('test shutdown');

    expect(closableTransport.close).toHaveBeenCalled();
    expect(instance.state.sessions.size).toBe(0);
  });

  it('resets shared server using close when available', async () => {
    const closable = createClosableServer();
    const serverFactory = vi.fn().mockResolvedValue(closable as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    await instance.getSharedServer();
    await instance.resetSharedServer();

    expect(closable.close).toHaveBeenCalled();
    expect(instance.state.sharedServerPromise).toBeNull();
  });

  it('falls back to dispose when close is unavailable', async () => {
    const disposable = createDisposableServer();
    const serverFactory = vi.fn().mockResolvedValue(disposable as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    await instance.getSharedServer();
    await instance.resetSharedServer();

    expect(disposable.dispose).toHaveBeenCalled();
    expect(instance.state.sharedServerPromise).toBeNull();
  });

  it('handles closing errors gracefully and clears cached promise', async () => {
    const closable = createClosableServer();
    closable.close.mockRejectedValueOnce(new Error('boom'));
    const serverFactory = vi.fn().mockResolvedValue(closable as any);
    const instance = createHttpServer({ serverFactory, enableResourceLogging: false });

    await instance.getSharedServer();
    await instance.resetSharedServer();

    expect(closable.close).toHaveBeenCalled();
    expect(instance.state.sharedServerPromise).toBeNull();
  });

  it('updates ActivityWatch URL helpers', () => {
    const instance = createHttpServer({
      awUrl: 'http://aw.initial:5600',
      enableResourceLogging: false,
    });

    expect(instance.getAwUrl()).toBe('http://aw.initial:5600');
    instance.setAwUrl('http://aw.updated:5600');
    expect(instance.getAwUrl()).toBe('http://aw.updated:5600');
  });
});
