# OAuth Authentication Guide

Complete guide to setting up and using OAuth authentication (Google, GitHub) in DreamStack.

## Overview

DreamStack provides a **production-grade, cross-platform OAuth 2.0 implementation** that works seamlessly across:

- ✅ Web Applications (SPA/PWA)
- ✅ Mobile Apps (iOS/Android)
- ✅ Desktop Applications
- ✅ CLI Tools

Unlike traditional OAuth flows that rely on cookies and browser sessions, this implementation uses a **three-phase token exchange** that works regardless of where the OAuth flow starts or ends.

---

## Quick Start

### 1. Get OAuth Credentials

**Google OAuth:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable APIs → Create OAuth 2.0 Client ID
3. Configure consent screen
4. Add authorized redirect URI: `http://localhost:8000/v1/auth/oauth/google/callback`
5. Copy Client ID and Client Secret

**GitHub OAuth** (optional):

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create new OAuth App
3. Set callback URL: `http://localhost:8000/v1/auth/oauth/github/callback`
4. Copy Client ID and Client Secret

### 2. Configure Environment

Add to `.env`:

```env
# OAuth Base Configuration
APP_URL=http://localhost:8000

# Redirect URI Whitelist (comma-separated, for cross-platform support)
OAUTH_REDIRECT_WHITELIST=http://localhost:3000,https://app.example.com,myapp://,mycliapp://

# Google OAuth (required for Google login)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

**Important:** Restart your server after updating `.env`

---

## Architecture

#### Phase 1: Authorize

**Endpoint:** `GET /v1/auth/oauth/:provider/authorize?redirect_uri=...`

- Client requests authorization URL with their `redirect_uri`
- Server validates `redirect_uri` against whitelist (prevents open redirect attacks)
- Generates cryptographically secure `state` token (CSRF protection)
- Generates PKCE `codeVerifier` and `codeChallenge` (enhanced security)
- Stores state data in cache with 5-minute TTL
- Returns `authUrl` for client to open in browser/webview

#### Phase 2: Callback

**Endpoint:** `GET /v1/auth/oauth/:provider/callback?code=...&state=...`

- Provider redirects to this endpoint after user authorizes
- Server validates `state` token (prevents CSRF)
- Exchanges authorization `code` for access token using PKCE verifier
- Fetches user profile from provider
- Creates or updates user in database
- Links OAuth identity to user account
- Generates One-Time Code (OTC) with 30-second TTL
- Redirects to client's `redirect_uri?code=OTC`

#### Phase 3: Token Exchange

**Endpoint:** `POST /v1/auth/oauth/token`

- Client extracts OTC from redirect URL
- Exchanges OTC for app JWT tokens
- OTC is burned after use (single-use, prevents replay attacks)
- Returns user data + access/refresh tokens

---

## API Endpoints

### Get Authorization URL

```http
GET /v1/auth/oauth/:provider
```

**Parameters:**

- `provider`: `google` | `github`

**Response:**

```json
{
  "status": "success",
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
    "redirectUri": "http://localhost:8000/v1/auth/oauth/google/callback"
  }
}
```

**Usage:**

```javascript
// Frontend: Redirect user to OAuth provider
const response = await fetch("/v1/auth/oauth/google");
const { authUrl } = await response.json();
window.location.href = authUrl;
```

---

### Handle OAuth Callback

```http
GET /v1/auth/oauth/:provider/callback?code=AUTHORIZATION_CODE&state=STATE_TOKEN
```

**Parameters:**

- `provider`: `google` | `github`
- `code`: Authorization code (query parameter from OAuth provider)
- `state`: CSRF protection token

**Response (New User):**

```json
{
  "status": "success",
  "data": {
    "id": "clx123...",
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "emailVerified": true,
    "avatar": "https://lh3.googleusercontent.com/...",
    "access": "eyJhbG...",
    "refresh": "eyJhbG..."
  }
}
```

**Flow:**

1. User completes OAuth → Provider redirects to callback URL with `code`
2. Backend exchanges `code` for OAuth tokens
3. Backend creates user (if new) or finds existing user
4. Backend returns JWT tokens for your app

---

### Link OAuth Account

```http
POST /v1/auth/oauth/link/:provider
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "code": "AUTHORIZATION_CODE",
  "state": "STATE_TOKEN"
}
```

**Purpose:** Link OAuth provider to an already-authenticated user

**Parameters:**

- `provider`: `google` | `github`
- `code`: Authorization code from OAuth provider
- `state`: State token from authorization request

**Response:**

```json
{
  "status": "success",
  "data": {
    "message": "Successfully linked google account"
  }
}
```

**Use Case:** User signed up with email/password, now wants to add Google login

**Security Features:**

- Requires authentication (JWT token)
- Validates email matches between user account and OAuth profile
- Prevents linking if OAuth account is already in use
- Uses same PKCE and state validation as regular OAuth flow

---

## Authentication Flows

### New User Sign-Up via OAuth

```
1. User clicks "Sign in with Google"
2. Frontend → GET /v1/auth/oauth/google/authorize?redirect_uri=...
3. Backend returns authUrl and state token
4. Frontend redirects user to Google login
5. User authorizes on Google
6. Google → Redirects to /v1/auth/oauth/google/callback?code=xxx&state=yyy
7. Backend validates state, exchanges code for user profile
8. Backend creates user account and returns OTC (one-time code)
9. Frontend → POST /v1/auth/oauth/token with OTC
10. Backend returns JWT tokens
11. User is logged in ✅
```

### Existing User Login via OAuth

### Existing User Login via OAuth

```
1. User clicks "Sign in with Google"
2. Frontend → GET /v1/auth/oauth/google/authorize?redirect_uri=...
3. Backend returns authUrl and state token
4. Frontend redirects user to Google
5. Google → Redirects to /v1/auth/oauth/google/callback?code=xxx&state=yyy
6. Backend finds existing user by OAuth identity
7. Backend returns OTC
8. Frontend → POST /v1/auth/oauth/token with OTC
9. Backend returns JWT tokens
10. User is logged in ✅
```

### Link OAuth to Existing Account

```
1. User logged in with email/password
2. User clicks "Link Google Account"
3. Frontend → GET /v1/auth/oauth/google/authorize?redirect_uri=...
4. Backend returns state token
5. User redirected to Google to authorize
6. Google → Redirects to /v1/auth/oauth/google/callback?code=xxx&state=yyy
7. Backend validates state, redirects to client redirect_uri with code
8. Frontend → POST /v1/auth/oauth/link/google with code + state + JWT
9. Backend validates, exchanges code, and links OAuth identity
9. User can now login with either method ✅
```

**Note:** The link flow is similar to the regular OAuth flow but requires authentication and validates that the OAuth email matches the user's account email.

---

## Database Schema

OAuth identities are stored separately from users:

```prisma
model OAuthIdentity {
  id              String    @id @default(cuid())
  userId          String
  provider        String    // 'google' | 'github'
  providerUserId  String    // Provider's user ID
  accessToken     String?   // OAuth access token
  refreshToken    String?   // OAuth refresh token
  expiresAt       DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
}
```

**Key Points:**

- One user can have multiple OAuth identities (Google + GitHub)
- OAuth users don't have `passwordHash` in User table
- `emailVerified` is automatically `true` for OAuth users

---

## URL Structure

All OAuth routes follow a consistent pattern:

```
/v1/auth/oauth/{action}/{provider}
```

**Examples:**

```
GET  /v1/auth/oauth/google              → Get auth URL
GET  /v1/auth/oauth/callback/google     → Handle callback
POST /v1/auth/oauth/link/google         → Link account

