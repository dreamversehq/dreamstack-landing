# Database Guide

Complete guide to database setup, strategy selection, and migration in DreamStack.

## Table of Contents

- [Overview](#overview)
- [Why Two Database Options?](#why-two-database-options)
- [Default Setup](#default-setup)
- [Choosing Your Database Strategy](#choosing-your-database-strategy)
- [Removing Unused Database Artifacts](#removing-unused-database-artifacts)
- [Keeping Both for Future Flexibility](#keeping-both-for-future-flexibility)
- [Migration Strategy: Prototype → Production](#migration-strategy-prototype--production)
- [Database-Specific Guides](#database-specific-guides)

---

## Overview

DreamStack supports **two database strategies** out of the box:

| Strategy     | ORM          | Databases                 | Best For                                        |
| ------------ | ------------ | ------------------------- | ----------------------------------------------- |
| **Prisma**   | Prisma ORM   | PostgreSQL, MySQL, SQLite | Production, SQL databases, type safety          |
| **Mongoose** | Mongoose ODM | MongoDB                   | Prototyping, NoSQL flexibility, document stores |

Both strategies implement the same **repository interface**, allowing you to switch databases without rewriting business logic.

---

## Why Two Database Options?

## Why Two Database Options?

**Prisma (SQL):** Type-safe queries, multiple databases (PostgreSQL, MySQL, SQLite), migrations, ACID compliance. Best for production, structured data, complex relationships.

**Mongoose (MongoDB):** Flexible schema, fast prototyping, no migrations, NoSQL benefits. Best for MVPs, frequently changing data models, document-oriented data.

**Why Both?** Start with Mongoose (fast), migrate to Prisma (production). Learn both approaches. Team preference flexibility.

---

## Default Setup

### **Out of the Box**

DreamStack comes with **both strategies pre-configured**:

```
src/features/
├── users/
│   ├── user.repository.ts         # Interface (shared)
│   ├── user.repository.prisma.ts  # Prisma implementation
│   ├── user.repository.mongo.ts   # Mongoose implementation
│   ├── user.schema.mongoose.ts    # Mongoose schema
│   └── ...
```

The active strategy is controlled via environment variable:

```env
# .env
DB_STRATEGY=prisma  # or 'mongoose'
```

### **How It Works**

The **repository factory** pattern chooses the implementation at runtime:

```typescript
// src/features/users/user.container.ts
export function createUserRepository(strategy: DataStrategy, dbClient: DbClient): IUserRepository {
  switch (strategy) {
    case "prisma":
      return new PrismaUserRepository(dbClient);
    case "mongoose":
      return new MongoUserRepository(UserModel);
    default:
      throw new Error(`Unknown DB strategy: ${strategy}`);
  }
}
```

All business logic depends on the **interface**, not the implementation:

```typescript
// Controllers and services only know about IUserRepository
export class UserService {
  constructor(private userRepo: IUserRepository) {}

  async getUserById(id: string) {
    return this.userRepo.findById(id); // Works with both!
  }
}
```

---

## Choosing Your Database Strategy

### **Option 1: Use Prisma**

```env
DB_STRATEGY=prisma
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
```

Install PostgreSQL, run `pnpm prisma migrate dev`, verify with `pnpm dev`.

### **Option 2: Use Mongoose**

```env
DB_STRATEGY=mongoose
DATABASE_URL="mongodb://localhost:27017/dreamstack"
```

Install MongoDB (or use MongoDB Atlas free tier), verify with `pnpm dev`.

---

## Removing Unused Database Artifacts

Once you've chosen your strategy, you can **remove the unused implementation** to simplify your codebase.

### **Keeping Prisma, Removing Mongoose**

**Files to delete:**

```bash
# Repository implementations
rm src/features/users/user.repository.mongo.ts
rm src/features/users/oauth-identity/oauth-identity.repository.mongo.ts
rm src/features/auth/tokens/user-token.repository.mongo.ts

# Mongoose schemas
rm src/features/users/user.schema.mongoose.ts
rm src/features/users/oauth-identity/oauth-identity.schema.mongoose.ts
rm src/features/auth/tokens/user-token.schema.mongoose.ts

# Database setup
rm src/core/db/mongoose.ts

# Tests
rm -rf tests/integration/mongo/

# Dependencies (optional)
pnpm remove mongoose @types/mongoose mongodb-memory-server
```

**Update container factory:**

```typescript
// src/features/users/user.container.ts
export function createUserRepository(strategy: DataStrategy, dbClient: DbClient): IUserRepository {
  if (strategy !== "prisma") {
    throw new Error("Only Prisma strategy is supported");
  }
  return new PrismaUserRepository(dbClient);
}
```

**Update environment:**

```env
# .env.example - Just change the DATABASE_URL to point to PostgreSQL/MySQL
DB_STRATEGY=prisma
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
```

### **Keeping Mongoose, Removing Prisma**

**Files to delete:**

```bash
# Repository implementations
rm src/features/users/user.repository.prisma.ts
rm src/features/users/oauth-identity/oauth-identity.repository.prisma.ts
rm src/features/auth/tokens/user-token.repository.prisma.ts

# Prisma schema and migrations
rm -rf prisma/

# Database setup
rm src/core/db/prisma.ts

# Tests
rm -rf tests/integration/prisma/
rm -rf tests/setup/prisma-test.setup.ts

# Dependencies (optional)
pnpm remove prisma @prisma/client

# Scripts
# Edit package.json and remove Prisma-related scripts
```

**Update container factory:**

```typescript
// src/features/users/user.container.ts
export function createUserRepository(strategy: DataStrategy, dbClient: DbClient): IUserRepository {
  if (strategy !== "mongoose") {
    throw new Error("Only Mongoose strategy is supported");
  }
  return new MongoUserRepository(UserModel);
}
```

**Update environment:**

```env
# .env.example - Just change the DATABASE_URL to point to MongoDB
DB_STRATEGY=mongoose
DATABASE_URL="mongodb://localhost:27017/dreamstack"
```

### **Update Tests**

After removing either strategy, update your test configuration:

```typescript
// jest.config.js
module.exports = {
  // If keeping Prisma only:
  setupFilesAfterEnv: ["<rootDir>/tests/setup/prisma-test.setup.ts"],

  // If keeping Mongoose only:
  setupFilesAfterEnv: ["<rootDir>/tests/setup/mongo-test.setup.ts"],
};
```

### **Update Imports and Index Files**

After deleting repository implementations, update import statements to prevent TypeScript errors:

**If keeping Prisma only:**

```typescript
// src/features/users/user.container.ts
// Remove this import:
// import { MongoUserRepository } from './user.repository.mongo';
// import { UserModel } from './user.schema.mongoose';

// Keep only:
import { PrismaUserRepository } from "./user.repository.prisma";
```

```typescript
// src/core/db/index.ts
// Remove mongoose export:
// export * from './mongoose';

// Keep only:
export * from "./prisma";
export * from "./client";
```

**If keeping Mongoose only:**

```typescript
// src/features/users/user.container.ts
// Remove this import:
// import { PrismaUserRepository } from './user.repository.prisma';

// Keep only:
import { MongoUserRepository } from "./user.repository.mongo";
import { UserModel } from "./user.schema.mongoose";
```

```typescript
// src/core/db/index.ts
// Remove prisma export:
// export * from './prisma';

// Keep only:
export * from "./mongoose";
export * from "./client";
```

**Apply same pattern to all features:**

- `src/features/auth/auth.container.ts` - Update imports for UserToken and OAuthIdentity repositories
- Any other files importing deleted repository implementations

---

## Keeping Both for Future Flexibility

## Keeping Both for Future Flexibility

**Why Keep Both?** Uncertain about choice, A/B testing, learning, planned migration, multi-tenancy.

**Minimal Overhead:** ~100-200 lines per repository, lightweight dependencies, interface ensures consistency.

**Recommended:** Keep both initially, comment out unused tests in jest.config.js, remove after 2-3 months production.

---

## Migration Strategy: Prototype → Production

**Common workflow:** Start with Mongoose (fast prototyping) → Migrate to Prisma (production).

### **Why This Works**

1. **Mongoose for MVP:**
   - No migrations needed
   - Fast schema iteration
   - Quick local setup (MongoDB Atlas free tier)
   - Focus on features, not database design

2. **Prisma for Production:**
   - Better data integrity (ACID)
   - Easier to scale (PostgreSQL replication)
   - Type-safe migrations
   - Better tooling (Prisma Studio, query debugging)

### **Migration Steps**

#### **Phase 1: Prototype with Mongoose**

```env
DB_STRATEGY=mongoose
DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/myapp"
```

Build your MVP, iterate quickly, validate product-market fit.

#### **Phase 2: Prepare Prisma Schema**

Good news: **You already have Prisma repositories!** You just need to:

1. **Review Prisma schema:**

   ```prisma
   // prisma/schema.prisma
   model User {
     id            String   @id @default(cuid())
     email         String   @unique
     firstName     String
     lastName      String
     passwordHash  String?
     role          String   @default("USER")
     // ... already defined!
   }
   ```

2. **Add production database:**

   ```env
   DATABASE_URL=postgresql://user:pass@prod-db.amazonaws.com:5432/myapp
   ```

3. **Run migrations:**
   ```bash
   pnpm prisma migrate dev --name initial
   ```

#### **Phase 3: Data Migration**

Write a script to migrate data from MongoDB → prisa (PostgreSQL/mySQL/sqlite).
Example below migrates users:

```typescript
// scripts/migrate-mongo-to-postgres.ts
import { PrismaClient } from "@prisma/client";
import mongoose from "mongoose";
import { UserModel } from "@/features/users/user.schema.mongoose";

const prisma = new PrismaClient();

async function migrate() {
  await mongoose.connect(process.env.DATABASE_URL!);

  // Fetch all users from MongoDB
  const mongoUsers = await UserModel.find({});

  // Insert into PostgreSQL
  for (const user of mongoUsers) {
    await prisma.user.create({
      data: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        passwordHash: user.passwordHash,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  console.log(`Migrated ${mongoUsers.length} users`);
}

migrate()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    mongoose.disconnect();
  });
```

Run migration:

```bash
tsx scripts/migrate-mongo-to-postgres.ts
```

#### **Phase 4: Switch Strategy**

```env
# Change environment variable
DB_STRATEGY=prisma
DATABASE_URL=postgresql://user:pass@prod-db.amazonaws.com:5432/myapp
```

#### **Phase 5: Deploy & Verify**

```bash
# Deploy to production
pnpm build
pnpm start

# Verify everything works with Prisma
# Run smoke tests, check logs
```

#### **Phase 6: Clean Up (Optional)**

After running successfully in production for 1-2 weeks:

```bash
# Remove Mongoose artifacts (see "Removing Unused Database Artifacts")
rm src/features/users/user.repository.mongo.ts
rm -rf tests/integration/mongo/
# ... etc
```

### **Advantages of This Approach**

✅ **No business logic changes** - Repository interface stays the same  
✅ **Minimal risk** - Prisma implementation already tested  
✅ **Gradual migration** - Can migrate one feature at a time  
✅ **Rollback option** - Keep Mongoose code until confident  
✅ **Learning opportunity** - Team learns both approaches

---

## Database-Specific Guides

### **Prisma**

**Schema:** `prisma/schema.prisma`  
**Commands:** `pnpm prisma migrate dev`, `pnpm prisma generate`, `pnpm prisma studio`  
**Connection strings:** PostgreSQL, MySQL, SQLite - See [Prisma Docs](https://www.prisma.io/docs/)

### **Mongoose**

**Schemas:** `src/features/*/**.schema.mongoose.ts`  
**Connection strings:** Local MongoDB, MongoDB Atlas - See [Mongoose Docs](https://mongoosejs.com/docs/)

---

## Summary

### **Quick Decision Guide**

| Scenario            | Recommendation                                            |
| ------------------- | --------------------------------------------------------- |
| 🚀 MVP / Prototype  | **Mongoose** - Fast iteration, no migrations              |
| 🏢 Production App   | **Prisma** - Type safety, ACID compliance                 |
| 🎓 Learning Project | **Keep Both** - Learn SQL and NoSQL                       |
| 🔄 Uncertain        | **Start Mongoose → Migrate Prisma** - Best of both worlds |
| 👥 Team knows SQL   | **Prisma** - Familiar territory                           |
| 👥 Team knows NoSQL | **Mongoose** - Familiar territory                         |

### **Key Takeaways**

1. ✅ Both strategies implement the **same interface** - easy to switch
2. ✅ Choose based on **project phase** (prototype vs production)
3. ✅ Can **keep both** with minimal overhead
4. ✅ **Migration path exists** from Mongoose → Prisma
5. ✅ Remove unused strategy when certain (simplify codebase)

---

**Next Steps:**

- Choose your database strategy
- Update `.env` with appropriate connection string
- Run `pnpm dev` to verify connection
- (Optional) Remove unused database artifacts
- Start building! 🚀
