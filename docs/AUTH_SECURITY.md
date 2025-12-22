# Authentication Security Guide

Production-grade authentication with industry-standard security practices.

> **Architecture:** Stateless access JWTs + secure refresh token rotation with reuse detection and global revocation. This design follows best practices used by **Auth0**, **AWS Cognito**, and **Firebase Auth**.

> **See also:** [Authentication Guide](./AUTHENTICATION.md) for API reference, endpoints, and usage examples.

---

## Threat Model

This auth system explicitly mitigates:

| Threat                           | Mitigation                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Stolen refresh token**         | Token rotation — stolen token becomes invalid after single use; reuse triggers global session revocation |
| **Long-lived access compromise** | Short-lived access tokens (15min) limit exposure window                                                  |
| **Replay attacks**               | Single-use refresh tokens; each refresh generates new token pair                                         |
| **Database token leaks**         | All tokens hashed before storage (HMAC-SHA256 with derived keys)                                         |
| **Password database breach**     | bcrypt hashing with configurable salt rounds                                                             |
| **Brute force attacks**          | Rate limiting (5 requests/15min on auth endpoints)                                                       |
| **Email enumeration**            | Consistent responses for existing/non-existing emails                                                    |
| **Cross-site request forgery**   | CSRF tokens for OAuth state; SameSite cookies                                                            |

---

## What's Included ✅

### Password Security

- **bcrypt hashing** with configurable salt rounds (default: 10)
- Minimum 8-character password validation
- Passwords never logged or exposed in API responses

### JWT Tokens

- Separate **access tokens** (15min) and **refresh tokens** (7 days)
- Refresh token **rotation** — each use generates a new token
- **Reuse detection** — if a rotated token is used, all sessions are terminated
- Access and refresh tokens use different secrets

### OAuth