GET  /v1/auth/oauth/github              → Get auth URL
GET  /v1/auth/oauth/callback/github     → Handle callback
POST /v1/auth/oauth/link/github         → Link account
```

**Why This Pattern:**

- ✅ Consistent and predictable
- ✅ RESTful (action describes operation)
- ✅ Self-documenting URLs
- ✅ Easy to add new providers

---

## Configuration Details

### Environment Variables

**`APP_URL`** (required)

- Base URL of your API server
- Used to construct OAuth callback URLs
- Example: `http://localhost:8000` or `https://api.yourdomain.com`

**`OAUTH_REDIRECT_WHITELIST`** (recommended for production)

- Comma-separated list of allowed client redirect URIs
- Prevents open redirect vulnerabilities
- Supports schemes: `http://`, `https://`, `myapp://` (custom protocols)
- Example: `http://localhost:3000,https://app.example.com,myapp://`

**Provider Credentials:**

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`

### OAuth Callback URLs

Configure these in your OAuth provider consoles:

- Google: `{APP_URL}/v1/auth/oauth/callback/google`
- GitHub: `{APP_URL}/v1/auth/oauth/callback/github`

**Development:**

```
http://localhost:8000/v1/auth/oauth/callback/google
http://localhost:8000/v1/auth/oauth/callback/github
```

**Production:**

```
https://api.yourdomain.com/v1/auth/oauth/callback/google
https://api.yourdomain.com/v1/auth/oauth/callback/github
```

---

## Platform-Specific Implementations

### Web Application (SPA/PWA)

```typescript
// 1. Request authorization URL
const response = await fetch(
  "http://localhost:8000/v1/auth/oauth/google/authorize?redirect_uri=http://localhost:3000/callback",
);
const { authUrl, state } = await response.json();

