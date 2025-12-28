# File Uploads

Complete guide to file uploads in DreamStack - supports avatar uploads with local/S3 storage.

---

## Quick Start

**1. Configuration** (already set up):

```env
# .env.example
STORAGE_TYPE=local
LOCAL_STORAGE_BASE_PATH=./uploads
LOCAL_STORAGE_BASE_URL=http://localhost:8000/public
```

**2. Upload avatar:**

```bash
curl -X POST http://localhost:8000/v1/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "avatar=@photo.jpg"
```

**3. Access file:**

```
http://localhost:8000/public/avatars/userid-timestamp.jpg
```

---

## API Endpoints

### Self-Service (USER role)

#### Upload My Avatar

```http
POST /v1/users/me/avatar
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: multipart/form-data

avatar: [FILE]
```

**Requirements:**

- Types: JPEG, PNG, WebP
- Max: 5MB
- Field: `avatar`

**Response:**

```json
{
  "status": "success",
  "data": {
    "id": "clx123...",
    "email": "user@example.com",
    "avatar": "http://localhost:8000/public/avatars/clx123-1731868800.jpg"
  }
}
```

#### Delete My Avatar

```http
DELETE /v1/users/me/avatar
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Admin (ADMIN role)

```http
POST   /v1/users/:id/avatar
DELETE /v1/users/:id/avatar
```

Same as self-service but specify user ID.

---

## Storage Architecture

### Strategy Pattern

```typescript
interface IStorageService {
  uploadFile(filename: string, buffer: Buffer, mimetype: string): Promise<string>;
  deleteFile(filename: string): Promise<void>;
  getFileUrl(filename: string): string;
}
```

**Strategies:**

1. **LocalStorageService** - Development (files in `./uploads`)
2. **S3StorageService** - Production (AWS S3)

### Local Storage (Default)

```
uploads/
  avatars/
    user-123-1731868800.jpg
```

**Naming:** `avatars/{userId}-{timestamp}.{ext}`

**Access:** `http://localhost:8000/public/avatars/filename.jpg`

### S3 Storage (Production)

