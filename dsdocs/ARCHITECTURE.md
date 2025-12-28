# Architecture Overview

DreamStack's architectural patterns, design decisions, and framework-agnostic design philosophy.

## Core Principles

### 1. Framework Agnostic Design

**HTTP Layer Abstraction** - Use any HTTP framework (Express, Hono, Fastify, etc.):

```typescript
// Unified interface for all frameworks (simplified)
interface HttpAdapter {
  // Middleware
  use(middleware: MiddlewareFn): void;
  useError(middleware: ErrorMiddlewareFn): void;

  // Routing
  route(method: Method, path: string, ...handlers: HandlerFn[]): void;
  registerRoutes(path: string, router: HttpRouter): void;
  createRouter(): HttpRouter;

  // Server lifecycle
  listen(port: number): Server;
  close?(): Promise<void>;

  // Framework access
  getApp(): unknown;           // Express app, Hono app, etc.
  getNodeServer(): Server;     // Node.js http.Server
}

// Choose your framework via env
HTTP_FRAMEWORK=express  # or hono, fastify, etc.
```

**Current Adapters:** Express (battle-tested), Hono (ultra-fast, edge-ready)

### 2. Feature-Based Organization

Code is organized by business feature, not technical layer:

```
src/features/
├── auth/              # Everything auth-related
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.routes.ts
│   ├── auth.types.ts
│   ├── local/         # Local auth (email/password)
│   ├── oauth/         # OAuth providers (Google, GitHub)
│   │   ├── oauth.controller.ts
│   │   ├── oauth.service.ts
│   │   ├── oauth.store.ts    # State & OTC storage
│   │   └── providers/
│   │       ├── google.provider.ts
│   │       └── github.provider.ts
│   └── tokens/        # JWT token management
├── users/             # Everything user-related
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── user.route.ts
│   ├── user.repository.ts         # Interface
│   ├── user.repository.prisma.ts  # Prisma implementation
│   ├── user.repository.mongo.ts   # Mongoose implementation
│   ├── tokens/        # User token management
│   ├── roles/         # Role system
│   └── oauth-identity/ # OAuth account linking
```

**Benefits:** Related code co-located, clear boundaries, easy extraction to microservices, team ownership.

### 3. Dependency Injection

Services are created and injected via container:

```typescript
// Container provides dependencies (src/core/container/index.ts)
const container = {
  users: {
    service: new UserService(userRepository),
    repository: createUserRepository(ENV.DB_STRATEGY),
  },
  auth: {
    local: new LocalAuthService(userService, tokenService),
    oauth: new OAuthService(providers, store, userService),
    token: new TokenService(tokenRepository),
  },
};

// Controllers import container globally
import { container } from "@/core/container";

export const getMe = catchAsync(async (req, res) => {
  const user = await container.users.service.getUserById(req.ctx.user.id);
  sendSuccess(res, toUserResponse(user));
});
```

**Benefits:** Testable (mock dependencies), flexible implementations, clear dependencies, type-safe.

### 4. Strategy Pattern

Swap implementations without code changes:

```env
# Choose HTTP framework
HTTP_FRAMEWORK=express|hono

# Choose database
DB_STRATEGY=prisma|mongoose

# Choose email provider
EMAIL_STRATEGY=postmark|mock

# Choose storage
STORAGE_STRATEGY=local|s3
```

**How it Works:**

```typescript
// Interface defines contract
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(data: CreateUser): Promise<User>;
}

// Multiple implementations
class PrismaUserRepository implements IUserRepository {}
class MongoUserRepository implements IUserRepository {}

// Factory chooses implementation at runtime
function createUserRepository(strategy: string): IUserRepository {
  switch (strategy) {
    case "prisma":
      return new PrismaUserRepository();
    case "mongoose":
      return new MongoUserRepository();
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}
```

**Benefits:** Fast testing (SQLite in-memory), database flexibility, easy new implementations. See [DATABASE.md](./DATABASE.md) for details.

