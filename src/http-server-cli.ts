/* istanbul ignore file */
import { createHttpServer } from './http-server.js';
import { logStartupDiagnostics } from './utils/health.js';
import { logger } from './utils/logger.js';

export async function runHttpServerCli(): Promise<void> {
  const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3000;
  const defaultServer = createHttpServer({ enableResourceLogging: true });
  logStartupDiagnostics(defaultServer.getAwUrl());

  const server = defaultServer.app.listen(MCP_PORT, () => {
    logger.info(`ActivityWatch MCP HTTP server listening on port ${MCP_PORT}`);
    logger.info(`Health check available at http://localhost:${MCP_PORT}/health`);
    logger.info(`MCP endpoint at http://localhost:${MCP_PORT}/mcp`);
    logger.info(`ActivityWatch URL: ${defaultServer.getAwUrl()}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${MCP_PORT} is already in use. Please stop the other process or use a different port.`);
    } else {
      logger.error('Server error', error);
    }
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception - server will exit', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection - server will exit', { reason, promise });
    process.exit(1);
  });

  const gracefulShutdown = async (reason: string) => {
    logger.info(`Shutting down server due to ${reason}...`);

    await defaultServer.closeAllSessions(reason);
    await defaultServer.resetSharedServer();

    server.close(() => {
      logger.info('Server shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runHttpServerCli().catch(error => {
    logger.error('Failed to start HTTP server CLI', error);
    process.exit(1);
  });
}
