# Framework Flexibility

Switch between Express and Hono HTTP frameworks without changing a single line of business logic. Configure once, develop framework-agnostic.

---

## Quick Start

### Choose Your Framework

```env
# .env
FRAMEWORK=express  # or 'hono'
```

That's it! DreamStack handles the rest.

### Write Framework-Agnostic Code

```typescript
// src/features/auth/auth.route.ts
import { createRouter } from "@/core/http/factory";
import type { HttpRequest, HttpResponse } from "@/core/http";
import { sendSuccess } from "@/common/utils/response";

const router = createRouter();

router.post("/login", async (req: HttpRequest, res: HttpResponse) => {
  const { email, password } = req.body;
  const token = await authService.login(email, password);
  sendSuccess(res, { token });
});

export default router;
```

**No Express or Hono imports. No framework-specific code.**

---

## Request/Response Abstraction

Your controllers work with framework-agnostic interfaces:

```typescript
interface HttpRequest {
  // Core
  method: string;
  path: string;
  url: string;
  protocol: string;
  ip?: string;

  // Data
  headers: Record<string, string>;
  query: QueryParams;
  params: Record<string, string>;
  cookies: Record<string, string>;
  body: unknown;

  // Framework-agnostic context store
  // Use this to store request-scoped data (user, session, files, etc.)
  // Example: req.ctx.user, req.ctx.file, req.ctx.requestId
  ctx: Record<string, any>;

  // Escape hatch (use sparingly)
  raw: unknown;
}

interface HttpResponse {
  // Core (all required - available in both frameworks)
  status(code: number): HttpResponse;
  json(data: JsonValue): void;
  text(data: string): void;
  redirect(url: string, statusCode?: number): void;
  send(): void;

  // Headers
  header(name: string, value: string): HttpResponse;
  headers(headers: Record<string, string>): HttpResponse;

  // Cookies
  cookie(name: string, value: string, options?: CookieOptions): HttpResponse;
  clearCookie(name: string, options?: CookieOptions): HttpResponse;

  // Advanced
  stream(readable: NodeJS.ReadableStream, contentType?: string): void;
  download(filepath: string, filename?: string): void;

  // Escape hatch (use sparingly)
  raw: unknown;
}
```

