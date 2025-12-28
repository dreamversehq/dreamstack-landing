# Authentication Guide

DreamStack provides a complete authentication system: local auth (email/password), JWT tokens with rotation, OAuth integration, password reset, and email verification.

> **Architecture:** Stateless access JWTs + secure refresh token rotation with reuse detection. Follows best practices from Auth0, AWS Cognito, and Firebase Auth.

> **API Reference:** See interactive Swagger/Scalar documentation at `http://localhost:8000/api-docs` for complete endpoint details and Try It Out functionality.

---

## Quick Start

**Configure `.env`:**

```env
# JWT Configuration (CHANGE IN PRODUCTION!)
JWT_ACCESS_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_ACCESS_EXPIRY=15m  # Access token expiry
JWT_REFRESH_EXPIRY=7d  # Refresh token expiry
AUTH_SALT_ROUNDS=10    # bcrypt salt rounds
```

**⚠️ Generate Strong Secrets:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Authentication Methods

| Method    | Description      | Email Verification |
| --------- | ---------------- | ------------------ |
| **Local** | Email + password | Manual (link sent) |
| **OAuth** | Google, GitHub   | Automatic          |

**OAuth accounts:** `passwordHash` is null, `emailVerified` is true by default.

> **See:** [OAuth Guide](./OAUTH.md) for OAuth setup

---

## API Endpoints

### Register

```http
POST /v1/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "id": "clx123...",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "emailVerified": false,
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Notes:**

- Password must be at least 8 characters
- Email must be unique
- Returns logged-in user with tokens

---

### Login

```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Cases:**

**401 - Invalid Credentials:**

```json
{
  "status": "error",
  "message": "Invalid email or password",
  "code": "ERR_UNAUTHORIZED"
}
```

**401 - OAuth Account:**

```json
{
  "status": "error",
  "message": "This account uses OAuth. Please login with your OAuth provider.",
  "code": "ERR_OAUTH_ACCOUNT"
}
```

---

### Refresh Tokens

```http
POST /v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  # New access token
    "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # New refresh token
  }
}
```

**Important:**

- Old refresh token is invalidated (rotation)
- Always use the new refresh token for next refresh
- Tokens are single-use only

**Error Cases:**

**400 - Invalid/Expired Token:**

```json
{
  "status": "error",
  "message": "Invalid or expired refresh token"
}
```

**403 - Token Reuse Detected:**

```json
{
  "status": "error",
  "message": "Detected reuse of a rotated refresh token. All sessions terminated."
}
```

When token reuse is detected, all refresh tokens for that user are revoked for security.

---

### Logout

```http
POST /v1/auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Notes:**

- Invalidates the refresh token
- Access token remains valid until expiry (15 minutes)
- For complete logout, client should delete both tokens

---

### Forgot Password

Request a password reset email.

```http
POST /v1/auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent."
  }
}
```

**Security Notes:**

- Always returns success (prevents email enumeration)
- OAuth-only accounts receive a different notification email
- Previous reset tokens are automatically revoked

---

### Reset Password

Complete password reset using the token from email.

```http
POST /v1/auth/reset-password
Content-Type: application/json

{
  "token": "abc123...",
  "password": "NewSecurePass456!"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "Password has been reset successfully. Please login with your new password."
  }
}
```

**Error (400):**

```json
{
  "status": "error",
  "message": "Invalid or expired reset token",
  "code": "ERR_INVALID_TOKEN"
}
```

**Security Notes:**

- Tokens are single-use (invalidated after use)
- Tokens expire after 1 hour (configurable via `PASSWORD_RESET_EXPIRY`)
- All existing sessions are terminated on password reset

---

### Verify Email

Verify email address using the token from verification email.

```http
POST /v1/auth/verify-email
Content-Type: application/json

{
  "token": "xyz789..."
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "Email verified successfully."
  }
}
```

**Error (400):**

```json
{
  "status": "error",
  "message": "Invalid or expired verification token",
  "code": "ERR_INVALID_TOKEN"
}
```

---

### Resend Verification Email

Request a new verification email.

```http
POST /v1/auth/resend-verification
Content-Type: application/json

