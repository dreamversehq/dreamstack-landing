# Deployment Guide

Production deployment guide for DreamStack. Brief, actionable steps for common platforms.

---

## Pre-Deployment Checklist

### 1. Environment Variables

✅ **Required:**

```env
NODE_ENV=production
PORT=8000

# Database (choose one)
DB_STRATEGY=prisma
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Secrets (generate new ones!)
JWT_ACCESS_SECRET=your-super-secret-production-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-production-key-min-32-chars

# CORS
CORS_ORIGIN=https://yourdomain.com
```

✅ **Optional (but recommended):**

```env
# OAuth (if using)
OAUTH_REDIRECT_WHITELIST=https://yourdomain.com,http://localhost:8000
APP_URL=https://yourdomain.com

GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
# Callback URL will be: https://yourdomain.com/v1/auth/oauth/google/callback

# Email (if using)
EMAIL_STRATEGY=postmark
POSTMARK_API_KEY=xxx
EMAIL_FROM=noreply@yourdomain.com

# Storage (if using)
STORAGE_STRATEGY=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=your-bucket

# Monitoring (recommended)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### 2. Database Setup

**PostgreSQL (Recommended for Production):**

```bash
# Create database
createdb your_app_production

# Run migrations
DATABASE_URL="postgresql://user:pass@host:5432/dbname" \
  pnpm prisma migrate deploy

# Verify
pnpm prisma db pull
```

**MongoDB:**

```bash
# No migrations needed
# Just set DATABASE_URL in .env
DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
```

### 3. OAuth Store for Multi-Instance Deployments

⚠️ **Critical for Production:**

The default `LocalOAuthStore` uses in-memory caching (`node-cache`) which is **fine for single server instances** but **does NOT work across multiple server instances**.

**Why this matters:**

- OAuth state and one-time codes (OTC) are stored in memory
- Each server instance has its own memory
- User may hit different servers during OAuth flow (authorize → callback → token exchange)
- This causes "Invalid state" or "Invalid OTC" errors in load-balanced/clustered deployments

**Solution: Implement a Distributed Cache Store**

**Recommended: Redis**

1. **Install Redis client:**

```bash
pnpm add ioredis
```

2. **Create Redis OAuth Store:**

```typescript
// src/features/auth/oauth/redis-oauth.store.ts
import Redis from "ioredis";
import { IOAuthStore } from "./oauth.types";

export class RedisOAuthStore implements IOAuthStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async getAndDelete<T>(key: string): Promise<T | null> {
    const pipeline = this.redis.pipeline();
    pipeline.get(key);
    pipeline.del(key);
    const results = await pipeline.exec();

    const value = results?.[0]?.[1];
    if (!value) return null;

