# Next.js 16 Dynamic Route Parameters Fix

## Summary

Fixed `params` handling in dynamic route handlers for Next.js 16 compatibility. In Next.js 16, route parameters are wrapped in a Promise and must be awaited.

## Problem

**Error:**
```
Invalid invocation: prisma.user.delete()
Argument `where` of type UserWhereUniqueInput needs at least one of `id` or `email` arguments.
id: undefined
```

**Root Cause:**
In Next.js 16, `params` is a Promise that must be awaited. Without awaiting it, `params.id` returns `undefined`.

**Affected Routes:**
- `PATCH /api/members/[id]` — Member password reset
- `DELETE /api/members/[id]` — Member deletion
- `PATCH /api/rounds/[id]` — Round approval/rejection/edit
- `DELETE /api/rounds/[id]` — Round deletion

## Solution

Changed route handler signature from:
```javascript
export async function DELETE(req, { params }) {
  // params.id is undefined ❌
}
```

To:
```javascript
export async function DELETE(req, { params: paramsPromise }) {
  const params = await paramsPromise; // ✅ Now defined
  // params.id works correctly
}
```

## How It Works

### Next.js 15 and Earlier
```javascript
export async function DELETE(req, { params }) {
  const id = params.id; // ✅ Direct access works
}
```

### Next.js 16 (Current)
```javascript
export async function DELETE(req, { params: paramsPromise }) {
  const params = await paramsPromise; // ⚠️ Must await
  const id = params.id; // ✅ Now works
}
```

## Files Changed

```
src/app/api/members/[id]/route.js
  ├── PATCH handler ........................ Fixed params extraction
  └── DELETE handler ....................... Fixed params extraction

src/app/api/rounds/[id]/route.js
  ├── PATCH handler ........................ Fixed params extraction
  └── DELETE handler ....................... Fixed params extraction
```

## Testing

### Test 1: Reset Member Password
```
1. Go to /admin
2. Click reset password button on any member
3. Verify: New password displays ✅
4. No "undefined" errors ✅
```

### Test 2: Delete Member
```
1. Go to /admin
2. Click delete button on a non-admin member
3. Confirm deletion
4. Verify: Member removed from list ✅
5. No "undefined" errors ✅
```

### Test 3: Approve/Reject Round
```
1. Go to /submit or dashboard
2. Find a pending round
3. Click approve/reject
4. Verify: Action succeeds ✅
5. No "undefined" errors ✅
```

### Test 4: Delete Round
```
1. Go to admin or dashboard
2. Find any round
3. Click delete if available
4. Confirm deletion
5. Verify: Round removed ✅
6. No "undefined" errors ✅
```

## Pattern Reference

### Before (Next.js ≤15)
```javascript
export async function DELETE(req, { params }) {
  const id = params.id;
  await prisma.user.delete({ where: { id } });
}
```

### After (Next.js 16+)
```javascript
export async function DELETE(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const id = params.id;
  await prisma.user.delete({ where: { id } });
}
```

## References

- [Next.js 16 Release Notes](https://nextjs.org/docs)
- [Route Handlers with Dynamic Segments](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#dynamic-route-handlers)
- [Turbopack Migration Guide](https://nextjs.org/docs)

## Why This Happens

Next.js 16 uses Turbopack by default. Turbopack requires proper async handling of all Promise-based values, including route parameters. This is more strict than the previous webpack-based bundler.

## Performance Impact

Negligible — awaiting `params` adds microseconds to request handling time, which is negligible compared to database query times.

## Compatibility

- ✅ Next.js 16+ (required)
- ✅ Turbopack enabled (default)
- ✅ Development mode
- ✅ Production builds

## Rollback

If reverting to Next.js 15:
```javascript
// Can revert to:
export async function DELETE(req, { params }) {
  const id = params.id;
  // ...
}
```

But stay on Next.js 16+ for new features and security patches.

## Summary

✅ Fixed params extraction in 2 dynamic routes  
✅ Added proper async/await handling  
✅ All member operations working  
✅ All round operations working  
✅ Compatible with Next.js 16 + Turbopack  
✅ No breaking changes  
✅ Ready to deploy  

**Status:** Complete