- **PKCE** (Proof Key for Code Exchange) for Google OAuth (S256 method)
- **CSRF protection** via cryptographically secure state parameter
- **Atomic delete operations** - State and OTC burned after reading (single-use)
- **Short TTLs** - State: 5 minutes, OTC: 30 seconds
- **Redirect URI whitelist** - Prevents open redirect vulnerabilities
- **Account linking** - Automatically links OAuth to existing users with same email
- ⚠️ **Multi-instance deployment**: Default `LocalOAuthStore` uses in-memory cache - not suitable for load-balanced production. Use Redis or distributed cache (see [DEPLOYMENT.md](./DEPLOYMENT.md#oauth-store-for-multi-instance-deployments))

### Rate Limiting

- **5 requests/15min** on auth endpoints (login, register, forgot-password, verify-email)
- **20 requests/15min** on sensitive operations (refresh)
- **100 requests/15min** on general API endpoints
- **1000 requests/15min** on public API endpoints
- Automatic IP extraction from `X-Forwarded-For` (trust proxy enabled)
  NOTE: These are sensible 'default' values, feel free to modify to your specefic needs.

### Password Reset

- Secure random tokens (256-bit, URL-safe base64)
- Tokens hashed before storage (HMAC-SHA256 with derived key)
- Single-use tokens with configurable expiry (default: 1 hour)
- All sessions invalidated on password change
- Email enumeration prevention (consistent responses)

### Email Verification

- Verification email sent automatically on registration
- Secure random tokens (256-bit, URL-safe base64)
- Tokens hashed before storage (never stored in plain text)
- `requireVerifiedEmail` middleware for protected routes
- Resend endpoint with enumeration prevention

---

## Production Checklist

### 1. Generate Strong Secrets (Required)

**Never use the example secrets in production.** Generate new ones:

```bash
# Generate 256-bit secrets (recommended minimum)
openssl rand -base64 32 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set in your environment:

```env
JWT_ACCESS_SECRET=<generated-secret-1>
JWT_REFRESH_SECRET=<generated-secret-2>
```

⚠️ **Important:** Access and refresh secrets MUST be different.

### 2. Enable HTTPS (Required)

The auth system uses secure, HTTP-only cookies for OAuth state. These require HTTPS in production.

**Options:**

- **Cloudflare** - Free SSL, just proxy your domain
- **nginx** - Use Let's Encrypt with certbot
- **Platform SSL** - Railway, Render, Vercel handle this automatically

### 3. Configure CORS (Required)

Lock down CORS to your frontend domain:

```env
# Single domain
CORS_ORIGIN=https://yourdomain.com

# Multiple domains
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

### 4. Review Rate Limits (Recommended)

Current defaults in `src/common/middlewares/rate-limit.ts`:

| Endpoint Type          | Limit | Window |
| ---------------------- | ----- | ------ |
| Auth (login, register) | 5     | 15 min |
| Sensitive (refresh)    | 20    | 15 min |
| Standard API           | 100   | 15 min |
| Public                 | 1000  | 15 min |

Adjust based on your expected traffic:

```typescript
// Example: More lenient for high-traffic app
export const strictRateLimit = createRateLimiter({
  max: 10, // Was 5
  windowMs: 15 * 60 * 1000,
});
```

---

## Scaling Considerations

### Multiple Servers / Load Balancing

If you deploy to multiple servers (Kubernetes, AWS ECS, etc.), the **in-memory rate limiter's effectiveness is reduced**. Each server maintains its own independent counter, so the actual rate limit is multiplied by the number of instances.

**Example:** With 3 server instances and a 5 requests/15min limit:

- Each instance tracks requests separately
- An attacker could make up to **15 requests/15min** (5 per instance)
- The rate limit effectively becomes 3× higher

**When is this acceptable?**

- **Small deployments (2-3 instances):** If you're okay with 2-3× the configured limit, the in-memory limiter works fine
- **Low-risk endpoints:** For general API endpoints, slightly higher limits may be acceptable
- **Internal APIs:** If your API isn't publicly exposed, the risk is lower

**When should you use Redis?**

- **High instance count (5+ servers):** Limits become too permissive
- **High-security endpoints:** Auth endpoints should maintain strict limits
- **DDoS protection:** Need consistent rate limiting across all instances
- **Public APIs:** When protecting against abuse is critical

**Solution:** Use Redis for rate limiting:

```bash
pnpm add rate-limit-redis ioredis
```

```typescript
// src/common/middlewares/rate-limit.ts
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export const strictRateLimit = createRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  store: new RedisStore({
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
});
```

### Database Token Cleanup

Expired tokens are automatically cleaned up by a cron job running every hour. This is handled in `src/core/cron/index.ts`.

For serverless deployments (Vercel, AWS Lambda) where cron jobs don't run:

- Use an external cron service (cron-job.org, AWS EventBridge)
- Or create an API endpoint that your cron service calls

---

## Security Features Explained

### Why Refresh Token Rotation?

If an attacker steals a refresh token:

1. They use it → get new tokens, old one is invalidated
2. Real user tries to refresh → fails (token was rotated)
3. System detects this → terminates ALL sessions for that user

The attacker's window is limited, and the user is notified (forced to re-login).

### Why Hash Password Reset Tokens?

If your database is compromised:

- Hashed tokens are useless to attackers
- They can't forge password reset links
- Users' accounts remain protected

### Why Trust Proxy?

Behind a reverse proxy (nginx, Cloudflare, load balancer), Express sees the proxy's IP, not the client's. `trust proxy` tells Express to read the real IP from `X-Forwarded-For`.

Without it: Rate limiting would apply to the proxy IP, affecting all users.

### Why Separate JWT Secrets?

If access secret is compromised:

- Attacker can forge access tokens (15min window)
- They CANNOT forge refresh tokens (different secret)
- Damage is limited

---

## Common Questions

### Can I use sessions instead of JWTs?

Yes, but you'd need to:

1. Add Redis for session storage (required for multiple servers)
2. Replace `TokenService` with session logic
3. Update auth middleware

JWTs are chosen because they're stateless and scale easily.

### How do I add 2FA?

The template doesn't include 2FA, but you can add it:

1. Add `totpSecret` field to User model
2. Use `speakeasy` or `otplib` package
3. Add verification step after password check in login

### How do I enforce email verification?

Email verification is already implemented. To require it for certain routes:

```typescript
import { authenticate, requireVerifiedEmail } from "@/common/middlewares/auth";

// Require verified email for sensitive actions
router.post("/payments", authenticate, requireVerifiedEmail, createPayment);
```

Users without verified emails will receive a `403 ERR_EMAIL_NOT_VERIFIED` error.

### What about expired token cleanup?

The system automatically cleans up expired tokens via a cron job that runs **every hour** (at minute 0).

This job:

- Deletes expired refresh tokens from the database
- Deletes expired password reset tokens
- Deletes expired email verification tokens
- Runs automatically in all environments except `test` (or when cron is disabled)

The job is defined in `src/core/cron/index.ts` and initialized during app startup. No manual intervention required.

**For production deployments:** If running multiple instances, the cron job will run on each instance. This is safe (idempotent), but you may want to configure a single instance to run cron jobs or use a dedicated cron service like AWS EventBridge or Kubernetes CronJobs.

---

## Audit Log

Security-relevant events are logged:

- Failed login attempts
- Token refresh/rotation
- Password reset requests
- OAuth logins

Logs include request ID for tracing. In production, ship logs to a centralized service (Datadog, Logtail, etc.).