> **Architecture Deep Dive:** See [ARCHITECTURE.md - HTTP Adapter Pattern](./ARCHITECTURE.md#1-framework-agnostic-design) for detailed implementation.

---

## Framework Comparison

| Feature          | Express          | Hono             |
| ---------------- | ---------------- | ---------------- |
| **Bundle Size**  | ~2MB             | ~14KB            |
| **Performance**  | Baseline         | 2-3x faster      |
| **Ecosystem**    | Massive          | Growing          |
| **TypeScript**   | Good             | Excellent        |
| **Edge Runtime** | ❌ No            | ✅ Yes           |
| **API Docs**     | Swagger UI       | Scalar           |
| **Best For**     | Traditional apps | Edge, serverless |

**Both support:**

- ✅ Cookies
- ✅ File uploads
- ✅ Rate limiting
- ✅ Security headers
- ✅ CORS
- ✅ Compression
- ✅ Static files

---

## Common Patterns

### Middleware

```typescript
import type { MiddlewareFn } from "@/core/http";

const logger: MiddlewareFn = (req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
};

// Use globally
adapter.use(logger);

// Or per-route
router.post("/login", logger, loginController);
```

### Error Handling

```typescript
import type { ErrorMiddlewareFn } from "@/core/http";

const errorHandler: ErrorMiddlewareFn = (err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    status: "error",
    message: err.message,
    code: err.code,
  });
};

adapter.useError(errorHandler);
```

### Context Data Sharing

Use `req.ctx` to pass data between middleware and controllers.
Example:

```typescript
// Auth Middleware - sets user data
// Auth Middleware - sets user in context
const authMiddleware: MiddlewareFn = (req, res, next) => {
  const user = verifyToken(req.headers.authorization);
  req.ctx.user = user; // Set by authorize/authenticate middleware
  next();
};

// Request Context Middleware - sets request ID
const requestContextMiddleware: MiddlewareFn = (req, res, next) => {
  const reqId = req.headers["x-request-id"] || generateUUID();
  req.ctx.reqId = reqId; // Set by requestContextMiddleware
  next();
};

// File Upload Middleware - sets file in context
const uploadMiddleware: MiddlewareFn = (req, res, next) => {
  req.ctx.file = uploadedFile; // Set by file upload middleware (uploadAvatar, etc.)
  next();
};

// Controller - accesses context data
const controller = (req: HttpRequest, res: HttpResponse) => {
  const user = req.ctx.user; // Set by authorize/authenticate middleware
  const file = req.ctx.file; // Set by file upload middleware (uploadAvatar, etc.)
  const reqId = req.ctx.reqId; // Set by requestContextMiddleware

  sendSuccess(res, { user, file, reqId });
};
```

**Common `req.ctx` properties:**

- `req.ctx.user` - Current authenticated user (set by auth middleware)
- `req.ctx.file` - Uploaded file (set by upload middleware)
- `req.ctx.requestId` - Unique request identifier
- `req.ctx.*` - Any custom middleware data

### Cookies

```typescript
// Read
const token = req.cookies.authToken;

// Set
res.cookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 3600000, // 1 hour
});

// Clear
res.clearCookie("session");
```

---

## Switching Frameworks

### Change Environment Variable

```env
# .env
FRAMEWORK=hono  # Changed from 'express'
```

### Restart Server

```bash
pnpm dev
```

**That's it!** Your entire application now runs on Hono.

### What Changes?

- ✅ **Nothing in your code** - Routes, controllers, middleware stay the same
- ✅ **API documentation** - Automatically switches (Swagger → Scalar)
- ✅ **Performance characteristics** - May see 2-3x speed improvement with Hono
- ✅ **Bundle size** - Deployment package becomes smaller with Hono

### Testing Both Frameworks

```bash
# Test with Express
pnpm test:express

# Test with Hono
pnpm test:hono

# Test both automatically
pnpm test:both
```

---

## Best Practices

### ✅ Do

- **Use `req.ctx` for data sharing** between middleware
- **Use `sendSuccess()` and `sendError()`** for consistent responses
- **Keep routes framework-agnostic** - no Express/Hono imports
- **Use the abstraction** - `req.headers`, `req.cookies`, etc.

### ❌ Don't

- **Don't access `req.raw` or `res.raw`** unless absolutely necessary
- **Don't import Express or Hono** in your feature code
- **Don't attach properties directly to `req`** - use `req.ctx` instead

---

## Raw Access (Advanced)

Both `req.raw` and `res.raw` provide access to the underlying framework objects:

```typescript
// Express
const expressReq = req.raw as Request;
const expressRes = res.raw as Response;

// Hono
const honoContext = req.raw as Context;
```

> ⚠️ **Warning:** This couples your code to a specific framework and will break if you switch. Use only when:
>
> - The abstraction doesn't cover your use case
> - You're writing framework-specific adapters (in `src/core/http/{framework}/`)
> - Debugging framework-specific behavior

**99% of use cases are covered by the abstraction.** If you find yourself using `raw` often, suggest it in the [Discord community](https://discord.gg/dreamstack) - we may need to extend the interface.

---

## Adding a New Framework

Want to add Fastify, Koa, or another framework? The adapter pattern makes it straightforward:

1. **Implement `HttpAdapter` interface**
2. **Create router adapter** implementing `HttpRouter`
3. **Add framework-specific middleware adapters** (file upload, rate limit)
4. **Update factory** to recognize new framework
5. **Write tests** for the new adapter

See [ARCHITECTURE.md - Adding Framework Support](./ARCHITECTURE.md) for detailed implementation guide.

> **Need help?** Join the [Discord community](https://discord.gg/dreamstack) - we're happy to guide you through adding new frameworks!

---

## Summary

| ✅ Benefit              | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| **Zero vendor lock-in** | Switch frameworks anytime without rewriting code            |
| **Test performance**    | Try Express vs Hono in your actual app                      |
| **Future-proof**        | New frameworks supported without breaking changes           |
| **Clean code**          | No framework-specific imports polluting business logic      |
| **Full feature parity** | Both adapters support cookies, uploads, rate limiting, etc. |

**Want to dive deeper?** Check out:

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed adapter implementation
- [FILE_UPLOADS.md](./FILE_UPLOADS.md) - Framework-agnostic file handling
- [RATE_LIMITING.md](./RATE_LIMITING.md) - Framework-agnostic rate limiting