    return JSON.parse(value as string) as T;
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

3. **Update auth.container.ts:**

```typescript
import { RedisOAuthStore } from './oauth/redis-oauth.store';

function createOAuthService(...): IOAuthService {
  const providers = new Map<OAuthProvider, IOAuthProvider>();

  // Use Redis instead of LocalOAuthStore in production
  const store = ENV.NODE_ENV === 'production' && ENV.REDIS_URL
    ? new RedisOAuthStore(ENV.REDIS_URL)
    : new LocalOAuthStore(); // Keep local for development

  // ... rest of setup
}
```

4. **Add to .env:**

```env
# Production
REDIS_URL=redis://default:password@redis-host:6379

# Or for Redis Cloud/Upstash
REDIS_URL=rediss://default:password@redis.cloud:6379
```

**Alternative: Other Distributed Stores**

- **Memcached**: Similar setup, implement `IOAuthStore` interface
- **Database**: Store in PostgreSQL/MongoDB with TTL (slower but simpler)
- **Cloud**: AWS ElastiCache, Google Cloud Memorystore, Azure Cache for Redis

**Development vs Production:**

- **Development**: `LocalOAuthStore` is fine (single instance)
- **Production**: Must use distributed store if running multiple instances

### 4. Security Hardening

✅ **Generate Strong Secrets:**

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Run twice for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
```

✅ **Update CORS:**

```env
# Lock down to your domain
CORS_ORIGIN=https://yourdomain.com
# OR multiple domains
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

✅ **Review Rate Limits:**

```typescript
// src/core/http/express/middlewares/security.ts
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Adjust for your needs
});
```

### 4. Build Application

```bash
# Install dependencies
pnpm install --prod

# Build TypeScript
pnpm build

# Verify build
ls -la dist/
```

---

## General Deployment Tips

### Running Migrations

After deploying your app, run database migrations:

```bash
# Prisma
pnpm prisma migrate deploy

# Or in your deployment platform's CLI/console
your-platform-cli run npx prisma migrate deploy
```

### Start Script

Ensure your `package.json` has a start script:

```json
{
  "scripts": {
    "start": "node dist/src/index.js"
  }
}
```

### Common Platforms

DreamStack works with any Node.js hosting platform:

- **Railway**, **Render**, **Fly.io** - Easy deployment with auto-scaling
- **Heroku** - Classic PaaS with addons ecosystem
- **AWS**, **GCP**, **Azure** - Full control with EC2/Compute instances
- **Vercel**, **Netlify** - Serverless (requires adapter configuration)
- **Docker** - Container-based deployment anywhere

> **Note:** Each platform has its own deployment workflow. Refer to your platform's documentation for specific deployment steps. Join our [Discord community](https://discord.gg/dreamstack) if you need deployment help.

---

## Monitoring

### Sentry (Error Tracking)

**1. Setup:**

```bash
# Already installed in template
```

**2. Configure:**

```env
SENTRY_DSN=https://xxx@sentry.io/xxx
```

**3. Verify:**

- Deploy app
- Trigger error
- Check Sentry dashboard

### Health Check Endpoint

Built-in at `GET /health`:

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

**Use for:**

- Load balancer health checks
- Monitoring services (UptimeRobot, Pingdom)
- CI/CD readiness checks

### Logs

**Railway/Render/Fly/DigitalOcean:**

- Built-in log viewers in dashboard

**PM2 (EC2):**

```bash
pm2 logs api          # View logs
pm2 logs --lines 100  # Last 100 lines
```

**Docker:**

```bash
docker-compose logs -f api
```

---

## Database Backups

### Automated Backups

**Railway/Render/Heroku:**

- Automatic daily backups included

**AWS RDS:**

- Enable automated backups (retention 7-35 days)
- Snapshots before major changes

### Manual Backups

**PostgreSQL:**

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

**MongoDB:**

```bash
# Backup
mongodump --uri="$DATABASE_URL" --out=backup/

# Restore
mongorestore --uri="$DATABASE_URL" backup/
```

---

## Troubleshooting

### Build Fails

**Error:** "Cannot find module"

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Error:** "Prisma Client not generated"

```bash
# Generate Prisma Client
pnpm prisma generate
```

### Database Connection

**Error:** "Can't reach database server"

```bash
# Check DATABASE_URL format
postgresql://USER:PASSWORD@HOST:PORT/DATABASE

# Test connection
pnpm prisma db pull
```

### Port Already in Use

**Error:** "EADDRINUSE: Port 8000 already in use"

```bash
# Find process
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3000 node dist/server.js
```

### JWT Errors

**Error:** "Invalid token"

- Check JWT_ACCESS_SECRET matches between instances
- Verify token hasn't expired
- Ensure no whitespace in secrets

---

## Performance Tips

### 1. Enable Compression

Already included in both Express and Hono adapters:

```typescript
// Express: src/core/http/express/express.adapter.ts
app.use(compression());

// Hono: src/core/http/hono/hono.adapter.ts
app.use("*", compress());
```

### 2. Database Connection Pooling

Prisma auto-manages the connection pool via the underlying DB driver. In most cases you don't need to manually open/close connections — Prisma reuses connections for queries. You can still tune it or use managed solutions for high-concurrency or serverless environments:

- Set a connection limit in the DATABASE_URL (Postgres):

```env
DATABASE_URL="postgresql://user:pass@host:5432/dbname?connection_limit=10"
```

- Use Prisma Data Proxy for serverless environments (reduces connection churn).
- For heavy workloads, put a connection pooler (PgBouncer) in front of Postgres.

Mongoose (MongoDB)

- Mongoose uses the MongoDB Node driver which also provides an internal connection pool and manages it automatically. You can configure pool sizing via connection options (modern driver uses maxPoolSize — older code used poolSize).
- Example:

```typescript
import mongoose from "mongoose";

await mongoose.connect(process.env.DATABASE_URL, {
  maxPoolSize: 20, // max connections in the pool
  minPoolSize: 0, // optional
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

- For serverless (lambdas), reuse a single mongoose connection across invocations (store on a global) to avoid excessive new connections.

Recommendations

- Monitor active connections and errors (e.g., "too many connections").
- Tune pool sizes based on DB capacity and app concurrency.
- Prefer a pooler (PgBouncer) or Prisma Data Proxy for serverless/horizontal scaling.
- For MongoDB, adjust maxPoolSize and reuse connections when possible.

### 3. Caching (Optional)

Add Redis for hot data:

```bash
# Install
pnpm add ioredis

# Use
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Cache user
await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
```

### 4. CDN for Avatars

Use S3 + CloudFront:

- Upload to S3
- Serve via CloudFront
- Cache avatars globally

---

## HTTP/2 Support

**Good news:** You don't need to implement HTTP/2 in your Node.js application! Modern deployment platforms and reverse proxies handle this automatically.

### How It Works

Your app runs HTTP/1.1 internally, but external clients get HTTP/2:

```
[Client] ←→ HTTP/2 ←→ [Reverse Proxy] ←→ HTTP/1.1 ←→ [Your Node.js App]
```

### Platform Support

**Cloudflare (Recommended):**

- Free HTTP/2 and HTTP/3 on all plans
- Automatic protocol negotiation
- No configuration needed
- Just add your domain to Cloudflare

**Nginx:**

```nginx
server {
  listen 443 ssl http2;  # Enable HTTP/2
  server_name yourdomain.com;

  location / {
    proxy_pass http://localhost:8000;  # Your Node.js app
    proxy_http_version 1.1;
  }
}
```

**AWS Application Load Balancer (ALB):**

- HTTP/2 enabled by default
- Terminates HTTP/2 at load balancer
- Forwards HTTP/1.1 to targets

**Railway/Render/Fly.io:**

- HTTP/2 supported out of the box
- Handled by their edge network
- Zero configuration required

### Why This Approach?

✅ **Simpler:** No changes to your Node.js code  
✅ **Performant:** Reverse proxies are optimized for HTTP/2  
✅ **Flexible:** Easy to upgrade protocols (HTTP/3) without code changes  
✅ **Secure:** SSL/TLS termination at the edge

### Testing HTTP/2

```bash
# Check if your deployed site uses HTTP/2
curl -I --http2 https://yourdomain.com

# Look for: HTTP/2 200
```

Or use browser DevTools → Network → Protocol column

---

## Security Checklist

✅ Generate new JWT secrets (don't use dev secrets)  
✅ Lock down CORS to your domain  
✅ Use HTTPS (all platforms support it)  
✅ Enable Helmet security headers (already included)  
✅ Set rate limits appropriately  
✅ Review and remove test/debug code  
✅ Enable Sentry error tracking  
✅ Use environment variables (never commit secrets)  
✅ Keep dependencies updated (`pnpm update`)  
✅ Enable database backups

---

## Summary

**Pre-Deployment Checklist:**

- ✅ Environment variables configured
- ✅ Database setup complete
- ✅ OAuth store configured (Redis for multi-instance)
- ✅ Security hardening applied
- ✅ Application built successfully

**Post-Deployment:**

- ✅ Run database migrations
- ✅ Verify health check endpoint
- ✅ Enable monitoring (Sentry)
- ✅ Setup database backups
- ✅ Configure HTTPS
- ✅ Test all endpoints

**Need Help?**

- Check your platform's documentation for deployment specifics
- Join our [Discord community](https://discord.gg/dreamstack) for support
- Review the [AUTH_SECURITY.md](./AUTH_SECURITY.md) guide for production security

**Next Steps:**

- Monitor error rates and performance
- Setup custom domain
- Configure CI/CD pipelines
- Load test your API before going live
