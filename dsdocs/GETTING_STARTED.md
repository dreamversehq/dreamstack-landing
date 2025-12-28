# Getting Started with DreamStack

Get your Node.js backend up and running in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Git installed

## Quick Setup

### 1. Install Dependencies

```bash
# Navigate to the unzipped folder
cd dreamstack-nodejs

# Install dependencies
pnpm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and set your values (minimum required below)
```

**Minimum Configuration:**

```env
# Server
PORT=8000
NODE_ENV=development
CORS_ORIGIN=*

# Database (choose one)
DB_STRATEGY=prisma              # prisma | mongoose
DATABASE_URL="file:./dev.db"    # update if DB_STRATEGY=mongoose

# Authentication (CHANGE THESE!)
JWT_ACCESS_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Email
EMAIL_STRATEGY=mock             # mock | postmark
EMAIL_FROM=noreply@example.com
```

**Generate Secure Secrets:**

```bash
# JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Setup Database

**Option A: SQLite (Prisma - Easiest for Development)**

```bash
# Already configured by default!
# Database file will be created at prisma/dev.db

# Run migrations
pnpm prisma migrate dev

# (Optional) View data in Prisma Studio
pnpm prisma studio
```

**Option B: PostgreSQL (Prisma - Recommended for Production)**

```bash
# 1. Install PostgreSQL locally or use cloud provider

# 2. Update .env
DATABASE_URL="postgresql://user:password@localhost:5432/dreamstack?schema=public"

# 3. Run migrations
pnpm prisma migrate dev
```

**Option C: MongoDB (Mongoose)**

```bash
# 1. Install MongoDB locally or use MongoDB Atlas

# 2. Update .env
DB_STRATEGY=mongoose
DATABASE_URL=mongodb://localhost:27017/dreamstack

# 3. Start server (no migrations needed)
pnpm dev
```

### 4. Start Development Server

```bash
pnpm dev
```

You should see:

```
✅ Connected using Prisma
✅ DI Container initialized successfully
✅ Server started on port 8000
```

**Test it's working:**

```bash
curl http://localhost:8000/health
# Response: {"status":"ok","timestamp":"2024-01-01T00:00:00.000Z","database":"connected"}
```

---

## First Steps

### 1. Create Your First User

```bash
curl -X POST http://localhost:8000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Response includes access and refresh tokens** - save the `access` token for authenticated requests.

### 2. Explore the API

Visit: **http://localhost:8000/v1/docs**

Interactive API documentation with all endpoints:

- **Express:** Swagger UI
- **Hono:** Scalar UI

Try these endpoints:

- `GET /v1/users/me` - Get your profile
- `PATCH /v1/users/me` - Update your profile
- `POST /v1/users/me/avatar` - Upload avatar
- `GET /v1/users` - List users (admin only)

---

## Project Structure

```
src/
├── features/                 # Feature modules (users, auth, etc.)
│   ├── users/               # User management
│   ├── auth/                # Authentication (local + OAuth)
├── common/                   # Shared utilities
│   ├── middlewares/         # Auth, validation, error handling
│   ├── email/               # Email service (Postmark, Mock)
│   ├── storage/             # File storage (S3, Local)
│   └── utils/               # Helpers, validators
├── core/                     # Application core
│   ├── http/                # Framework adapters (Express, Hono)
│   ├── db/                  # Database clients (Prisma, Mongoose)
│   ├── config/              # Environment & configuration
│   ├── logger/              # Structured logging
│   ├── docs/                # API documentation
│   └── routes/              # Route registration
├── bootstrap.ts             # Infrastructure initialization
└── index.ts                 # Entry point
```

**Key Concepts:**

- **Feature-based structure** - Each feature is self-contained
- **Dependency injection** - Services injected via container
- **Strategy pattern** - Swap database/email/storage/framework easily

See [Architecture Guide](./ARCHITECTURE.md) for details.

---

## Available Scripts

```bash
# Development
pnpm dev          # Start with hot reload
pnpm build        # Compile TypeScript
pnpm start        # Run production build

# Testing
pnpm test              # Run all tests
pnpm test:unit         # Run unit tests only
pnpm test:integration  # Run integration tests only
pnpm test:express      # Test with Express
pnpm test:hono         # Test with Hono
pnpm test:both         # Test both frameworks
pnpm test:coverage     # Generate coverage report

# Code Quality
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm format       # Format with Prettier
```

