# Self-Service User Profile Endpoints

The `/users/me` pattern allows authenticated users to manage their own profiles without admin privileges or knowing their user ID. This is an industry-standard approach used by GitHub, Discord, Twitter, and other major APIs.

> **API Reference:** See the interactive Swagger/Scalar documentation at `http://localhost:8000/api-docs` for complete endpoint details, request/response schemas, and Try It Out functionality.

---

## Overview

All `/me` endpoints automatically use the authenticated user's ID from the JWT token, providing secure self-service profile management.

| Endpoint           | Method | Purpose            | Role |
| ------------------ | ------ | ------------------ | ---- |
| `/users/me`        | GET    | Get own profile    | USER |
| `/users/me`        | PATCH  | Update own profile | USER |
| `/users/me/avatar` | POST   | Upload own avatar  | USER |
| `/users/me/avatar` | DELETE | Delete own avatar  | USER |

---

## Endpoint Details

### GET /users/me

Retrieve your own profile information.

**Authorization:** USER role  
**Returns:** User profile (excludes password hash)

```json
{
  "status": "success",
  "data": {
    "id": "clx123abc...",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "role": "USER",
    "avatar": "http://localhost:8000/public/avatars/user-123.jpg",
    "emailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### PATCH /users/me

Update your own profile information.

**Authorization:** USER role

**Allowed Fields:**

- `firstName` (string, min 3 characters)
- `lastName` (string, min 3 characters)
- `email` (valid email format)
- `password` (string, min 6 characters)

**Restricted Fields:**

- `role` - Only admins can change user roles
- `avatar` - Use `/users/me/avatar` endpoints
- `emailVerified` - Managed by verification flow

**Error Responses:**

- **400** - Validation error
- **403** - Attempting to change role
- **409** - Email already in use

---

### POST /users/me/avatar

Upload your own avatar image.

**Authorization:** USER role

**Requirements:**

- **Allowed types:** JPEG, PNG, WebP
- **Max size:** 5MB
- **Field name:** `avatar`

---

### DELETE /users/me/avatar

Delete your own avatar image.

**Authorization:** USER role  
**Safe:** Can be called even if no avatar exists

---

## Security Features

### 1. Automatic User ID Resolution

All `/me` endpoints use `req.ctx.user.id` from the JWT token. Users cannot access or modify other users' profiles.

### 2. Role Protection

The `updateMe` endpoint prevents users from changing their own role:

```typescript
const { role, ...allowedUpdates } = req.body;
if (role) {
  throw new AppError(403, "You cannot change your own role", "ERR_FORBIDDEN");
}
```

### 3. Password Hash Omission

All user responses use `toUserResponse()` utility that removes sensitive data:

```typescript
export function toUserResponse(user: User): UserResponseDTO {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
```

### 4. Field Validation

The `updateMeSchema` explicitly excludes fields users shouldn't modify:

- `role` - Prevents privilege escalation
- `avatar` - Use dedicated avatar endpoints
- `emailVerified` - Managed by verification flow

---

## Admin Equivalents

For each self-service endpoint, there's an admin endpoint that can manage any user:

| Self-Service              | Admin Equivalent           | Purpose                          |
| ------------------------- | -------------------------- | -------------------------------- |
| `GET /users/me`           | `GET /users/:id`           | View any user                    |
| `PATCH /users/me`         | `PATCH /users/:id`         | Update any user (including role) |
| `POST /users/me/avatar`   | `POST /users/:id/avatar`   | Upload avatar for any user       |
| `DELETE /users/me/avatar` | `DELETE /users/:id/avatar` | Delete avatar for any user       |

Admin endpoints additionally support changing roles, email verification status, and moderation actions.

---

## Password Change Security ⚠️

**Current Behavior:** Password can be changed via `PATCH /users/me` without old password verification.

**Why:**

- ✅ Allows OAuth users to add a password (enable local login)
- ✅ Simpler for development/testing
- ❌ If JWT is compromised, attacker can lock out user

**Production Recommendation:**

Create dedicated `/auth/change-password` endpoint:

```typescript
// POST /auth/change-password
{
  "oldPassword": "current123",
  "newPassword": "new456",
  "confirmPassword": "new456"
}
```

**Implementation:**

1. Verify old password matches
2. Validate new password strength
3. Hash and update password
4. Send email notification
5. Optional: Invalidate other sessions

---

## Production Enhancements

### Email Change Verification

**Current:** Email updates immediately without verification

**Recommended:**

1. User submits new email
2. Send verification link to new email
3. User confirms via link
4. Email updated + notification to old email

### Rate Limiting

Protect profile updates:

```typescript
import { createRateLimiter } from "@/common/middlewares/rate-limit";

const profileUpdateLimiter = createRateLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000, // 10 updates per hour
  message: "Too many profile updates, please try again later",
});

router.patch("/me", profileUpdateLimiter, authorize(UserRole.USER), updateMe);
```

### Audit Trail

Log profile changes:

```typescript
// Add to user.service.ts after updates
logger.info("Profile updated", {
  userId: user.id,
  action: "PROFILE_UPDATE",
  changes: { firstName: { from: "John", to: "Jane" } },
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
});
```

### Additional Fields

Consider extending profiles:

- Phone number (with verification)
- Bio/description
- Two-factor authentication
- Profile visibility settings

---

## Implementation

**File Structure:**

```
src/features/users/
├── user.controller.ts      # getMe, updateMe methods
├── user.route.ts           # /me route definitions
├── user.validator.ts       # updateMeSchema validation
├── user.service.ts         # Business logic
└── user.utils.ts           # toUserResponse utility
```

**Key Patterns:**

Controller:

```typescript
export const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = await container.users.service.getUserById(req.ctx.user.id);
  sendSuccess(res, toUserResponse(user));
});
```

Validation:

```typescript
export const updateMeSchema = z
  .object({
    firstName: z.string().min(3).optional(),
    lastName: z.string().min(3).optional(),
    password: z.string().min(6).optional(),
    email: z.string().email().optional(),
  })
  .strict();
```

---

## Template Philosophy

This template provides a **flexible foundation** for rapid development:

**✅ Included:**

- Complete self-service profile management
- Role-based authorization
- Security best practices (JWT, password hashing)
- Clear documentation of trade-offs

**🔧 Customize Based on Your Needs:**

- Password change security (threat model)
- Email verification flow (use case)
- Rate limiting (user behavior)
- Additional fields (app requirements)

---

## Related Documentation

- [File Uploads](./FILE_UPLOADS.md) - Avatar upload feature
- [OAuth](./OAUTH.md) - Social login integration
- [Authentication](./AUTHENTICATION.md) - Complete auth system
- [Rate Limiting](./RATE_LIMITING.md) - API protection