```env
STORAGE_TYPE=s3
S3_BUCKET_NAME=your-app-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

**Benefits:**

- Scalable storage
- CDN integration
- Automatic backups
- No server disk usage

**Setup:**

1. Create S3 bucket
2. Configure public read for `avatars/*`
3. Set environment variables
4. Restart server

The code automatically switches - no code changes!

---

## Implementation

### Upload Middleware

DreamStack uses a framework-agnostic upload system:

```typescript
// src/common/middlewares/file-upload.ts
import { uploadSingle } from "@/common/middlewares/file-upload";

export const uploadAvatar = uploadSingle({
  fieldName: "avatar",
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  maxSize: 5 * 1024 * 1024, // 5MB
});
```

**Key Features:**

- Works with both Express and Hono adapters
- Validates file type and size
- Loads file into memory buffer
- Provides consistent error handling

### Upload Flow

```
1. Client → multipart/form-data with avatar field
2. Upload Middleware → validates type & size
3. File → loaded into memory buffer (req.file)
4. Controller → generates filename: avatars/{userId}-{timestamp}.{ext}
5. Storage Service → saves file (local or S3)
6. Database → updates user.avatar with URL
7. Response → returns user with new avatar URL
```

### Controller Example

```typescript
// src/features/users/user.controller.ts
export async function uploadAvatar(req: HttpRequest, res: HttpResponse) {
  const userId = req.ctx.user!.id;
  const file = req.ctx.file;

  if (!file) {
    throw new AppError("No file uploaded", 400, "NO_FILE_UPLOADED");
  }

  // Generate unique filename
  const ext = file.mimetype.split("/")[1];
  const filename = `avatars/${userId}-${Date.now()}.${ext}`;

  // Upload to storage (local or S3)
  const url = await storageService.uploadFile(filename, file.buffer, file.mimetype);

  // Update user in database
  const user = await userRepository.updateAvatar(userId, url);

  res.json({ status: "success", data: user });
}
```

### Delete Flow

```
1. Controller → gets user from database
2. If avatar exists → extract filename and delete from storage
3. Database → sets user.avatar = null
4. Response → returns updated user
```

---

## Error Responses

**Invalid Type:**

```json
{
  "status": "error",
  "message": "Only JPEG, PNG, and WebP images are allowed",
  "code": "INVALID_FILE_TYPE"
}
```

**Too Large:**

```json
{
  "status": "error",
  "message": "File size cannot exceed 5MB",
  "code": "FILE_TOO_LARGE"
}
```

**No File:**

```json
{
  "status": "error",
  "message": "No file uploaded",
  "code": "NO_FILE_UPLOADED"
}
```

---

## Customization

### Change Size Limit

```typescript
// src/common/middlewares/file-upload.ts
export const uploadAvatar = uploadSingle({
  fieldName: "avatar",
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  maxSize: 10 * 1024 * 1024, // 10MB
});
```

### Add File Types

```typescript
export const uploadAvatar = uploadSingle({
  fieldName: "avatar",
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  maxFileSize: 5 * 1024 * 1024,
});
```

### Image Processing

```bash
pnpm add sharp
```

```typescript
import sharp from "sharp";

// In controller
const processedBuffer = await sharp(req.file.buffer)
  .resize(400, 400, { fit: "cover" })
  .jpeg({ quality: 90 })
  .toBuffer();

const url = await storageService.uploadFile(filename, processedBuffer, "image/jpeg");
```

---

## Production Deployment

### S3 Setup

```bash
# Create bucket
aws s3 mb s3://your-app-uploads --region us-east-1
```

**Bucket Policy** (public read for avatars):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-app-uploads/avatars/*"
    }
  ]
}
```

**Environment:**

```env
STORAGE_TYPE=s3
S3_BUCKET_NAME=your-app-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

### CDN (Optional)

```env
S3_CDN_URL=https://d123456.cloudfront.net
```

Avatar URLs automatically use CDN.

---

## Troubleshooting

**"No file uploaded"**

- Check field name matches middleware configuration (default: `avatar`)
- Verify `Content-Type: multipart/form-data` header
- Ensure file is included in request body

**Avatar URL returns 404**

- Local: Verify `LOCAL_STORAGE_BASE_URL` includes `/public` path
- Local: Check `uploads/avatars/` directory exists and has proper permissions
- S3: Verify bucket policy allows public read for `avatars/*`
- S3: Check S3 credentials and region are correct

**"File too large"**

- Check client-side file size before upload
- Adjust `maxFileSize` in upload middleware if needed
- Consider implementing image compression

**"Invalid file type"**

- Verify file MIME type matches allowed types
- Check file extension matches actual content type
- Add additional MIME types to `allowedMimeTypes` if needed

---

## Error Handling

Upload errors are automatically handled by the HTTP adapters and return consistent error responses:

```json
{
  "status": "error",
  "message": "File size cannot exceed 5MB",
  "code": "FILE_TOO_LARGE"
}
```

**Error Codes:**

- `FILE_TOO_LARGE` - File exceeds size limit
- `INVALID_FILE_TYPE` - File type not allowed
- `NO_FILE_UPLOADED` - No file in request

The upload middleware integrates with both Express and Hono adapters to provide framework-agnostic error handling. Errors are normalized before reaching the global error handler, ensuring consistent API responses across both frameworks.

## Self-Service Pattern

The `/me` endpoints let users manage their own resources without knowing their user ID.

**Benefits:**

- More intuitive (no need to find user ID)
- Industry standard (GitHub, Discord, Twitter)
- Better security (users can only modify their own data)
- Simpler frontend code

**Pattern:**

```
POST   /v1/users/me/avatar    → Upload my avatar
DELETE /v1/users/me/avatar    → Delete my avatar
GET    /v1/users/me           → Get my profile
PATCH  /v1/users/me           → Update my profile
```

User ID extracted from JWT token (`req.ctx.user.id`).

---

## Security

### Authorization

- **Self-service:** Requires `USER` role
- **Admin:** Requires `ADMIN` role

### File Validation

- Type checking (images only)
- Size limits (5MB max)
- Extension verification

### Safe Handling

- Memory buffering (not saved to disk first)
- Unique filenames prevent overwriting
- Old avatars deleted when replaced
- No path traversal (server-generated filenames)

---

## Summary

✅ **Self-service** - Users upload their own avatars  
✅ **Admin control** - Manage any user's avatar  
✅ **Flexible storage** - Local or S3, switch easily  
✅ **File validation** - Type and size checking  
✅ **Production-ready** - S3 and CDN support  
✅ **Secure** - Authorization and safe file handling

**Ready to use out of the box!** 🎨
