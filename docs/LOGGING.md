# Logging Guide

DreamStack uses **Pino**, a high-performance JSON logger with automatic request and user context tracking.

---

## Quick Start

```typescript
import { logger } from "@/core/logger";

// Simple logging
logger.info("User created successfully");
logger.warn("Rate limit approaching");
logger.error("Database connection failed");

// With metadata
logger.info("User login", {
  email: "user@example.com",
  provider: "google",
});

// Error logging
try {
  await riskyOperation();
} catch (error) {
  logger.error("Operation failed", error);
}
```

---

## Log Levels

| Level   | Method           | Use Case                |
| ------- | ---------------- | ----------------------- |
| `trace` | `logger.trace()` | Very detailed debugging |
| `debug` | `logger.debug()` | Debug information       |
| `info`  | `logger.info()`  | Informational messages  |
| `warn`  | `logger.warn()`  | Warning conditions      |
| `error` | `logger.error()` | Error conditions        |
| `fatal` | `logger.fatal()` | Critical failures       |

**Configure via environment:**

```env
LOG_LEVEL=info   # Production (default)
LOG_LEVEL=debug  # Development
LOG_LEVEL=trace  # Troubleshooting
```

---

## Context-Aware Logging

Logs within request handlers **automatically include `reqId` and `userId`** via AsyncLocalStorage:

```typescript
// In a controller or service
export class UserService {
  async updateProfile(userId: string, data: UpdateProfileDto) {
    // Context automatically added - no manual setup needed
    logger.info("Updating user profile", { changes: data });

    const user = await this.userRepository.update(userId, data);
    logger.info("Profile updated successfully");

    return user;
  }
}
```

**Output:**

```json
{
  "level": "info",
  "reqId": "req-abc-123", // ← Automatically added
  "userId": "user-456", // ← Automatically added
  "changes": { "firstName": "Jane" },
  "msg": "Updating user profile"
}
```

> **How it works:** Request context middleware stores `reqId` and `userId` in AsyncLocalStorage, making it available to all code executed during that request without manual propagation.

---

## Security: Automatic Redaction

Sensitive data is automatically redacted:

**Redacted Fields:**

- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.password`, `req.body.newPassword`, `req.body.currentPassword`
- `*.password`, `*.passwordHash`, `*.authorization`

**Example:**

```typescript
logger.info("Login attempt", {
  email: "user@example.com",
  password: "SecurePass123!", // ← Becomes [REDACTED]
});
```

> **Configuration:** See `src/core/logger/index.ts` for the complete redaction list.

---

## Development vs Production

**Development** (`NODE_ENV=development`):

- Pretty formatted logs via pino-colada
- Colorized output
- Human-readable

```bash
16:09:19 ✨ incoming request GET /v1/users/me
16:09:19 ✨ request completed 45ms
```

**Production** (`NODE_ENV=production`):

- Structured JSON logs
- Machine-parseable
- Integrates with Datadog, CloudWatch, Elasticsearch, Sentry

```json
{"level":"info","time":"2024-01-01T16:09:19.000Z","service":"dreamstack","reqId":"abc","msg":"incoming request","method":"GET","url":"/v1/users/me"}
{"level":"info","time":"2024-01-01T16:09:19.045Z","service":"dreamstack","reqId":"abc","msg":"request completed","duration":45}
```

---

## Advanced Usage

### Custom Service Name

```env
SERVICE_NAME=my-api
```

All logs will include:

```json
{
  "service": "my-api",
  "msg": "..."
}
```

### Performance Logging

```typescript
const start = Date.now();
await expensiveOperation();
const duration = Date.now() - start;
logger.info("Operation completed", { duration, operation: "dataExport" });
```

### Conditional Logging

```typescript
// Only log slow queries
const queryTime = Date.now() - start;
if (queryTime > 100) {
  logger.warn("Slow database query", { query: sql, duration: queryTime });
}
```

### Child Loggers

```typescript
import { baseLogger } from "@/core/logger";

const moduleLogger = baseLogger.child({ module: "payment-processor" });
moduleLogger.info("Processing payment");
// Output: {"module":"payment-processor","msg":"Processing payment"}
```

---

## HTTP Request Logging

HTTP requests are logged automatically by both Express (pino-http) and Hono (custom middleware):

```typescript
// Incoming request
{"level":"info","req":{"method":"GET","url":"/v1/users"},"msg":"incoming request"}

// Response log
{"level":"info","res":{"statusCode":200},"responseTime":45,"msg":"request completed"}
```

**Framework selection:**

```env
FRAMEWORK=express  # or hono
```

---

## Best Practices

### ✅ DO

```typescript
// Use appropriate levels and structured data
logger.info("User logged in", { userId });
logger.error("Database connection failed", error);
logger.warn("Rate limit exceeded", { userId, endpoint: "/api/users", limit: 100 });
```

**❌ DON'T:**

```typescript
console.log("User logged in"); // ❌ Use logger.info()
logger.info(`User ${userId} logged in`); // ❌ Use metadata: logger.info('...', { userId })

// Don't over-log in loops
for (const item of items) {
  logger.debug("Processing item", item); // ❌
}
logger.debug("Processing items", { count: items.length }); // ✅
```

---

## Integration & Troubleshooting

### Sentry Error Tracking

```env
SENTRY_DSN=https://xxx@sentry.io/xxx
```

Errors are automatically logged **and** sent to Sentry (if configured).

### Log Aggregation (Production)

Production JSON logs integrate with:

- **CloudWatch** (AWS EC2 stdout)
- **Datadog** (via agent)
- **Elasticsearch** (Filebeat/Fluentd)

### Common Issues

**Logs not appearing:**

- Check `LOG_LEVEL` in `.env` (default: `info`)

**Pretty logs not working:**

- Ensure `NODE_ENV=development` and using `pnpm dev`

**Too many logs:**

- Increase log level: `LOG_LEVEL=warn` or `LOG_LEVEL=error`

**Missing reqId/userId:**

- Context only available within HTTP requests
- For scripts/cron, use `baseLogger` directly:
  ```typescript
  import { baseLogger } from "@/core/logger";
  baseLogger.info("Cron job started", { job: "daily-cleanup" });
  ```

---

## Summary

**Quick Reference:**

- Import: `import { logger } from '@/core/logger';`
- Levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- Usage: `logger.info(message, metadata?)` or `logger.error(message, error)`
- Config: `LOG_LEVEL` env var
- Context: `reqId` and `userId` auto-added in requests
- Security: Sensitive fields auto-redacted

**Common Patterns:**

```typescript
logger.info("Operation completed");
logger.info("User created", { userId, email });
logger.error("Database error", error);
logger.info("Query executed", { duration: Date.now() - start });
```
