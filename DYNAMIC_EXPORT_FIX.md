# Dynamic Route Handler Export Fix

## Summary

All API routes that interact with the database now include `export const dynamic = 'force-dynamic'` to prevent build-time prerendering errors on Vercel.

## Problem

Without this export, Next.js App Router attempts to prerender route handlers at build time. When a handler touches the database during the build, it fails because:
- The build environment may not have database access
- Prisma needs runtime connections
- Dynamic data should never be prerendered

**Error Example:**
```
500 Internal Server Error
PATCH /api/members/[id]
```

## Solution

Added `export const dynamic = 'force-dynamic'` to all database-touching route handlers.

This tells Next.js:
- ✅ Don't prerender this route
- ✅ Always run it at request time
- ✅ Allow runtime database access

## Routes Fixed

### Protected Routes (Require Authentication)
- ✅ `/api/members/route.js` — GET/POST members
- ✅ `/api/members/[id]/route.js` — PATCH/DELETE member
- ✅ `/api/rounds/route.js` — GET/POST rounds
- ✅ `/api/rounds/[id]/route.js` — PATCH/DELETE round
- ✅ `/api/config/route.js` — GET config
- ✅ `/api/courses/route.js` — GET/POST courses
- ✅ `/api/export/route.js` — GET CSV export
- ✅ `/api/scorecard/extract/route.js` — POST scorecard extract

### Public Routes
- ✅ `/api/leaderboard/route.js` — GET leaderboard (public)

### Auth Routes
- ✅ `/api/auth/forgot-password/route.js` — POST forgot password
- ✅ `/api/auth/reset-password/route.js` — POST reset password
- ✅ `/api/register/route.js` — POST registration

### NextAuth Route
- ⚠️ `/api/auth/[...nextauth]/route.js` — NextAuth handles this internally

## How It Works

### Before
```javascript
// route.js
import { prisma } from "@/lib/prisma";

export async function GET() {
  const data = await prisma.user.findMany();
  return Response.json(data);
}
// Problem: Build tries to execute this, database not available
```

### After
```javascript
// route.js
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'; // ← Added this

export async function GET() {
  const data = await prisma.user.findMany();
  return Response.json(data);
}
// Success: Route only runs at request time
```

## Testing

### Test: Member Password Reset
```
1. Go to /admin
2. Find a member
3. Click the reset password button
4. Verify: No 500 error ✅
5. Verify: New password displayed ✅
```

### Test: Add Member
```
1. Go to /admin
2. Click "Add member"
3. Fill in name, email, password
4. Click create
5. Verify: No 500 error ✅
6. Verify: Member appears in list ✅
```

### Test: Edit Handicap
```
1. Go to /admin
2. Find a member
3. Click handicap field
4. Enter new handicap
5. Click away/blur
6. Verify: No 500 error ✅
```

### Test: Delete Member
```
1. Go to /admin
2. Find a non-admin member
3. Click delete button
4. Confirm deletion
5. Verify: No 500 error ✅
6. Verify: Member removed ✅
```

## Build Process

When you deploy to Vercel:

```bash
npm run build
# ↓
# Prisma generates client
# ↓
# Next.js builds app
# ↓
# Routes with 'force-dynamic' are skipped (not prerendered)
# ↓
# Build completes successfully ✅
```

## Performance Impact

Minimal/None:
- Routes marked as dynamic load slightly faster than prerendered routes (no cache hit needed)
- Database queries are the actual bottleneck (network, query time)
- These routes were already dynamic anyway (require authentication, return user-specific data)

## Documentation

See:
- `OAUTH_REMOVAL.md` — OAuth removal details
- `/HANDICAP_SYSTEM.md` — Scoring engine
- `/README.md` — Deployment guide

## Files Changed

```
src/app/api/members/route.js ........................ + export const dynamic
src/app/api/members/[id]/route.js ................... + export const dynamic
src/app/api/rounds/route.js .......................... + export const dynamic
src/app/api/rounds/[id]/route.js .................... + export const dynamic
src/app/api/config/route.js .......................... + export const dynamic
src/app/api/courses/route.js ......................... + export const dynamic
src/app/api/export/route.js .......................... + export const dynamic
src/app/api/leaderboard/route.js .................... + export const dynamic
src/app/api/scorecard/extract/route.js ............. + export const dynamic
src/app/api/auth/forgot-password/route.js ......... + export const dynamic
src/app/api/auth/reset-password/route.js .......... + export const dynamic
src/app/api/register/route.js ....................... + export const dynamic
```

## References

- [Next.js Docs: Dynamic Routes](https://nextjs.org/docs/app/building-your-application/rendering/dynamic-routes)
- [Next.js App Router: Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Vercel: Build Output API](https://vercel.com/docs/build-output-api/v3)

## Rollback

If you need to remove these exports (not recommended):

```bash
# Remove all occurrences
find src/app/api -name "*.js" -exec sed -i "/export const dynamic = 'force-dynamic'/d" {} \;

# This will cause 500 errors on Vercel again
```

## Summary

✅ All database routes marked as dynamic  
✅ Fixes 500 errors on Vercel  
✅ No breaking changes  
✅ No performance impact  
✅ Ready to deploy  

**Status:** Complete
