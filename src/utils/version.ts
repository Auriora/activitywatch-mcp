import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from './logger.js';

let cachedVersion: string | null = null;

export function getPackageVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = resolve(currentDir, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: unknown };
    const version = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';

    cachedVersion = version;
    return version;
  } catch (error) {
    logger.warn('Failed to load package version', { error });
    cachedVersion = '0.0.0';
    return cachedVersion;
  }
}

