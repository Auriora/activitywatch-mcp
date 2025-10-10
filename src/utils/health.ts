/**
 * Health check and diagnostics utilities
 */

import { ActivityWatchClient } from '../client/activitywatch.js';
import { logger } from './logger.js';

export interface HealthCheckResult {
  healthy: boolean;
  serverReachable: boolean;
  serverVersion?: string;
  bucketsAvailable: number;
  hasWindowTracking: boolean;
  hasBrowserTracking: boolean;
  hasAfkTracking: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Perform comprehensive health check on ActivityWatch connection
 */
export async function performHealthCheck(
  client: ActivityWatchClient
): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    healthy: true,
    serverReachable: false,
    bucketsAvailable: 0,
    hasWindowTracking: false,
    hasBrowserTracking: false,
    hasAfkTracking: false,
    errors: [],
    warnings: [],
  };

  logger.info('Starting ActivityWatch health check...');

  // Check 1: Server reachability
  try {
    const serverInfo = await client.getServerInfo();
    result.serverReachable = true;
    result.serverVersion = serverInfo.version;
    logger.info('ActivityWatch server reachable', { version: serverInfo.version });
  } catch (error) {
    result.healthy = false;
    result.serverReachable = false;
    result.errors.push('Cannot connect to ActivityWatch server. Is it running?');
    logger.error('ActivityWatch server unreachable', error);
    return result; // Can't continue if server is unreachable
  }

  // Check 2: Buckets availability
  try {
    const buckets = await client.getBuckets();
    const bucketList = Object.values(buckets);
    result.bucketsAvailable = bucketList.length;

    if (bucketList.length === 0) {
      result.warnings.push('No data buckets found. ActivityWatch may be newly installed or watchers not running.');
      logger.warn('No buckets available');
    } else {
      logger.info(`Found ${bucketList.length} buckets`);
    }

    // Check 3: Specific tracking capabilities
    result.hasWindowTracking = bucketList.some(b => 
      b.type === 'currentwindow' || b.type.includes('window')
    );
    result.hasBrowserTracking = bucketList.some(b => 
      b.type === 'web.tab.current' || b.type.includes('web')
    );
    result.hasAfkTracking = bucketList.some(b => 
      b.type === 'afkstatus' || b.type.includes('afk')
    );

    // Warnings for missing tracking
    if (!result.hasWindowTracking) {
      result.warnings.push('Window tracking not available. Install aw-watcher-window for application tracking.');
      logger.warn('Window tracking not available');
    }
    if (!result.hasBrowserTracking) {
      result.warnings.push('Browser tracking not available. Install aw-watcher-web for website tracking.');
      logger.warn('Browser tracking not available');
    }
    if (!result.hasAfkTracking) {
      result.warnings.push('AFK tracking not available. Some features may be limited.');
      logger.warn('AFK tracking not available');
    }

  } catch (error) {
    result.healthy = false;
    result.errors.push('Failed to retrieve buckets from ActivityWatch');
    logger.error('Failed to retrieve buckets', error);
  }

  // Final health determination
  if (result.errors.length > 0) {
    result.healthy = false;
  }

  logger.info('Health check complete', {
    healthy: result.healthy,
    bucketsAvailable: result.bucketsAvailable,
    hasWindowTracking: result.hasWindowTracking,
    hasBrowserTracking: result.hasBrowserTracking,
    hasAfkTracking: result.hasAfkTracking,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
  });

  return result;
}

/**
 * Format health check result for display
 */
export function formatHealthCheckResult(result: HealthCheckResult): string {
  const lines: string[] = [];
  
  lines.push('ActivityWatch Health Check');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`Status: ${result.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
  lines.push(`Server Reachable: ${result.serverReachable ? '✓ Yes' : '✗ No'}`);
  
  if (result.serverVersion) {
    lines.push(`Server Version: ${result.serverVersion}`);
  }
  
  lines.push(`Buckets Available: ${result.bucketsAvailable}`);
  lines.push('');
  lines.push('Tracking Capabilities:');
  lines.push(`  Window Tracking: ${result.hasWindowTracking ? '✓ Available' : '✗ Not Available'}`);
  lines.push(`  Browser Tracking: ${result.hasBrowserTracking ? '✓ Available' : '✗ Not Available'}`);
  lines.push(`  AFK Tracking: ${result.hasAfkTracking ? '✓ Available' : '✗ Not Available'}`);
  
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ✗ ${error}`);
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Log startup diagnostics
 */
export function logStartupDiagnostics(awUrl: string): void {
  logger.info('ActivityWatch MCP Server starting...', {
    awUrl,
    nodeVersion: process.version,
    platform: process.platform,
    logLevel: process.env.LOG_LEVEL || 'INFO',
  });
}