// 2. Open in popup or redirect
window.location.href = authUrl;

// 3. In callback page (http://localhost:3000/callback?code=OTC)
const params = new URLSearchParams(window.location.search);
const otc = params.get("code");

// 4. Exchange OTC for tokens
const tokenResponse = await fetch("http://localhost:8000/v1/auth/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: otc }),
});
const { access, refresh, ...user } = await tokenResponse.json().data;

// 5. Store tokens and redirect to app
localStorage.setItem("access_token", access);
localStorage.setItem("refresh_token", refresh);
window.location.href = "/dashboard";
```

### Mobile App (React Native)

```typescript
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

async function handleOAuthLogin() {
  // 1. Request authorization URL
  const response = await fetch("http://localhost:8000/v1/auth/oauth/google/authorize?redirect_uri=myapp://callback");
  const { authUrl } = await response.json();

  // 2. Open in system browser
  const result = await WebBrowser.openAuthSessionAsync(authUrl, "myapp://callback");

  if (result.type === "success") {
    // 3. Extract OTC from redirect URL
    const { queryParams } = Linking.parse(result.url);
    const otc = queryParams.code;

    // 4. Exchange OTC for tokens
    const tokenResponse = await fetch("http://localhost:8000/v1/auth/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: otc }),
    });
    const { access, refresh, ...user } = await tokenResponse.json().data;

    // 5. Store tokens securely
    await SecureStore.setItemAsync("access_token", access);
    await SecureStore.setItemAsync("refresh_token", refresh);

    // Navigate to app
    navigation.navigate("Home");
  }
}
```

### Desktop App (Electron)

```typescript
import { shell, BrowserWindow } from "electron";

async function handleOAuthLogin() {
  // 1. Request authorization URL
  const response = await fetch(
    "http://localhost:8000/v1/auth/oauth/google/authorize?redirect_uri=mydesktopapp://callback",
  );
  const { authUrl } = await response.json();

  // 2. Open in system browser
  await shell.openExternal(authUrl);

  // 3. Listen for custom protocol callback
  app.on("open-url", async (event, url) => {
    event.preventDefault();

    // Extract OTC from mydesktopapp://callback?code=OTC
    const urlObj = new URL(url);
    const otc = urlObj.searchParams.get("code");

    // 4. Exchange OTC for tokens
    const tokenResponse = await fetch("http://localhost:8000/v1/auth/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: otc }),
    });
    const { access, refresh, ...user } = await tokenResponse.json().data;

    // 5. Store tokens in secure storage
    // (Use electron-store or similar)
  });
}
```

### CLI Tool

```bash
#!/bin/bash

# 1. Get authorization URL
AUTH_RESPONSE=$(curl -s "http://localhost:8000/v1/auth/oauth/google/authorize?redirect_uri=mycli://callback")
AUTH_URL=$(echo $AUTH_RESPONSE | jq -r '.data.authUrl')

# 2. Open in browser
echo "Opening browser for authentication..."
open "$AUTH_URL"  # macOS
# xdg-open "$AUTH_URL"  # Linux
# start "$AUTH_URL"      # Windows

# 3. Start local server to catch callback
echo "Waiting for callback on http://localhost:9999..."
OTC=$(nc -l 9999 | grep -oP 'code=\K[^&\s]+')

# 4. Exchange OTC for tokens
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8000/v1/auth/oauth/token \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$OTC\"}")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.data.access')
REFRESH_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.data.refresh')

# 5. Store tokens
echo $ACCESS_TOKEN > ~/.mycli/access_token
echo $REFRESH_TOKEN > ~/.mycli/refresh_token

