/**
 * Runtime configuration loaded from environment variables.
 */

export interface RuntimeConfig {
  awTimeoutMs: number;
  awQueryChunkDays: number;
}

export const DEFAULT_AW_TIMEOUT_MS = 30000;
export const DEFAULT_AW_QUERY_CHUNK_DAYS = 7;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseChunkDays = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
};

export function getRuntimeConfig(): RuntimeConfig {
  return {
    awTimeoutMs: parsePositiveInt(process.env.AW_TIMEOUT_MS, DEFAULT_AW_TIMEOUT_MS),
    awQueryChunkDays: parseChunkDays(process.env.AW_QUERY_CHUNK_DAYS, DEFAULT_AW_QUERY_CHUNK_DAYS),
  };
}
