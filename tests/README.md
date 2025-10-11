# Test Suite

This directory contains the test suite for the ActivityWatch MCP Server.

## Structure

```
tests/
├── unit/           # Unit tests for individual functions and classes
├── integration/    # Integration tests for service interactions
├── e2e/           # End-to-end tests for complete workflows
├── fixtures/      # Test data and mock responses
└── helpers/       # Test utilities and helper functions
```

## Test Types

### Unit Tests (`tests/unit/`)
Tests for individual functions, classes, and utilities in isolation.

**Examples:**
- `utils/cache.test.ts` - Cache utility tests
- `utils/type-guards.test.ts` - Type guard function tests
- `utils/time.test.ts` - Time utility tests
- `utils/filters.test.ts` - Filter and normalization tests

**Characteristics:**
- Fast execution
- No external dependencies
- Mocked dependencies
- High code coverage

### Integration Tests (`tests/integration/`)
Tests for interactions between multiple components and services.

**Examples:**
- `services/query-builder.test.ts` - Query builder service tests
- `services/capabilities.test.ts` - Capabilities service tests
- `services/unified-activity.test.ts` - Unified activity service tests

**Characteristics:**
- Medium execution time
- May use mocked HTTP client
- Tests service interactions
- Validates data flow

### End-to-End Tests (`tests/e2e/`)
Tests for complete workflows from MCP client to ActivityWatch server.

**Examples:**
- `mcp-server.test.ts` - Full MCP server lifecycle tests
- `tool-calls.test.ts` - Complete tool call workflows

**Characteristics:**
- Slower execution
- May require running ActivityWatch server
- Tests complete user scenarios
- Validates entire system

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run e2e tests only
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## Writing Tests

### Naming Conventions

- Test files: `*.test.ts` or `*.spec.ts`
- Test suites: `describe('ComponentName', () => { ... })`
- Test cases: `it('should do something', () => { ... })` or `test('does something', () => { ... })`

### Example Unit Test

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

### Example Integration Test

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyService } from '@/services/my-service';
import { MockClient } from '@tests/helpers/mock-client';

describe('MyService', () => {
  let service: MyService;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = new MockClient();
    service = new MyService(mockClient);
  });

  it('should fetch and process data', async () => {
    mockClient.setResponse({ data: 'test' });
    const result = await service.getData();
    expect(result).toEqual({ processed: 'test' });
  });
});
```

## Test Fixtures

Place mock data and test fixtures in `tests/fixtures/`:

```typescript
// tests/fixtures/events.ts
export const mockWindowEvent = {
  id: 1,
  timestamp: '2025-01-01T00:00:00Z',
  duration: 60,
  data: {
    app: 'Chrome',
    title: 'Test Page',
  },
};
```

## Test Helpers

Place reusable test utilities in `tests/helpers/`:

```typescript
// tests/helpers/mock-client.ts
export class MockActivityWatchClient {
  private responses: Map<string, any> = new Map();

  setResponse(key: string, response: any) {
    this.responses.set(key, response);
  }

  async getBuckets() {
    return this.responses.get('buckets') || [];
  }
}
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Clarity**: Test names should clearly describe what is being tested
3. **Coverage**: Aim for high code coverage, especially for critical paths
4. **Speed**: Keep unit tests fast; use mocks for external dependencies
5. **Maintainability**: Keep tests simple and easy to understand
6. **DRY**: Use fixtures and helpers to avoid duplication
7. **Assertions**: Use specific assertions (e.g., `toBe` vs `toEqual`)
8. **Async**: Always await async operations and use proper async test patterns

## Continuous Integration

Tests are automatically run on:
- Pre-commit (via git hooks, if configured)
- Pull requests
- Main branch commits

## Coverage Reports

Coverage reports are generated in:
- `coverage/` directory (HTML report)
- Console output (text summary)
- CI/CD pipeline (for tracking trends)

## Troubleshooting

### Tests timing out
- Increase `testTimeout` in `vitest.config.ts`
- Check for unresolved promises
- Ensure mocks are properly configured

### Flaky tests
- Check for race conditions
- Ensure proper cleanup in `afterEach`
- Avoid relying on timing

### Import errors
- Check path aliases in `vitest.config.ts`
- Ensure TypeScript configuration is correct
- Verify file extensions (.js vs .ts)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [TypeScript Testing Guide](https://www.typescriptlang.org/docs/handbook/testing.html)

