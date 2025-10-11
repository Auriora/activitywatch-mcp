/**
 * User preferences configuration loader
 * 
 * Loads user preferences from config/user-preferences.json
 * Provides defaults and validation for user settings
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseTimezoneOffset, getSystemTimezoneOffset, formatTimezoneOffset } from '../utils/time.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface UserPreferences {
  timezone: string;
  timezoneOffsetMinutes: number;
  dateFormat: string;
  weekStartsOn: 'monday' | 'sunday';
  hourFormat: '12h' | '24h';
}

interface UserPreferencesConfig {
  timezone?: string;
  dateFormat?: string;
  weekStartsOn?: 'monday' | 'sunday';
  hourFormat?: '12h' | '24h';
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: 'UTC',
  timezoneOffsetMinutes: 0,
  dateFormat: 'YYYY-MM-DD',
  weekStartsOn: 'monday',
  hourFormat: '24h',
};

let cachedPreferences: UserPreferences | null = null;

/**
 * Load user preferences from config file
 */
export function loadUserPreferences(): UserPreferences {
  // Return cached preferences if already loaded
  if (cachedPreferences) {
    return cachedPreferences;
  }

  try {
    const configPath = join(__dirname, '..', '..', 'config', 'user-preferences.json');
    const configData = readFileSync(configPath, 'utf-8');
    const config: UserPreferencesConfig = JSON.parse(configData);

    // Determine timezone
    let timezone = config.timezone || DEFAULT_PREFERENCES.timezone;
    let timezoneOffsetMinutes: number;

    // Check for environment variable override
    const envTimezone = process.env.ACTIVITYWATCH_TIMEZONE || process.env.TZ;
    if (envTimezone) {
      timezone = envTimezone;
    }

    // Parse timezone offset
    try {
      timezoneOffsetMinutes = parseTimezoneOffset(timezone);
    } catch (error) {
      console.warn(`[UserPreferences] Invalid timezone "${timezone}", falling back to system timezone`);
      timezoneOffsetMinutes = getSystemTimezoneOffset();
      timezone = formatTimezoneOffset(timezoneOffsetMinutes);
    }

    cachedPreferences = {
      timezone,
      timezoneOffsetMinutes,
      dateFormat: config.dateFormat || DEFAULT_PREFERENCES.dateFormat,
      weekStartsOn: config.weekStartsOn || DEFAULT_PREFERENCES.weekStartsOn,
      hourFormat: config.hourFormat || DEFAULT_PREFERENCES.hourFormat,
    };

    console.log(`[UserPreferences] Loaded preferences: timezone=${timezone} (${formatTimezoneOffset(timezoneOffsetMinutes)})`);
    return cachedPreferences;
  } catch (error) {
    console.warn('[UserPreferences] Failed to load config/user-preferences.json, using defaults:', error);
    
    // Fall back to system timezone
    const systemOffset = getSystemTimezoneOffset();
    const systemTimezone = formatTimezoneOffset(systemOffset);
    
    cachedPreferences = {
      ...DEFAULT_PREFERENCES,
      timezone: systemTimezone,
      timezoneOffsetMinutes: systemOffset,
    };
    
    return cachedPreferences;
  }
}

/**
 * Get timezone offset for a specific timezone string
 * Falls back to user preferences if timezone is not provided
 */
export function getTimezoneOffset(timezone?: string): { timezone: string; offsetMinutes: number } {
  if (timezone) {
    try {
      const offsetMinutes = parseTimezoneOffset(timezone);
      return { timezone, offsetMinutes };
    } catch (error) {
      console.warn(`[UserPreferences] Invalid timezone "${timezone}", falling back to user preferences`);
    }
  }

  const prefs = loadUserPreferences();
  return {
    timezone: prefs.timezone,
    offsetMinutes: prefs.timezoneOffsetMinutes,
  };
}

/**
 * Reload preferences from config file (clears cache)
 */
export function reloadUserPreferences(): UserPreferences {
  cachedPreferences = null;
  return loadUserPreferences();
}