---

## HTTP Layer Architecture

### Framework-Agnostic Design

**The Problem:** Traditional backends lock you into one framework (Express, Fastify, etc.).

**Our Solution:** Abstract the HTTP layer behind interfaces.

### Adapter Pattern

```typescript
// Core interface - framework agnostic (src/core/http/http.adapter.ts)
export interface HttpAdapter {
  // Middleware
  use(middleware: MiddlewareFn): void;
  useError(middleware: ErrorMiddlewareFn): void;

  // Routing
  route(method: Method, path: string, ...handlers: HandlerFn[]): void;
  registerRoutes(path: string, router: HttpRouter): void;
  createRouter(): HttpRouter;

  // Server lifecycle
  listen(port: number): Server;
  close?(): Promise<void>;

  // Framework access
  getApp(): unknown; // Express app, Hono app, etc.
  getNodeServer(): Server; // Node.js http.Server
}

// Adapters implement the interface
class ExpressAdapter implements HttpAdapter {}
class HonoAdapter implements HttpAdapter {}
```

### Request Context

**Unified context** across all frameworks:

```typescript
// Framework-agnostic request/response (src/core/http/http.types.ts)
export interface HttpRequest {
  // Core identifiers
  method: string;
  path: string;
  url: string;

  // Request data (normalized)
  body: unknown;
  params: Record<string, string>;
  query: QueryParams;
  headers: Record<string, string>;
  cookies: Record<string, string>;

  // Metadata
  protocol: string;
  ip?: string;

  // Request-scoped context store (user, session, files, etc.)
  ctx: Record<string, any>;

  /**
   * Framework-specific request object (Express.Request, Hono.Context, etc.)
   * ⚠️ Use sparingly - accessing .raw couples code to specific framework
   */
  raw: unknown;
}

export interface HttpResponse {
  status: (code: number) => HttpResponse;
  json: (payload: JsonValue) => void;
  text: (payload: string) => void;
  header?: (name: string, value: string) => HttpResponse;
  cookie?: (name: string, value: string, options?: CookieOptions) => HttpResponse;

  /**
   * Framework-specific response object (Express.Response, Hono.Context, etc.)
   * ⚠️ Use sparingly - accessing .raw couples code to specific framework
   */
  raw: unknown;
}

// Controllers use normalized API (99% of use cases)
export const getMe = catchAsync(async (req, res) => {
  const userId = req.ctx.user.id; // Same across all frameworks
  const user = await container.users.service.getUserById(userId);
  sendSuccess(res, toUserResponse(user));
});

// Framework-specific access when needed (rare)
export const specialCase = catchAsync(async (req, res) => {
  // Access Express-specific features
  const expressReq = req.raw as Express.Request;
  const expressRes = res.raw as Express.Response;

  // Or Hono-specific features
  const honoCtx = req.raw as HonoContext;
});
```

### Factory Pattern

**Create server** with chosen framework:

```typescript
// Server factory
export async function createServer(framework: HttpFramework = ENV.HTTP_FRAMEWORK): Promise<IHttpAdapter> {
  let adapter: IHttpAdapter;

  switch (framework) {
    case "express":
      adapter = new ExpressAdapter();
      break;
    case "hono":
      adapter = new HonoAdapter();
      break;
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }

  // Bootstrap app (routes, middleware, error handlers)
  await bootstrapApp(adapter);

  return adapter;
}

// Usage
const app = await createServer("express");
await app.listen(8000);
```

### Middleware Composition

**Framework-agnostic middleware:**

