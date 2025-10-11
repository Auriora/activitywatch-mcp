import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { loadUserPreferences, reloadUserPreferences } from '../../../src/config/user-preferences.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '../../../config/user-preferences.json');

const userPreferencesSchema = z
  .object({
    $schema: z.string().optional(),
    timezone: z.string().optional(),
    dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD.MM.YYYY']).optional(),
    weekStartsOn: z.enum(['monday', 'sunday']).optional(),
    hourFormat: z.enum(['12h', '24h']).optional(),
  })
  .strict();

describe('user preferences configuration', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    originalEnv.ACTIVITYWATCH_TIMEZONE = process.env.ACTIVITYWATCH_TIMEZONE;
    originalEnv.TZ = process.env.TZ;
  });

  afterAll(() => {
    if (originalEnv.ACTIVITYWATCH_TIMEZONE !== undefined) {
      process.env.ACTIVITYWATCH_TIMEZONE = originalEnv.ACTIVITYWATCH_TIMEZONE;
    } else {
      delete process.env.ACTIVITYWATCH_TIMEZONE;
    }

    if (originalEnv.TZ !== undefined) {
      process.env.TZ = originalEnv.TZ;
    } else {
      delete process.env.TZ;
    }
  });

  beforeEach(() => {
    delete process.env.ACTIVITYWATCH_TIMEZONE;
    delete process.env.TZ;
    reloadUserPreferences();
  });

  afterEach(() => {
    reloadUserPreferences();
  });

  it('matches the JSON schema shape', () => {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const data = JSON.parse(raw);

    expect(() => userPreferencesSchema.parse(data)).not.toThrow();
  });

  it('loads preferences from configuration file', () => {
    const preferences = loadUserPreferences();

    expect(preferences.timezone).toBe('Europe/Dublin');
    expect(preferences.dateFormat).toBe('YYYY-MM-DD');
    expect(preferences.weekStartsOn).toBe('monday');
    expect(preferences.hourFormat).toBe('24h');
  });
});