{
  "email": "john@example.com"
}
```

**Response (200):**

```json
{
  "status": "success",
  "data": {
    "message": "If an account with that email exists and is not yet verified, a verification email has been sent."
  }
}
```

**Security Notes:**

- Always returns success (prevents email enumeration)
- Does nothing if email is already verified
- Previous verification tokens are automatically revoked

---

## JWT Token Structure

### Access Token

**Purpose:** Authenticate API requests  
**Expiry:** 15 minutes (configurable)  
**Usage:** Send in Authorization header

**Payload:**

```json
{
  "sub": "clx123...", // User ID
  "role": "USER", // User role
  "jti": "abc789...", // JWT ID - unique identifier for the token
  "iat": 1699564800, // Issued at (automatically added)
  "exp": 1699565700 // Expires at (15 min later, automatically added)
}
```

**How to Use:**

```bash
curl -X GET http://localhost:8000/v1/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Refresh Token

**Purpose:** Get new access tokens  
**Expiry:** 7 days (configurable)  
**Usage:** Send to `/auth/refresh` endpoint

**Payload:**

```json
{
  "sub": "clx123...", // User ID
  "role": "USER", // User role
  "jti": "xyz456...", // JWT ID - unique identifier for the token
  "iat": 1699564800, // Issued at (automatically added)
  "exp": 1700169600 // Expires at (7 days later, automatically added)
}
```

**Storage:**

- Hashed in database (HKDF-derived key)
- Single-use (rotated on refresh)
- Revoked on logout

---

## Refresh Token Rotation

DreamStack implements automatic token rotation for security:

### How It Works

```
1. Client → POST /auth/refresh with refreshTokenA
2. Server validates refreshTokenA
3. Server generates new tokens (accessTokenB, refreshTokenB)
4. Server marks refreshTokenA as used (invalidates it)
6. Server → Returns { access: tokenB, refresh: tokenB }
7. Client stores new tokens, discards old ones
```

**Security Benefits:**

- Detects token theft (reuse triggers global revocation)
- Limits damage (tokens have short lifetime)
- Automatic revocation on suspicious activity

---

## Password Security

**Hashing:**

- Algorithm: bcrypt with configurable salt rounds (`AUTH_SALT_ROUNDS`)
- Never returned in API responses (removed via `toUserResponse()` utility)

**Validation:**

- Minimum 8 characters
- No maximum (supports passphrases)

**Production Considerations:**

- Password strength meter
- Common password check
- Breach database check (HaveIBeenPwned API)

---

## Role-Based Access Control (RBAC)

**Available Roles:**

```typescript
enum UserRole {
  USER = "USER", // Default role
  EDITOR = "EDITOR", // Content management (future)
  ADMIN = "ADMIN", // Full access
}
```

**Authorization Middleware:**

```typescript
// Require specific role
router.get("/users", authorize(UserRole.ADMIN), listUsers);

// Multiple roles
router.get("/posts", authorize(UserRole.EDITOR, UserRole.ADMIN), getPosts);
```

**Flow:**

```
1. Request with access token
2. authenticate() validates token
3. User attached to req.ctx.user
4. authorize(role) checks user.role
5. Authorized → proceed | Unauthorized → 403
```

---

## Database Schema

### User Table

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?   # Null for OAuth users
  firstName     String
  lastName      String
  role          String    @default("USER")
  emailVerified Boolean   @default(false)
  avatar        String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  tokens        UserToken[]
  oauthIdentities OAuthIdentity[]
}
```

### UserToken Table

```prisma
model UserToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   # Hashed refresh token
  type      String   # 'REFRESH'
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}
```

**Notes:**

- Tokens are hashed before storage (HKDF-derived key)
- Expired tokens should be cleaned up periodically
- Type field allows for future token types (email verification, password reset)

---

## Security Features

### 1. Token Hashing

Refresh tokens are hashed before database storage:

```typescript
// Use HKDF to derive separate key from JWT_REFRESH_SECRET
const REFRESH_HASH_KEY = hkdfSync(
  "sha256",
  Buffer.from(JWT_REFRESH_SECRET),
  Buffer.from("refresh-hash-salt-v1"),
  Buffer.from("refresh-store-key-v1"),
  32,
);

