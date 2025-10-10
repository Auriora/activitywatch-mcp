/**
 * Logging utility for ActivityWatch MCP Server
 */

import { getErrorProperties } from './type-guards.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel;

  constructor() {
    // Read from environment variable, default to INFO
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.level = LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const prefix = `[${timestamp}] [${levelName}]`;

    // Always log to stderr to avoid interfering with MCP stdio communication
    if (data !== undefined) {
      console.error(prefix, message, JSON.stringify(data, null, 2));
    } else {
      console.error(prefix, message);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: unknown): void {
    const errorProps = getErrorProperties(error);
    this.log(LogLevel.ERROR, message, errorProps);
  }
}

// Singleton instance
export const logger = new Logger();