> **Prisma Commands:** Use `pnpm prisma <command>` directly (e.g., `pnpm prisma init`,`pnpm prisma migrate dev`, `pnpm prisma studio`, `pnpm prisma generate`). See [Prisma CLI docs](https://www.prisma.io/docs/reference/api-reference/command-reference) for all available commands.

---

## Framework Selection

DreamStack supports **two HTTP frameworks**: Express and Hono. Choose based on your needs:

### Express (Default)

```env
FRAMEWORK=express  # or omit (express is default)
```

- **Best for:** Traditional REST APIs, wide ecosystem, mature tooling
- **Pros:** Massive ecosystem, well-documented, familiar to most developers
- **API Docs:** Swagger UI at `/v1/docs`

### Hono (Alternative)

```env
FRAMEWORK=hono
```

- **Best for:** Edge deployment (Cloudflare Workers), lightweight apps, modern APIs
- **Pros:** 2-3x faster, TypeScript-first, works on edge runtimes
- **API Docs:** Scalar UI at `/v1/docs`

**Switch anytime** - Just change the env var and restart. All your code stays the same!

### Testing with Different Frameworks

**Tests use the framework specified in your `.env` file:**

```env
# Tests will run with Express
FRAMEWORK=express
```

**To test both frameworks:**

```bash
# Test with Express
pnpm test:express

# Test with Hono
pnpm test:hono

# Test both automatically
pnpm test:both
```

> **Note:** Unit tests are framework-agnostic. Integration tests use whichever framework is in your `.env`. See [Testing Guide](./TESTING.md) for comprehensive testing documentation.

---

## Optional Features

### Enable OAuth (Google, GitHub)

**1. Get OAuth credentials:**

- [Google Cloud Console](https://console.cloud.google.com/)
- [GitHub Developer Settings](https://github.com/settings/developers)

**2. Configure:**

```env
APP_URL=http://localhost:8000
OAUTH_REDIRECT_WHITELIST=http://localhost:3000
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

See [OAuth Guide](./OAUTH.md) for complete setup.

### Enable S3 Storage (Avatar Uploads)

> **Note:** Local storage is enabled by default. Uploaded files are saved to `./uploads` and served at `/public`. Perfect for development!

**For production with S3:**

```env
STORAGE_STRATEGY=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=your-bucket-name
```

See [File Uploads Guide](./FILE_UPLOADS.md) for details.

### Enable Email Sending

```env
EMAIL_STRATEGY=postmark
POSTMARK_API_KEY=your-postmark-api-key
EMAIL_FROM=noreply@yourdomain.com
```

**Supported strategies:**

- `mock` - Console logging (development)
- `postmark` - Postmark email service (production)

---

## Development Workflow

### 1. Create a New Feature

```bash
# Create feature directory
mkdir -p src/features/posts

# Create files
touch src/features/posts/post.types.ts
touch src/features/posts/post.service.ts
touch src/features/posts/post.controller.ts
touch src/features/posts/post.route.ts
```

### 2. Add Database Models

**Prisma:**

```prisma
// prisma/schema.prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])
}
```

```bash
# Create migration
pnpm prisma migrate dev --name add_posts
```

**Mongoose:**

```typescript
// src/features/posts/post.model.ts
import { Schema, model } from "mongoose";

const PostSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { timestamps: true },
);

export const PostModel = model("Post", PostSchema);
```

### 3. Register Routes

```typescript
// src/core/routes/v1.routes.ts
const postRoutes = require("@/features/posts/post.route").default;

router.use("/posts", postRoutes);
```

### 4. Test

```bash
# Create test file
touch tests/features/posts/post.test.ts

# Run tests
pnpm jest posts
```

---

## Common Issues

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or change PORT in .env
PORT=3000
```

### Database Connection Failed

**Prisma:**

```bash
# Check DATABASE_URL is correct
cat .env | grep DATABASE_URL

# Reset database
pnpm prisma migrate reset
```

**Mongoose:**

```bash
# Check MongoDB is running
mongosh

# Check DATABASE_URL is correct
cat .env | grep DATABASE_URL
```

### "Module not found"

```bash
# Clear node_modules
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install

# Rebuild
pnpm build
```

### Prisma Client Not Generated

```bash
# Generate Prisma Client
pnpm prisma generate
```

---

## Next Steps

Now that you're set up:

1. **Read the Documentation:**
   - [Authentication Guide](./AUTHENTICATION.md) - Complete auth system
   - [OAuth Guide](./OAUTH.md) - Social login setup
   - [File Uploads Guide](./FILE_UPLOADS.md) - Avatar uploads
   - [Architecture Guide](./ARCHITECTURE.md) - System design
   - [Testing Guide](./TESTING.md) - Testing strategies

2. **Explore the Code:**
   - Check `src/features/users` - Complete user management
   - Check `src/features/auth` - Auth implementation
   - Check `src/common/middlewares` - Reusable middleware

3. **Customize:**
   - Add your features in `src/features/`
   - Update database schema:
     - **Prisma:** Edit `prisma/schema.prisma` and run `pnpm prisma migrate dev`
     - **Mongoose:** Create models in your feature folder (e.g., `src/features/posts/post.model.ts`)
   - Configure for your use case

4. **Deploy:**
   - See [Deployment Guide](./DEPLOYMENT.md)
   - Configure production environment
   - Set up CI/CD

---

## Getting Help

- **Documentation:** Check `docs/` folder
- **Examples:** See `tests/` for usage examples
- **Issues:** Open an issue on GitHub
- **Community:** Join our Discord (link in README)

---

## What's Included

✅ **Framework Flexibility** - Express (default) or Hono - switch anytime  
✅ **Authentication** - Local (email/password) + OAuth (Google, GitHub)  
✅ **Authorization** - Role-based access control (USER, ADMIN)  
✅ **User Management** - CRUD operations + self-service profile  
✅ **File Uploads** - Avatar upload with local/S3 storage  
✅ **Database Flexibility** - Prisma (SQL) or Mongoose (MongoDB)  
✅ **Email** - Template-based emails (mock/Postmark)  
✅ **Security** - JWT tokens, refresh rotation, password hashing, rate limiting  
✅ **API Docs** - Auto-generated Swagger UI (Express) or Scalar (Hono)  
✅ **Testing** - 506 tests with Jest (unit + integration)  
✅ **TypeScript** - Full type safety across the stack  
✅ **Production Ready** - Error handling, logging, monitoring hooks, compression

**You're all set! Start building your application! 🚀**