echo "Authentication successful!"
```

---

## Frontend Integration

### React Example

```typescript
// hooks/useOAuth.ts
export function useOAuth() {
  const login = async (provider: 'google' | 'github') => {
    // Get auth URL
    const res = await fetch(`/v1/auth/oauth/${provider}`);
    const { authUrl } = await res.json();

    // Redirect to OAuth provider
    window.location.href = authUrl;
  };

  const handleCallback = () => {
    const code = new URLSearchParams(window.location.search).get('code');

    if (code) {
      // Backend automatically handles callback
      // Store returned JWT tokens in localStorage/cookies
      const data = /* parse JSON from page */;
      localStorage.setItem('accessToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);

      // Redirect to dashboard
      router.push('/dashboard');
    }
  };

  return { login, handleCallback };
}
```

### Usage in Component

```tsx
function LoginPage() {
  const { login } = useOAuth();

  return (
    <div>
      <button onClick={() => login("google")}>Sign in with Google</button>
      <button onClick={() => login("github")}>Sign in with GitHub</button>
    </div>
  );
}
```

### Linking OAuth Account Example

```typescript
// For logged-in users who want to add OAuth login
export function useLinkOAuth() {
  const linkAccount = async (provider: 'google' | 'github') => {
    // 1. Get authorization URL (same as login)
    const res = await fetch(`/v1/auth/oauth/${provider}/authorize?redirect_uri=${window.location.origin}/link-callback`);
    const { authUrl, state } = await res.json();

    // 2. Redirect to OAuth provider
    window.location.href = authUrl;
  };

  const handleLinkCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const provider = /* extract from URL or state */;

    if (code && state) {
      const accessToken = localStorage.getItem('accessToken');

      // 3. Link the OAuth account
      const res = await fetch(`/v1/auth/oauth/link/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ code, state })
      });

      const data = await res.json();
      if (data.status === 'success') {
        alert('OAuth account linked successfully!');
        router.push('/settings');
      }
    }
  };

  return { linkAccount, handleLinkCallback };
}
```

---

## Error Handling

### Common Errors

**`invalid_grant`**

- **Cause:** Redirect URI mismatch or expired code
- **Fix:** Ensure `.env` matches provider console exactly
- **Note:** Authorization codes expire in 60 seconds

**`redirect_uri_mismatch`**

- **Cause:** URI in request doesn't match provider console
- **Fix:** Check `APP_URL` in `.env`

**`OAuth provider not supported`**

- **Cause:** Missing provider credentials in `.env`
- **Fix:** Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**`This account uses OAuth`**

- **Cause:** User trying password login but account created via OAuth
- **Fix:** User must use OAuth login or create a password

**`This OAuth account is already linked to your account`**

- **Cause:** Trying to link an OAuth account that's already linked to the current user
- **Fix:** No action needed, account already linked

**`This OAuth account is already linked to another account`**

- **Cause:** The OAuth account is already used by a different user
- **Fix:** Cannot link - must use a different OAuth account

**`OAuth account email does not match your account email`**

- **Cause:** Security check - OAuth email must match user's primary email
- **Fix:** Contact support or use an OAuth account with matching email

---

## Security

### Token Storage

- OAuth tokens encrypted in database
- JWT refresh tokens use HKDF-derived keys for hashing
- Refresh token rotation prevents reuse attacks

### Email Verification

- OAuth users automatically have `emailVerified: true`
- Providers already verify email addresses

### PKCE (Proof Key for Code Exchange)

Enhanced security for public clients (mobile/desktop apps).

- Google: Uses S256 (SHA-256) code challenge method
- GitHub: Does not support PKCE (uses state-only)

### Atomic Delete Operations

Both `state` and OTC use "burn after reading" to prevent replay attacks.

- State: Read and deleted atomically during callback
- OTC: Read and deleted atomically during token exchange

### Short TTLs

- State: 5 minutes (enough time to complete OAuth flow)
- OTC: 30 seconds (just enough time for client to exchange)

### Account Linking

Automatically links OAuth accounts to existing users with the same verified email.

**Scenarios:**

1. **New user**: Creates account with OAuth provider info
2. **Existing user (same email)**: Links OAuth identity to existing account
3. **Existing OAuth user**: Returns existing user data

---

## Provider Configuration

### Google OAuth Setup

**Required Scopes:**

- `openid` - OpenID Connect
- `profile` - Basic profile info
- `email` - Email address

**User Profile Fields:**

- `id` - Google user ID
- `email` - Verified email
- `name` - Full name
- `given_name` - First name
- `family_name` - Last name
- `picture` - Avatar URL
- `verified_email` - Email verification status

**PKCE Support:** ✅ Yes (S256 method)

### GitHub OAuth Setup

**Required Scopes:**

- `read:user` - Read user profile
- `user:email` - Read email addresses

**User Profile Fields:**

- `id` - GitHub user ID
- `login` - Username
- `name` - Full name (may be null)
- `email` - Primary email (may be private)
- `avatar_url` - Avatar URL

**Email Handling:**
GitHub may not return email in profile if it's private. The implementation fetches emails separately and uses the primary verified email.

**PKCE Support:** ❌ No (uses state parameter only)

---

## Adding More Providers

To add a new OAuth provider (e.g., Twitter, Microsoft):

1. **Create Provider Class**

   ```typescript
   // src/features/auth/providers/twitter.provider.ts
   export class TwitterOAuthProvider implements IOAuthProvider {
     // Implement interface methods
   }
   ```

2. **Register in Container**

   ```typescript
   // src/features/auth/auth.container.ts
   if (ENV.TWITTER_CLIENT_ID && ENV.TWITTER_CLIENT_SECRET) {
     providers.set('twitter', new TwitterOAuthProvider({ ... }));
   }
   ```

3. **Add Environment Variables**

   ```env
   TWITTER_CLIENT_ID=xxx
   TWITTER_CLIENT_SECRET=xxx
   ```

4. **Update Types**
   ```typescript
   // src/features/auth/auth.types.ts
   export type OAuthProvider = "google" | "github" | "twitter";
   ```

---

## Testing

### Manual Testing

```bash
# 1. Start server
pnpm dev

# 2. Get auth URL
curl "http://localhost:8000/v1/auth/oauth/google"

# 3. Open authUrl in browser, complete sign-in
# You'll be redirected to callback URL with response

# 4. Verify user created in database
# Check OAuthIdentity record exists
```

### Automated Tests

```bash
pnpm test oauth
```

Covers:

- Creating OAuth identities
- Finding by provider/user
- Updating tokens
- Token expiration
- Linking/unlinking accounts

---

## Production Checklist

Before deploying:

- [ ] Update `APP_URL` to production URL
- [ ] Configure redirect URIs in provider consoles
- [ ] Test OAuth flow on staging environment
- [ ] Verify error handling (expired codes, mismatched URIs)
- [ ] Set up monitoring for OAuth failures
- [ ] Document OAuth setup for your team
- [ ] Never commit `.env` with real credentials

---

## Troubleshooting

### Enable Debug Logging

```typescript
// Temporarily add to oauth.auth.service.ts
console.log("OAuth tokens:", tokens);
console.log("User profile:", profile);
console.log("Redirect URI:", redirectUri);
```

### Check Provider Initialization

Server logs should show:

```
✅ Google OAuth provider initialized
✅ DI Container initialized successfully
```

If not, check:

- Environment variables are set
- Server was restarted after `.env` changes
- No typos in client ID/secret

### Verify Database Connection

OAuth requires working database for:

- User creation/lookup
- OAuth identity storage
- Token management

---

## Architecture Notes

The OAuth implementation follows DreamStack's swappable repository pattern:

**Repositories:**

- `PrismaOAuthIdentityRepository` (SQL databases)
- `MongoOAuthIdentityRepository` (MongoDB)

**Services:**

- `OAuthAuthService` - Main OAuth logic
- Provider classes - Google, GitHub, etc.
- `TokenService` - JWT generation

**Strategy Pattern:**
Providers are registered conditionally based on env vars, making it easy to enable/disable OAuth methods.

---

## Deployment Considerations

### Multi-Instance Deployments

⚠️ **Important:** The default `LocalOAuthStore` uses in-memory caching via `node-cache`, which **does not work across multiple server instances**.

**For production multi-instance deployments, you must:**

1. Implement a distributed cache store (Redis recommended)
2. Create a class implementing `IOAuthStore` interface
3. Replace `LocalOAuthStore` in `auth.container.ts`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

## Future Enhancements

Features you might want to add:

1. **OAuth Account Unlinking**
   - Allow users to disconnect OAuth providers
   - Validate user has alternative auth method

2. **Token Refresh**
   - Refresh OAuth access tokens when expired
   - Store in background job

3. **Profile Sync**
   - Sync avatar from provider
   - Update name if changed

4. **Multi-Provider Support**
   - Allow same email across providers
   - Merge accounts automatically

See `.todos/DOCUMENTATION_NOTES.md` for implementation guides.

---

## Summary

DreamStack's OAuth implementation provides:

- ✅ Easy setup (just add credentials to `.env`)
- ✅ Multiple providers (Google, GitHub)
- ✅ Account linking (add OAuth to existing account)
- ✅ Automatic user creation
- ✅ Secure token handling
- ✅ Production-ready architecture

**Next Steps:**

- Set up OAuth credentials
- Test the flow locally
- Integrate with your frontend
- Deploy to production

Need help? Check the error handling section or review server logs for detailed error messages.

---

## Related Documentation

- [Authentication Overview](./AUTHENTICATION.md)
- [Security Best Practices](./AUTH_SECURITY.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Getting Started](./GETTING_STARTED.md)