```typescript
// Authorization middleware works with any framework
export function authorize(requiredRole: UserRole = UserRole.USER): MiddlewareFn {
  return async (req: HttpRequest, res: HttpResponse, next: NextFn) => {
    const token = extractToken(req);
    const user = await tokenService.validateToken(token);

    // Set context - same across frameworks
    req.ctx.user = user;

    // Check role hierarchy
    if (!hasRole(user.role, requiredRole)) {
      throw new AppError(403, "Insufficient permissions");
    }

    next();
  };
}

// Used identically across frameworks
router.get("/users/me", authorize(UserRole.USER), getMe);
router.get("/admin/users", authorize(UserRole.ADMIN), listUsers);
```

**Benefits:** Performance testing (Hono often 2-3x faster), edge deployment support, future-proof (add adapters, switch frameworks without code changes).

---

## Application Layer Architecture

### Request Flow

```
Client Request
    ↓
HTTP Adapter (Express/Hono)
    ↓
Global Middleware (CORS, body parser)
    ↓
Route (URL pattern matching)
    ↓
Route Middleware (auth, validation, rate limit)
    ↓
Controller (HTTP handling)
    ↓
Service (business logic)
    ↓
Repository (data access)
    ↓
Database (Prisma/Mongoose)
    ↓
Response (formatted via sendSuccess/sendError)
```

### Layer Responsibilities

**HTTP Adapter** ([`src/core/http/`](../../src/core/http)):

- Abstract framework differences
- Normalize request/response
- Provide unified interface
- Handle framework-specific quirks

**Routes** (`*.routes.ts`):

- Define URL patterns (`/v1/users/:id`)
- Attach middleware chains
- Map to controller functions
- Document API structure

**Middleware** ([`src/common/middlewares/`](../../src/common/middlewares)):

- **authorize(role)** - Verify JWT, set `req.ctx.user`, check role
- **authenticate** - Alias for `authorize()` with default USER role
- **validate(schema)** - Zod schema validation
- **rateLimit / strictRateLimit** - Throttle requests
- **uploadAvatar** - Handle file uploads (Multer)

**Controllers** (`*.controller.ts`):

- Handle HTTP requests/responses
- Extract data from req.ctx
- Call services
- Transform data for responses
- Error handling (via `catchAsync`)
- No business logic

**Services** (`*.service.ts`):

- Business logic implementation
- Orchestrate repositories
- Validate business rules
- Transaction management
- Cross-feature coordination

**Repositories** (`*.repository.ts`):

- Database operations only
- Implement interface (IRepository)
- No business logic
- Return domain models
- Database-agnostic (via strategy)

---

## Key Patterns

### 1. Repository Pattern

Abstracts data access behind interfaces:

```typescript
// Interface (src/features/users/user.repository.ts)
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  findAllPaginated(params: PaginationParams): Promise<PaginatedResponse<User>>;
  create(user: CreateUser): Promise<User>;
  update(id: string, userData: UpdateUser): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}

// Prisma implementation (src/features/users/prisma/user.repository.prisma.ts)
export class PrismaUserRepository implements IUserRepository {
  async create(user: CreateUser): Promise<User> {
    const userRecord = await this.prisma.user.create({ data: user });
    return fromDB(userRecord) as User;
  }
  // ... other methods
}

// Mongoose implementation (src/features/users/mongo/user.repository.mongo.ts)
export class MongoUserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const user = await UserModel.findById(id);
    return user ? fromDB(user) : null;
  }
  // ... other methods
}
```

### 2. DTO Pattern

Separate data transfer from domain models for security and API contract clarity:

```typescript
// Domain entity (src/features/users/user.entity.ts)
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash?: string; // Internal only - sensitive!
  role: UserRole;
  avatar?: string;
  emailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateUser = Omit<User, "id" | "createdAt" | "updatedAt">;
export type UpdateUser = Partial<CreateUser>;

// Response DTO (src/features/users/user.types.ts)
export type UserResponseDTO = Omit<User, "passwordHash">;

// Transform utility (src/features/users/user.utils.ts)
export function toUserResponse(user: User): UserResponseDTO {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// Input DTOs (inferred from Zod schemas)
export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
export type UpdateOwnUserDTO = z.infer<typeof updateMeSchema>;

// Usage in controllers
export const getMe = catchAsync(async (req, res) => {
  const user = await container.users.service.getUserById(req.ctx.user.id);
  sendSuccess(res, toUserResponse(user)); // passwordHash stripped!
});

export const createUser = catchAsync(async (req, res) => {
  const userData: CreateUserDTO = req.body; // Validated by middleware
  // or userData = req.body as CreateUserDTO;
  const user = await container.users.service.createUser(userData);
  sendCreated(res, toUserResponse(user));
});
```

