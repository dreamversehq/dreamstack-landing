# Testing Guide

Comprehensive testing guide for DreamStack: unit tests, integration tests, and framework-specific testing strategies.

---

## Quick Start

```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode (auto-rerun on changes)
pnpm test:coverage     # Generate coverage report
pnpm test users        # Run specific test pattern
```

---

## Test Scripts

| Command                 | Description              | Use Case                    |
| ----------------------- | ------------------------ | --------------------------- |
| `pnpm test`             | Run all tests in parallel | CI/CD, pre-commit checks   |
| `pnpm test:watch`       | Watch mode (auto-rerun)  | Active development, TDD     |
| `pnpm test:coverage`    | Generate coverage report | Coverage analysis           |
| `pnpm test:express`     | Test with Express        | Express-specific behavior   |
| `pnpm test:hono`        | Test with Hono           | Hono-specific behavior      |
| `pnpm test:both`        | Test both frameworks     | Pre-release validation      |
| `pnpm test:integration` | Integration tests only   | Full request/response cycle |

> **Parallel Testing:** Tests run in parallel by default using Jest's worker pool, significantly improving test execution speed. 

---

## Test Organization

## Test Organization

**Directory Structure:**

```
tests/
├── common/          # Shared utilities (email, storage)
├── core/            # Core infrastructure (HTTP, routing)
├── features/        # Business features (auth, users)
├── integration/     # End-to-end tests (prisma/, mongo/)
├── helpers/         # Test utilities (http-mocks.ts)
└── setup/           # Test configuration (global-teardown, DB setup)
```

**Test Types:**

| Type            | Pattern                 | Characteristics                                   | Speed       |
| --------------- | ----------------------- | ------------------------------------------------- | ----------- |
| **Unit**        | `*.test.ts`             | Isolated, mocked dependencies, framework-agnostic | Fast (< 1s) |
| **Integration** | `*.integration.test.ts` | Full HTTP cycle, real DB, framework-specific      | Slower      |

**Unit Test Example:**

```typescript
describe("UserService", () => {
  it("should hash password on create", async () => {
    const mockRepo = { create: jest.fn() };
    const service = new UserService(mockRepo);

    await service.createUser({ password: "plain" });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        passwordHash: expect.not.stringContaining("plain"),
      }),
    );
  });
});
```

**Integration Test Example:**

```typescript
describe("Auth Integration", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it("should register and login user", async () => {
    const res = await request(app).post("/v1/auth/register").send({ email: "test@example.com", password: "Pass123!" });

    expect(res.status).toBe(201);
    expect(res.body.data.access).toBeDefined();
  });
});
```

---

## Framework-Specific Testing

Tests read the `FRAMEWORK` environment variable from `.env`:

```env
FRAMEWORK=express  # Tests use Express adapter
FRAMEWORK=hono     # Tests use Hono adapter
```

**Framework-Agnostic (both frameworks):**

- Service layer (business logic)
- Repository (database operations)
- Utilities
- Middleware (when isolated)
- Controllers (when mocked)

**Framework-Specific (uses `.env` setting):**

- Integration tests (start HTTP server)
- End-to-end API tests
- Route registration
- HTTP adapter tests

**Testing Both Frameworks:**

```bash
# Option 1: Convenience script
pnpm test:both

# Option 2: Manual switching
echo "FRAMEWORK=express" > .env && pnpm test
echo "FRAMEWORK=hono" > .env && pnpm test

# Option 3: CI/CD matrix
strategy:
  matrix:
    framework: [express, hono]
steps:
  - run: echo "FRAMEWORK=${{ matrix.framework }}" > .env
  - run: pnpm test
```

---

## Database Testing

**Prisma (Default):**

- In-memory SQLite
- Fast, isolated, no external dependencies
- Automatic schema migration

```bash
pnpm test:integration -- prisma
```

**Mongoose:**

- In-memory MongoDB via mongodb-memory-server
- Isolated per test run
- No external MongoDB required

```bash
pnpm test:integration -- mongo
```

---

## Writing Tests

**File Naming:**

```
✅ user.service.test.ts          # Unit test
✅ auth.integration.test.ts      # Integration test
❌ user.spec.ts                  # Don't use .spec
❌ test-user-service.ts          # Don't prefix with 'test-'
```