// Hash token before storage
const tokenHash = createHmac("sha256", REFRESH_HASH_KEY).update(refreshToken).digest("hex");
```

**Why?**

- Database breach doesn't expose usable tokens
- Adds extra layer of security
- Industry best practice

### 2. Token Rotation

- Refresh tokens are single-use
- Each refresh generates new pair
- Old token immediately invalidated
- Detects token theft/reuse

### 3. Reuse Detection

If a used refresh token is presented again:

```typescript
// All user's refresh tokens are revoked
await userTokenRepo.revokeAllForUser(userId, "REFRESH");
throw new AppError(403, "Detected reuse. All sessions terminated.");
```

### 4. Password Validation

- OAuth accounts can't use password login (prevents confusion)
- Password must exist for local accounts
- Bcrypt comparison (constant time)

### 5. CORS Protection

Configure allowed origins:

```env
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

---

## Production Checklist

**Already Implemented** ✅:

- Token rotation with reuse detection
- Password reset + email verification flows
- Rate limiting on auth endpoints
- Token cleanup cron (hourly)
- Security headers (helmet)
- Request logging with trace IDs

**Configure Before Deploying:**

- [ ] **Change JWT secrets** (see [Security Guide](./AUTH_SECURITY.md#1-generate-strong-secrets-required))
- [ ] **Configure CORS** (set specific origins, not `*`)
- [ ] **Enable HTTPS** (required for secure cookies)
- [ ] **Configure email provider** (for verification/reset emails)
- [ ] **Review rate limits** (adjust based on traffic)

---

## Configuration

**Environment Variables:**

```env
# Required
JWT_ACCESS_SECRET=<64-char-hex-string>
JWT_REFRESH_SECRET=<64-char-hex-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
AUTH_SALT_ROUNDS=10

# Password Reset / Email Verification
PASSWORD_RESET_EXPIRY=1h
APP_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
```

**Token Expiry Formats:** `15m`, `1h`, `7d`, `2w`, `1y`

---

## Troubleshooting

**"Invalid or expired refresh token"**

- Token expired (> 7 days old) or already used (rotation)
- All tokens revoked (reuse detection triggered)
- Wrong `JWT_REFRESH_SECRET`
- **Solution:** User must login again

**"This account uses OAuth"**

- User registered with Google/GitHub, trying password login
- **Solution:** Use OAuth login or add password via profile update

**Access token not recognized**

- Token expired (> 15 minutes) or wrong `JWT_ACCESS_SECRET`
- **Solution:** Refresh the access token

---

## Related Documentation

- [Auth Security Guide](./AUTH_SECURITY.md) — Threat models, production checklist
- [OAuth Guide](./OAUTH.md) — Social login integration
- [Self-Service Endpoints](./SELF_SERVICE_ENDPOINTS.md) — User profile management

---

## Summary

DreamStack authentication provides a **complete, production-ready auth system**:

| Feature                          | Status |
| -------------------------------- | ------ |
| Email/Password Registration      | ✅     |
| JWT Access + Refresh Tokens      | ✅     |
| Token Rotation + Reuse Detection | ✅     |
| Password Reset Flow              | ✅     |
| Email Verification               | ✅     |
| OAuth (Google, GitHub)           | ✅     |
| Role-Based Access Control        | ✅     |
| Rate Limiting                    | ✅     |
| Token Cleanup Cron               | ✅     |

**Next Steps:**

1. Configure JWT secrets ([how-to](./AUTH_SECURITY.md#1-generate-strong-secrets-required))
2. Configure email provider for verification/reset emails
3. Test the auth flow with your frontend
4. (Optional) Setup OAuth providers