### 3. Middleware Pattern

Composable request processing:

```typescript
// Authorization with role check
router.get(
  "/admin/users",
  authorize(UserRole.ADMIN), // Verify JWT + check admin role
  listUsers, // Handle request
);

// Authentication (default USER role)
router.get(
  "/users/me",
  authorize(UserRole.USER), // Verify JWT + check user role
  getMe,
);

// Validation
router.post(
  "/users",
  authorize(UserRole.ADMIN),
  validate({ body: createUserSchema }), // Zod validation
  createUser,
);

// File Upload
router.post(
  "/users/me/avatar",
  authorize(UserRole.USER),
  uploadAvatar, // framework agnostic upload middleware
  uploadMyAvatar,
);
```

### 4. Factory Pattern

Create complex objects:

```typescript
// Feature container factory (src/features/users/user.container.ts)
export function createUserContainer(
  strategy: DataStrategy,
  dbClient: DbClient,
  storageService: IStorageService,
): UserContainer {
  const repository = createUserRepository(strategy, dbClient);
  const service = new UserService(repository, storageService);
  return { repository, service };
}

// Repository factory
function createUserRepository(strategy: DataStrategy, client: DbClient): IUserRepository {
  switch (strategy) {
    case "prisma":
      return new PrismaUserRepository(client);
    case "mongoose":
      return new MongoUserRepository(UserModel);
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

// Global container initialization (src/core/container/index.ts)
const users = createUserContainer(strategy, dbClient, storageService);
const auth = createAuthContainer(strategy, dbClient, users.service, emailService);

export const container = { users, auth, emailService, storageService };
```

---

## Security Architecture

### Authentication Flow

```
1. User logs in → LocalAuthService.login()
2. Verify password → bcrypt.compare()
3. Generate tokens → TokenService.generateTokens()
4. Hash refresh token → HKDF + HMAC
5. Store hash → UserTokenRepository.create()
6. Return tokens → { access, refresh }
```

### Authorization Flow

```
1. Client sends request with Bearer token
2. authenticate middleware extracts token
3. TokenService.validateToken() verifies signature
4. UserService.getUserById() loads user
5. authorize middleware checks user.role
6. If authorized → proceed to controller
7. If not → 403 Forbidden
```

### Token Security

- **Access tokens:** Short-lived (15 min), verify requests
- **Refresh tokens:** Long-lived (7 days), get new access tokens
- **Rotation:** Refresh tokens single-use, rotated on refresh
- **Reuse detection:** All tokens revoked if reuse detected
- **Hashing:** Refresh tokens hashed before database storage

### OAuth 2.0 Architecture

**Cross-Platform OAuth Flow** - Works with web, mobile, desktop, CLI:

```
Phase 1: Authorization Request
1. Client → GET /v1/auth/oauth/:provider/authorize?redirect_uri=...
2. Server validates redirect_uri against whitelist (security)
3. Server generates state token (CSRF protection)
4. Server returns authUrl + state
5. Client redirects user to provider (Google/GitHub)

Phase 2: Provider Callback
6. User authorizes on provider
7. Provider → GET /v1/auth/oauth/:provider/callback?code=xxx&state=yyy
8. Server validates state (burn after reading)
9. Server exchanges code for access token (via provider)
10. Server fetches user profile from provider
11. Server creates/links user account
12. Server generates OTC (one-time code)
13. Server redirects to client redirect_uri?code=OTC

Phase 3: Token Exchange
14. Client → POST /v1/auth/oauth/token { code: OTC }
15. Server validates OTC (burn after reading)
16. Server generates JWT tokens
17. Client stores tokens, authenticated ✅
```

