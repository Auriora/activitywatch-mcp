import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_AW_QUERY_CHUNK_DAYS,
  DEFAULT_AW_TIMEOUT_MS,
  getRuntimeConfig,
} from '../../../src/config/runtime.js';

const originalTimeout = process.env.AW_TIMEOUT_MS;
const originalChunkDays = process.env.AW_QUERY_CHUNK_DAYS;

const restoreEnv = () => {
  if (originalTimeout === undefined) {
    delete process.env.AW_TIMEOUT_MS;
  } else {
    process.env.AW_TIMEOUT_MS = originalTimeout;
  }

  if (originalChunkDays === undefined) {
    delete process.env.AW_QUERY_CHUNK_DAYS;
  } else {
    process.env.AW_QUERY_CHUNK_DAYS = originalChunkDays;
  }
};

describe('runtime configuration', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('returns defaults when no environment variables are set', () => {
    delete process.env.AW_TIMEOUT_MS;
    delete process.env.AW_QUERY_CHUNK_DAYS;

    const config = getRuntimeConfig();
    expect(config.awTimeoutMs).toBe(DEFAULT_AW_TIMEOUT_MS);
    expect(config.awQueryChunkDays).toBe(DEFAULT_AW_QUERY_CHUNK_DAYS);
  });

  it('reads configured timeout and allows chunking to be disabled', () => {
    process.env.AW_TIMEOUT_MS = '45000';
    process.env.AW_QUERY_CHUNK_DAYS = '0';

    const config = getRuntimeConfig();
    expect(config.awTimeoutMs).toBe(45000);
    expect(config.awQueryChunkDays).toBe(0);
  });

  it('falls back to defaults for invalid values', () => {
    process.env.AW_TIMEOUT_MS = 'nope';
    process.env.AW_QUERY_CHUNK_DAYS = '-2';

    const config = getRuntimeConfig();
    expect(config.awTimeoutMs).toBe(DEFAULT_AW_TIMEOUT_MS);
    expect(config.awQueryChunkDays).toBe(DEFAULT_AW_QUERY_CHUNK_DAYS);
  });
});
