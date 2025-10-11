# Testing Guide

Last updated: October 11, 2025

This guide explains the testing infrastructure and best practices for the ActivityWatch MCP Server.

## Overview

The project uses **Vitest** as the testing framework, chosen for its:
- Native TypeScript support
- Fast execution with ES modules
- Excellent developer experience
- Built-in coverage reporting
- Compatible with Vite ecosystem

## Test Structure

```
tests/
├── unit/              # Unit tests for individual functions
│   └── utils/         # Utility function tests
│       ├── cache.test.ts
│       ├── type-guards.test.ts
│       └── time.test.ts
├── integration/       # Service integration tests
│   └── query-builder.test.ts
├── e2e/              # End-to-end MCP server tests
│   └── mcp-server.test.ts
├── helpers/          # Test utilities
│   └── mock-client.ts
├── fixtures/         # Test data
└── README.md         # Detailed testing documentation
```

## Running Tests

### All Tests
```bash
npm test
```

### By Type
```bash
# Unit tests only (fast, no dependencies)
npm run test:unit

# Integration tests (mocked dependencies)
npm run test:integration

# E2E tests (requires ActivityWatch running)
npm run test:e2e
```

### Development
```bash
# Watch mode - reruns tests on file changes
npm run test:watch

# Interactive UI
npm run test:ui

# Coverage report
npm run test:coverage
```

## Writing Tests

### Unit Tests

Unit tests verify individual functions in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/utils/my-utility';

describe('myFunction', () => {
  it('should return expected value', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge cases', () => {
    expect(myFunction('')).toBe('');
    expect(myFunction(null)).toBeNull();
  });
});
```

**Best Practices:**
- Test one function/class per file
- Use descriptive test names
- Test both happy path and edge cases
- Mock external dependencies
- Keep tests fast (< 100ms each)

### Integration Tests

Integration tests verify interactions between components:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyService } from '@/services/my-service';
import { MockActivityWatchClient } from '@tests/helpers/mock-client';

describe('MyService Integration', () => {
  let service: MyService;
  let mockClient: MockActivityWatchClient;

  beforeEach(() => {
    mockClient = new MockActivityWatchClient();
    service = new MyService(mockClient as any);
  });

  it('should fetch and process data', async () => {
    mockClient.setResponse('test-data', { value: 123 });
    const result = await service.getData();
    expect(result).toEqual({ processed: 123 });
  });
});
```

**Best Practices:**
- Use mock implementations for external services
- Test service interactions
- Verify data flow between components
- Test error handling
- Keep tests reasonably fast (< 1s each)

### E2E Tests

E2E tests verify complete workflows:

```typescript
import { describe, it, expect } from 'vitest';

describe.skipIf(process.env.SKIP_E2E === 'true')('MCP Server E2E', () => {
  it('should handle complete workflow', async () => {
    // Start server, send requests, verify responses
  });
});
```

**Best Practices:**
- Test complete user scenarios
- Use real ActivityWatch server when possible
- Make tests skippable for CI/CD
- Clean up resources in afterAll
- Accept slower execution (< 10s each)

## Test Helpers

### Mock Client

Use `MockActivityWatchClient` for testing services:

```typescript
import { MockActivityWatchClient, createMockBucket } from '@tests/helpers/mock-client';

const mockClient = new MockActivityWatchClient();

// Set up mock buckets
mockClient.setBuckets([
  createMockBucket('aw-watcher-window_test', 'currentwindow'),
]);

// Set up mock events
mockClient.setEvents('aw-watcher-window_test', [
  createMockEvent('2025-01-01T00:00:00Z', 60, { app: 'Chrome' }),
]);

// Set up mock query responses
mockClient.setQueryResponse('query-string', { result: 'data' });
```

### Test Fixtures

Create reusable test data in `tests/fixtures/`:

```typescript
// tests/fixtures/events.ts
export const mockWindowEvents = [
  { timestamp: '2025-01-01T00:00:00Z', duration: 60, data: { app: 'Chrome' } },
  { timestamp: '2025-01-01T00:01:00Z', duration: 120, data: { app: 'VS Code' } },
];
```

## Coverage

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage Targets

The project aims for:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Excluded from Coverage

- `node_modules/`
- `dist/`
- `tests/`
- Test files (`*.test.ts`, `*.spec.ts`)
- Configuration files

## Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Pre-commit hooks (if configured)

### CI Configuration

E2E tests are skipped in CI by default. To enable:

```yaml
# .github/workflows/test.yml
env:
  SKIP_E2E: false
  AW_URL: http://localhost:5600
```

## Debugging Tests

### VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:watch"],
  "console": "integratedTerminal"
}
```

### Command Line

```bash
# Run specific test file
npx vitest run tests/unit/utils/cache.test.ts

# Run tests matching pattern
npx vitest run -t "cache"

# Debug with Node inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

## Common Issues

### Tests Timing Out

**Problem**: Tests exceed timeout limit

**Solution**:
```typescript
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

Or update `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    testTimeout: 10000,
  },
});
```

### Import Errors

**Problem**: Cannot resolve module paths

**Solution**: Check path aliases in `vitest.config.ts`:
```typescript
resolve: {
  alias: {
    '@': resolve(__dirname, './src'),
    '@tests': resolve(__dirname, './tests'),
  },
}
```

### Flaky Tests

**Problem**: Tests pass/fail inconsistently

**Solutions**:
- Use `vi.useFakeTimers()` for time-dependent tests
- Ensure proper cleanup in `afterEach`
- Avoid relying on execution order
- Mock random/time-based values

## Best Practices

1. **Test Naming**: Use descriptive names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests clearly
3. **One Assertion**: Focus each test on one behavior
4. **Fast Tests**: Keep unit tests under 100ms
5. **Isolated Tests**: Each test should be independent
6. **Mock External**: Mock all external dependencies
7. **Clean Up**: Use `beforeEach`/`afterEach` for setup/teardown
8. **Type Safety**: Leverage TypeScript in tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Test README](../../tests/README.md)

