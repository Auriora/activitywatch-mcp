/**
 * Configuration loader for browser and editor app names
 *
 * This module loads app name mappings from config/app-names.json
 * and provides functions to access them.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface AppNamesConfig {
  browsers: Record<string, string[]>;
  editors: Record<string, string[]>;
  bucketDetection: {
    browsers: Record<string, string[]>;
    editors: Record<string, string[]>;
  };
}

// Load configuration from JSON file
let config: AppNamesConfig;
try {
  const configPath = join(__dirname, '..', '..', 'config', 'app-names.json');
  const configData = readFileSync(configPath, 'utf-8');
  config = JSON.parse(configData);
} catch (error) {
  console.error('[AppNamesConfig] ERROR: Failed to load config/app-names.json:', error);
  // Fallback to minimal config
  config = {
    browsers: {},
    editors: {},
    bucketDetection: { browsers: {}, editors: {} }
  };
}


/**
 * Get browser app names for a specific browser type
 */
export function getBrowserAppNames(browserType: string): string[] {
  return config.browsers[browserType.toLowerCase()] || [];
}

/**
 * Get editor app names for a specific editor type
 */
export function getEditorAppNames(editorType: string): string[] {
  return config.editors[editorType.toLowerCase()] || [];
}

/**
 * Detect browser type from bucket ID
 */
export function detectBrowserType(bucketId: string): string | null {
  const lowerBucketId = bucketId.toLowerCase();

  // Special case: chrome detection should exclude chromium
  if (lowerBucketId.includes('chrome') && !lowerBucketId.includes('chromium')) {
    return 'chrome';
  }

  // Check all browser detection patterns
  for (const [browserType, patterns] of Object.entries(config.bucketDetection.browsers)) {
    for (const pattern of patterns) {
      if (lowerBucketId.includes(pattern.toLowerCase())) {
        return browserType;
      }
    }
  }

  return null;
}

/**
 * Detect editor type from bucket ID
 */
export function detectEditorType(bucketId: string): string | null {
  const lowerBucketId = bucketId.toLowerCase();

  // Check all editor detection patterns
  for (const [editorType, patterns] of Object.entries(config.bucketDetection.editors)) {
    for (const pattern of patterns) {
      if (lowerBucketId.includes(pattern.toLowerCase())) {
        return editorType;
      }
    }
  }

  return null;
}

