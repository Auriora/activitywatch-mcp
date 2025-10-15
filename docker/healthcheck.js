#!/usr/bin/env node

import http from 'node:http';

// Lightweight health check for Docker healthcheck
// Exits 0 if the HTTP server reports healthy (status 200), otherwise exits 1.
// Honors MCP_PORT env var (defaults to 3000). Uses a short timeout to fail fast.

const port = Number(process.env.MCP_PORT) || 3000;
const options = {
  hostname: '127.0.0.1',
  port,
  path: '/health',
  method: 'GET',
  timeout: 4000, // ms, keep lower than healthcheck timeout in compose
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  // We expect the app to return 200 when healthy, 503 when unhealthy.
  // Healthcheck should only pass on 200.
  const ok = res.statusCode === 200;

  // Drain response to allow proper socket cleanup
  res.on('data', () => {});
  res.on('end', () => process.exit(ok ? 0 : 1));
});

req.on('timeout', () => {
  req.destroy(new Error('Healthcheck request timed out'));
});

req.on('error', () => process.exit(1));

req.end();