**Key Security Features:**

- **Redirect URI Whitelist** - Prevents open redirect attacks
- **State Tokens** - CSRF protection, burn after reading
- **OTC (One-Time Codes)** - Secure token exchange, burn after reading
- **PKCE Support** - Code challenge/verifier for Google OAuth
- **Email Matching** - Prevents account hijacking during linking
- **Provider Isolation** - Each provider in separate module

**OAuth Store:**

```typescript
// Temporary storage for OAuth flow data
interface IOAuthStore {
  set(key: string, value: any, ttl: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  getAndDelete<T>(key: string): Promise<T | null>; // Burn after reading
  delete(key: string): Promise<void>;
}

// Default: In-memory with node-cache (production: use Redis/DB)
// Stores: state tokens, OTCs
// TTL: 10 minutes (prevents replay attacks)
```

---

## Database Strategy

### Database Strategy

**Prisma:** PostgreSQL, MySQL, SQLite - Type-safe queries, auto-generated client, migration system  
**Mongoose:** MongoDB - NoSQL flexibility, schema validation, hooks

See [DATABASE.md](./DATABASE.md) for complete migration and configuration guide.

---

## Error Handling

### Centralized Error Handler

```typescript
// Custom error class (src/common/utils/app-error.ts)
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: "fail" | "error";
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly data?: Record<string, any>;

  constructor(statusCode = 500, message: string, code: ErrorCode = "ERR_INTERNAL", data?: Record<string, any>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Usage in services/controllers
if (!user) {
  throw new AppError(404, "User not found", "ERR_NOT_FOUND");
}

// Global error handler (src/common/middlewares/error-handler.ts)
export const globalErrorHandler = (
  err: Error | AppError | ZodError,
  req: HttpRequest,
  res: HttpResponse,
  next: NextFn,
) => {
  const statusCode = (err as AppError).statusCode || 500;
  const status = (err as AppError).status || "error";
  const code = (err as AppError).code || "ERR_INTERNAL";
  const message = err.message || "Internal server error";
  const errors = (err as AppError).data?.errors || undefined;

  // Capture non-validation errors in Sentry
  if (code !== "ERR_VALIDATION" && ENV.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  logger.error("error", {
    statusCode,
    status,
    code,
    message,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    status,
    code,
    message,
    ...(errors && { errors }),
  });
};
```

### Async Error Catching

```typescript
// catchAsync wrapper (src/common/utils/catch-async.ts)
type AsyncRequestHandler = (req: HttpRequest, res: HttpResponse, next?: NextFn) => Promise<void>;

export const catchAsync = (fn: AsyncRequestHandler) => {
  return (req: HttpRequest, res: HttpResponse, next: NextFn): Promise<void> => {
    return Promise.resolve(fn(req, res, next)).catch(next) as Promise<void>;
  };
};

// Usage in controllers - no try/catch needed!
export const getMe = catchAsync(async (req, res) => {
  const user = await container.users.service.getUserById(req.ctx.user.id);
  sendSuccess(res, toUserResponse(user));
});
```

---

## Configuration Management

### Configuration Management

Type-safe, environment-based configuration via `ENV` object (`src/core/config/env.ts`). Single source of truth for all settings (database, JWT, storage, etc.).

---

## Testing Strategy

## Testing Strategy

See [TESTING.md](./TESTING.md) for comprehensive testing guide. Unit tests mock dependencies, integration tests use real database (Prisma + SQLite in-memory for speed).

---

## Performance Considerations

## Performance & Scalability

