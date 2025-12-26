# Rate Limiting

DreamStack provides production-ready rate limiting with framework-agnostic middleware that works with both Express and Hono.

> **Framework-Agnostic**: Automatically detects your HTTP framework and uses the appropriate implementation.

---

## Quick Start

```typescript
import { strictRateLimit, moderateRateLimit } from "@/common/middlewares/rate-limit";

// In your route file
router.post("/login", strictRateLimit, validate({ body: loginSchema }), login);
```

---

## Pre-configured Rate Limiters

| Limiter      | Rate         | Use Case                                            |
| ------------ | ------------ | --------------------------------------------------- |
| **Strict**   | 5 / 15min    | Authentication (login, register, forgot-password)   |
| **Moderate** | 20 / 15min   | Sensitive operations (reset-password, verify-email) |
| **Standard** | 100 / 15min  | General API endpoints (CRUD, user updates)          |
| **Generous** | 1000 / 15min | Public/high-traffic (health checks, public data)    |

```typescript
import {
  strictRateLimit,
  moderateRateLimit,
  standardRateLimit,
  generousRateLimit,
} from "@/common/middlewares/rate-limit";

router.post("/login", strictRateLimit, loginController);
router.post("/reset-password", moderateRateLimit, resetController);
router.get("/users", standardRateLimit, listUsersController);
router.get("/health", generousRateLimit, healthCheckController);
```

---

## Production Guidance

**Design Philosophy:**

- Defaults target typical SaaS/MVP traffic: authenticated API consumers, single-page apps, and mobile clients (not high-throughput streaming).
- Limits are conservative starting points. Tune by route, identity (per-user/API-key), and IP in production.
- Runtime logic lives in adapters so you can swap in Redis-backed sliding windows or token-bucket implementations for scale.

**Best Practices:**

1. **Apply Stricter Limits to Auth Endpoints**
   - Use `strictRateLimit` for `/login`, `/register`, `/forgot-password`
   - Combine with per-IP limits (e.g., 50/15min) and account lockout after repeated failures
   - Consider escalating to CAPTCHA/MFA after threshold

2. **Use Both Per-IP and Per-Identity Limits**
   - **Per-IP**: Protects anonymous abuse and DDoS attempts
   - **Per-Identity**: Protects credential stuffing and account takeover
   - Implement different tiers for authenticated vs anonymous users

3. **Layer Short and Long Windows**
   - **Short windows** (1min): Burst protection against rapid-fire attacks
   - **Long windows** (15min/1h): Sustained abuse protection
   - Consider token-bucket algorithm for smooth burst handling

4. **Store Counters in Redis for Multi-Instance Deployments**
   - In-memory stores (default) don't work across multiple server instances
   - Use Redis with TTL matching window size (auto-expiration)
   - Key format: `rate:{env}:{route}:{identity}` (e.g., `rate:prod:/login:ip:1.2.3.4`)

5. **Expose Headers and Track Metrics**
   - Return `RateLimit-*` headers (limit, remaining, reset)
   - Return `Retry-After` header when throttled
   - Monitor 429 response spikes in APM/logging (indicates attack or misconfiguration)

**Middleware Order:**

```typescript
// ✅ Correct: Rate limit BEFORE validation (cheaper operation first)
router.post("/login", strictRateLimit, validate({ body: schema }), login);

// ❌ Wrong: Expensive validation runs before rate limiting
router.post("/login", validate({ body: schema }), strictRateLimit, login);
```

> **Reference:** See `src/common/middlewares/rate-limit.ts` for implementation details.

---

## Custom Rate Limiters

Create custom rate limiters with `createRateLimiter()`:

```typescript
import { createRateLimiter } from "@/common/middlewares/rate-limit";

const customLimiter = createRateLimiter({
  max: 50,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: "Too many requests, please try again in an hour.",
});

router.post("/api/heavy-operation", customLimiter, controller);
```

**Options:**

```typescript
interface RateLimitOptions {
  max?: number; // Default: 100
  windowMs?: number; // Default: 15 * 60 * 1000 (15 minutes)
  message?: string; // Default: "Too many requests, please try again later."
  skip?: (req) => boolean; // Skip for specific requests
}
```

**Skip Example:**

```typescript
const apiLimiter = createRateLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000,
  skip: (req) => req.ip === "127.0.0.1", // Skip localhost
});
```

---

## Response Headers & Errors

**Headers:**

```http
RateLimit-Limit: 5
RateLimit-Remaining: 3
RateLimit-Reset: 1638360000
Retry-After: 900  # Seconds until retry (when throttled)
```

> Adapters emit both modern `RateLimit-*` and legacy `X-RateLimit-*` headers for compatibility.

**Error Response (429):**

```json
{
  "statusCode": 429,
  "message": "Too many authentication attempts. Please try again in 15 minutes.",
  "code": "ERR_RATE_LIMIT_EXCEEDED"
}
```

---

## Advanced Patterns

### Per-User Rate Limiting (Redis Required)

```typescript
const perUserLimiter = createRateLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000,
  // Requires Redis store implementation with user ID from req.ctx
});

// Apply AFTER authentication
router.get("/api/data", authenticate, perUserLimiter, getData);
```

**Redis Key Format:**

```
rate:{env}:{route}:{identity}
```

Examples:

- `rate:production:/api/data:user:acct_abc123`
- `rate:staging:/login:ip:1.2.3.4`

Use `env` to isolate environments, `route` to scope limits, and `identity` for user ID, API key, or IP.

### Dynamic Rate Limits (Tiered Plans)

```typescript
function createTieredRateLimiter() {
  return async (req, res, next) => {
    const user = req.ctx.user;
    const limiter =
      user?.tier === "premium"
        ? createRateLimiter({ max: 1000, windowMs: 15 * 60 * 1000 })
        : createRateLimiter({ max: 100, windowMs: 15 * 60 * 1000 });

    return limiter(req, res, next);
  };
}
```

---

## Testing

**Simulate Rate Limiting:**

```bash
# Test strict limit (5 requests)
for i in {1..10}; do curl -X POST http://localhost:8000/auth/login; done
```

**Monitor Rate Limit Hits:**

```typescript
const strictWithLogging = createRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  skip: (req) => {
    if (req.ip && suspiciousIPs.includes(req.ip)) {
      logger.warn("Rate limit attempt from suspicious IP", { ip: req.ip });
    }
    return false;
  },
});
```

---

## Architecture

**How It Works:**

1. **Framework Detection**: Auto-detects from `process.env.FRAMEWORK` (Express or Hono)
2. **Lazy Loading**: Adapter loaded only when first rate limiter is created
3. **Raw Middleware**: Express adapter marks middleware with `__expressMiddleware` flag
4. **No Double-Wrapping**: ExpressAdapter skips wrapping for flagged middleware

**Switching Frameworks:**

```bash
export FRAMEWORK=hono  # or express
```

The rate limiting utility automatically uses the correct adapter without code changes.

---

## Related Documentation

- [Authentication](./AUTHENTICATION.md)
- [File Uploads](./FILE_UPLOADS.md) - Similar adapter pattern
- [Framework Switching](./FRAMEWORK.md)
- [Error Handling](./ARCHITECTURE.md#error-handling)
