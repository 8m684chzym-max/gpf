# GPF Database & RLS Audit Report

## 🚨 Critical Issues Identified

### Issue 1: RLS (Row Level Security) Not Configured
**Status:** BLOCKING  
**Cause:** Supabase has RLS enabled but no policies configured for the app

**Symptoms:**
- Queries return 0 rows or permission denied errors
- Admin/user operations fail silently
- App appears to load but shows no data

**Why This Happens:**
- Supabase's RLS blocks ALL queries by default when enabled
- The app uses credential-based auth (JWT from NextAuth)
- Supabase expects either:
  - Service role key (for backend operations) OR
  - Proper RLS policies for authenticated users

---

## ✅ SOLUTION: Disable RLS (Recommended for Private App)

Since GPF is a **closed private group** (not public SaaS), RLS is unnecessary.

### Step 1: Disable RLS on All Tables

**In Supabase Dashboard:**

1. Go to **SQL Editor**
2. Run this command to disable RLS on all tables:

```sql
-- Disable RLS on all GPF tables
ALTER TABLE "public"."User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Round" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Competition" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Course" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Tee" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Scorecard" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HandicapRecord" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PasswordResetToken" DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN (
  'User', 'Round', 'Competition', 'Course', 'Tee', 
  'Scorecard', 'HandicapRecord', 'AuditLog', 'PasswordResetToken'
);
```

3. Result should show `rowsecurity = false` for all tables ✅

---

## Alternative: Use Service Role Key (Advanced)

If you want to keep RLS enabled:

### Step 1: Add Service Role Key

**In Supabase Dashboard:**
1. Settings → API → Service role key (copy it)
2. Add to Vercel environment variables:
```
SUPABASE_SERVICE_ROLE_KEY=<paste here>
```

### Step 2: Create RLS Policies

Add this to your Prisma schema comments (as documentation):

```sql
-- Enable RLS on all tables
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Round" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own data
CREATE POLICY "Users can view own profile"
ON "public"."User"
AS SELECT
USING (auth.uid()::text = id);

-- Policy: Users can view rounds (all members see everyone for leaderboard)
CREATE POLICY "All authenticated users can view rounds"
ON "public"."Round"
AS SELECT
USING (auth.role() = 'authenticated');

-- Policy: Users can only insert their own rounds
CREATE POLICY "Users can insert own rounds"
ON "public"."Round"
AS INSERT
WITH CHECK (auth.uid()::text = "userId");

-- Policy: Admins can do everything (requires custom claim)
CREATE POLICY "Admins can manage all records"
ON "public"."Round"
AS ALL
USING (
  EXISTS (
    SELECT 1 FROM "public"."User"
    WHERE id = auth.uid()::text AND role = 'ADMIN'
  )
);
```

**⚠️ This is complex and requires NextAuth + Supabase integration.**

---

## 🔍 Verification Steps

After disabling RLS:

1. **Test in Vercel:**
   - Go to Dashboard → Should load with no errors
   - Submit a round → Should succeed
   - Check leaderboard → Should show all members

2. **Check Supabase:**
```sql
-- Count users
SELECT COUNT(*) FROM "public"."User";

-- Count rounds
SELECT COUNT(*) FROM "public"."Round";

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';
```

3. **Monitor for errors:**
```bash
# Check Vercel logs for permission errors
# Look for: "permission denied", "new row violates row-level security"
```

---

## 📋 Checklist for RLS Fix

- [ ] Disable RLS on all tables (SQL command above)
- [ ] Verify RLS is disabled (`rowsecurity = false`)
- [ ] Redeploy Vercel (it will auto-fetch new schema)
- [ ] Test login at https://www.gpf.golf
- [ ] Test dashboard load
- [ ] Submit a test round
- [ ] Check leaderboard
- [ ] Verify admin can see all rounds

---

## 🔐 Why RLS Was Problematic Here

| Aspect | Issue |
|--------|-------|
| **Auth Method** | NextAuth (JWT-based) vs Supabase Auth (separate) |
| **App Type** | Private closed group (no public data) |
| **Database User** | Uses pooled connection, not individual auth |
| **RLS Policies** | Would need custom setup for NextAuth JWT claims |
| **Complexity** | Not worth it for 6 trusted members |

---

## 📌 Going Forward

### Recommended Setup:
- ✅ RLS disabled (not needed for private group)
- ✅ Database-level access control via connection credentials
- ✅ Application-level auth via NextAuth (credentials-only)
- ✅ Authorization checks in API routes (role checks)

### What Protects the Data:
1. **Network:** Vercel → Supabase (encrypted)
2. **Database:** Connection credentials (env vars)
3. **App:** NextAuth session + role checks in API
4. **Audit:** All actions logged to AuditLog table

This is a **perfectly secure setup for a private app**.

---

## 🆘 If Issues Persist After RLS Disabled

1. **Check Prisma connection:**
```bash
# In the app directory
npm run prisma:db-push
```

2. **Rebuild Prisma Client:**
```bash
npx prisma generate
```

3. **Restart Vercel:**
   - Go to Vercel → Deployments → Redeploy

4. **Check Supabase logs:**
   - Supabase Dashboard → Logs → View error details

5. **Clear browser cache:**
   - Dev tools → Application → Clear site data

---

## Contact Support

If you need help with Supabase RLS configuration:
- **Supabase Docs:** https://supabase.com/docs/guides/auth/row-level-security
- **Prisma Docs:** https://www.prisma.io/docs/concepts/overview/prisma-in-your-stack/databases/supabase

---

**Last Updated:** June 29, 2026  
**GPF Version:** Open 2026  
**Status:** Ready for RLS fix