**Database:** Indexes on frequently queried fields, pagination for large datasets, Redis caching (add when needed)  
**Files:** Memory buffering (limit size), streaming for large files, S3 offloading  
**Tokens:** Stateless JWT validation (no database lookup), short access token expiry  
**Horizontal Scaling:** Stateless design enables multiple instances. Use Redis for OAuth store (state tokens, OTCs) when scaling beyond single instance.  
**Database Scaling:** Read replicas, connection pooling (Prisma auto-manages)

---

## Code Quality

## Code Quality

**TypeScript:** Strict mode, interfaces define contracts, domain models typed, generics for reusable utilities  
**Linting:** `pnpm lint` / `pnpm lint:fix` (ESLint + Prettier), `pnpm format` / `pnpm format:check`  
**Testing:** `pnpm test` / `pnpm test:coverage`

---

## Design Decisions

## Design Decisions

### Framework-Agnostic HTTP Layer

**Rationale:** Switch frameworks via env variable (`HTTP_FRAMEWORK=express|hono`) without code changes. Business logic survives framework changes. Hono is 2-3x faster than Express for benchmarking. Not locked into dying frameworks.

### Feature-Based Organization

**Rationale:** One folder per feature (auth/, users/, etc.) vs scattered across layers (controllers/, services/, models/). Benefits: Easy navigation, clear ownership, simple extraction to microservices, fewer merge conflicts.

### Dependency Injection

**Rationale:** Easy testing via mocked dependencies. Production uses real implementations, tests use mocks.

### Strategy Pattern

**Rationale:** Swap implementations via env variables without code rewrites. Same code works with SQLite (dev), PostgreSQL (prod), MongoDB (alternative). Enable data-driven decisions via benchmarking.

### Cross-Platform OAuth

**Rationale:** Traditional OAuth assumes browser-based callbacks and cookies, breaking mobile/desktop/CLI apps. Three-phase flow (authorize → callback → token exchange) works everywhere. OTC (one-time codes) enable secure token delivery without cookies. See [OAUTH.md](./OAUTH.md) for implementation details.

---

## Summary

DreamStack uses:

✅ **Framework-agnostic HTTP** - switch frameworks via env variable  
✅ **Feature-based** organization - scalable structure  
✅ **Dependency injection** - testable code  
✅ **Strategy pattern** - swappable implementations  
✅ **Repository pattern** - clean data access  
✅ **DTO pattern** - safe API responses  
✅ **Middleware composition** - reusable logic  
✅ **Centralized errors** - consistent handling  
✅ **Type safety** - fewer bugs  
✅ **Environment config** - easy deployment  
✅ **Cross-platform OAuth** - works everywhere

### Production-Ready Features

**Authentication:**

- JWT with refresh token rotation
- OAuth 2.0 (Google, GitHub) with PKCE
- Email verification
- Password reset
- Rate limiting
- CSRF protection

**Flexibility:**

- HTTP: Express or Hono (more coming)
- Database: Prisma (PostgreSQL, MySQL, SQLite) or Mongoose (MongoDB)
- Storage: Local filesystem or AWS S3
- Email: Postmark or mock
- All swappable via env variables

**Developer Experience:**

- TypeScript strict mode
- Comprehensive testing (500+ tests)
- Hot reload in development
- API documentation (Scalar)
- Migration tools
- Deployment guides

These patterns make the codebase:

- **Maintainable** - easy to understand and change
- **Testable** - easy to write tests (fast SQLite in-memory tests)
- **Flexible** - easy to adapt (swap frameworks, databases, etc.)
- **Scalable** - grows with your needs (stateless, horizontal scaling)
- **Future-proof** - not locked into any vendor or framework

**Next Steps:**

- See [GETTING_STARTED.md](GETTING_STARTED.md) for setup
- See [OAUTH.md](OAUTH.md) for OAuth implementation details
- See [FRAMEWORK.md](FRAMEWORK.md) for framework adapter guide
- See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