**Test Structure (AAA Pattern):**

```typescript
describe("UserService", () => {
  let service: UserService;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepo = { findById: jest.fn(), create: jest.fn() } as any;
    service = new UserService(mockRepo);
  });

  describe("getUserById", () => {
    it("should return null when user not found", async () => {
      // Arrange
      mockRepo.findById.mockResolvedValue(null);

      // Act
      const result = await service.getUserById("123");

      // Assert
      expect(result).toBeNull();
      expect(mockRepo.findById).toHaveBeenCalledWith("123");
    });

    it("should throw on database error", async () => {
      // Arrange
      mockRepo.findById.mockRejectedValue(new Error("DB error"));

      // Act & Assert
      await expect(service.getUserById("123")).rejects.toThrow("DB error");
    });
  });
});
```

**Mocking:**

```typescript
// Mock service
const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue(true),
};

// Mock HTTP (use helpers)
import { mockRequest, mockResponse } from "@/tests/helpers/http-mocks";

const req = mockRequest({
  body: { email: "test@example.com" },
  ctx: { user: { id: "123", role: "USER" } },
});

const res = mockResponse();
await controller.getProfile(req, res);

expect(res.json).toHaveBeenCalledWith({
  status: "success",
  data: expect.any(Object),
});
```

---

## Code Coverage

```bash
pnpm test:coverage
```

**Output:**

```
File                      | % Stmts | % Branch | % Funcs | % Lines |
--------------------------|---------|----------|---------|---------|
All files                 |   85.32 |    76.45 |   82.11 |   85.89 |
 src/features/auth        |   92.15 |    85.71 |   90.00 |   92.68 |
 src/features/users       |   89.47 |    78.57 |   85.71 |   90.00 |
```

**View HTML Report:**

```bash
open coverage/index.html        # macOS
xdg-open coverage/index.html    # Linux
start coverage/index.html       # Windows
```

**Thresholds** (configured in `jest.config.js`):

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80,
  },
}
```

---

## Best Practices

**✅ DO:**

- Write tests as you code
- Test behavior, not implementation
- Use descriptive names: `it('should reject invalid email format')`
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies (database, email, APIs)
- Test edge cases (null, empty, boundaries)
- Keep tests isolated (no shared state)
- Test both success and failure paths

**❌ DON'T:**

- Test framework internals (Express/Hono)
- Test third-party libraries
- Use real external services (mock instead)
- Share mutable state (`beforeEach`, not `beforeAll`)
- Write flaky tests (avoid timeouts, random data)
- Test implementation details (test public API)
- Skip cleanup (`afterEach` for resources)

**Good Test Names:**

```typescript
it("should return 401 when token is expired");
it("should hash password before saving user");
it("should throw error when user not found");
```

**Bad Test Names:**

```typescript
it("works");
it("test login");
it("handles the thing");
```

---

## Debugging

**Run Single/Pattern Test:**

```bash
# Use jest directly for single tests
pnpm jest user.service
pnpm jest -t "should hash password"
pnpm jest tests/features/users/user.service.test.ts
```

**Debug Mode:**

```bash
# Node debugger (use --runInBand for sequential debugging)
node --inspect-brk node_modules/.bin/jest --runInBand
```

**VS Code Debugger** (add to `.vscode/launch.json`):

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

> **Note:** Tests run in parallel by default for better performance. The `--runInBand` flag is only needed for debugging to run tests sequentially.

**Common Issues:**

```typescript
// Timeout: increase for slow tests
it("should process large file", async () => {
  // ... test code
}, 10000); // 10 second timeout
```

```bash
# Database issues
rm -f prisma/test.db
pnpm prisma generate

# Module not found
pnpm jest --clearCache
pnpm build
```

---

## CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        framework: [express, hono]

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "pnpm"

      - run: pnpm install

      - name: Setup test environment
        run: |
          cp .env.example .env
          echo "FRAMEWORK=${{ matrix.framework }}" >> .env

      - run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System design patterns
- [Framework](./FRAMEWORK.md) - Framework-agnostic patterns
- [Authentication](./AUTHENTICATION.md) - Auth testing examples
