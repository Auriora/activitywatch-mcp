import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const MODULE_PATH = '../../../src/config/app-names.js';

const loadModule = async () => import(MODULE_PATH);

describe('app names configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('fs');
  });

  it('loads configured browser/editor names and detection rules', async () => {
    const mod = await loadModule();

    expect(mod.getBrowserAppNames('chrome')).toContain('Google Chrome');
    expect(mod.getEditorAppNames('vscode')).toContain('Visual Studio Code');
    expect(mod.detectBrowserType('aw-watcher-web-chrome_dev')).toBe('chrome');
    expect(mod.detectBrowserType('aw-watcher-web-chromium_dev')).toBe('chrome');
    expect(mod.detectEditorType('aw-watcher-vscode_dev')).toBe('vscode');
    expect(mod.getTitleParsingConfig()).toHaveProperty('rules');
  });

  it('falls back to empty configuration when file load fails', async () => {
    vi.doMock('fs', () => ({
      readFileSync: vi.fn(() => {
        throw new Error('boom');
      }),
    }));

    const mod = await loadModule();

    expect(mod.getBrowserAppNames('chrome')).toEqual([]);
    expect(mod.detectBrowserType('aw-watcher-web-chrome_dev')).toBe('chrome');
    expect(mod.getTitleParsingConfig()).toEqual({
      localHostname: 'unknown',
      rules: [],
    });
  });
});
