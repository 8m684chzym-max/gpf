# Login Troubleshooting Guide

## 🔍 Verify Environment Variables in Vercel

**Critical:** These 3 must be set in Vercel, not just locally.

1. Go to **Vercel Dashboard** → Your "gpf" project
2. **Settings** → **Environment Variables**
3. Verify these exist and are correct:

```
✅ DATABASE_URL        (Supabase pooler connection - port 6543 with ?pgbouncer=true)
✅ DIRECT_URL          (Supabase direct connection - port 5432)
✅ NEXTAUTH_SECRET     (long random string from `openssl rand -base64 32`)
✅ NEXTAUTH_URL        (https://www.gpf.golf on production)
✅ ANTHROPIC_API_KEY   (optional, but if missing OCR won't work)
```

**If any are missing or incorrect, add/update them and redeploy.**

---

## 🔗 Test Database Connection

**In Supabase Dashboard:**

1. **SQL Editor** → Run this query:

```sql
SELECT COUNT(*) as user_count FROM "public"."User";
```

**Expected result:** Should return a number (e.g., `1` for admin@gpf.golf)

**If error:** 
- "relation does not exist" → Tables weren't created
- "permission denied" → RLS is still blocking (disable it again)

---

## 👤 Verify Admin User Exists

**Run this query in Supabase SQL Editor:**

```sql
SELECT id, name, email, role, "passwordHash" FROM "public"."User" LIMIT 5;
```

**Expected output:**
```
id          | name   | email            | role  | passwordHash
xxx123      | Admin  | admin@gpf.golf   | ADMIN | $2a$10$...
```

**If empty:**
- User doesn't exist → need to seed the database
- Run: `npx prisma db seed` in your local repo, then push to GitHub

---

## 🌐 Check Vercel Logs

**To see actual error:**

1. Go to **Vercel Dashboard**
2. Select your "gpf" project
3. **Deployments** tab → Click latest deployment
4. **Logs** tab
5. Filter for errors (look for):
   - `ECONNREFUSED` → Database not connecting
   - `permission denied` → RLS still enabled
   - `user not found` → Admin account missing
   - `invalid password` → Password hash issue

---

## 🔄 Reset Everything (Nuclear Option)

If still failing:

### 1. Clear Vercel Cache
```
Vercel Dashboard → Settings → Git → 
Disconnect & reconnect your GitHub repo
```

### 2. Redeploy
```
Deployments → Click "..." on latest → Redeploy
```

### 3. If Still Failing: Reset Prisma

In your local repo:
```bash
# Delete and recreate migration
rm -rf prisma/migrations

# Push schema fresh
npx prisma db push

# Seed with admin user
npx prisma db seed

# Commit and push
git add .
git commit -m "chore: reset prisma migrations"
git push origin master
```

---

## 🆘 Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Email or password is incorrect" | Wrong credentials OR user doesn't exist | Check Supabase SQL query above |
| "connect ECONNREFUSED" | DB not connecting | Check DATABASE_URL in Vercel |
| "permission denied" | RLS still enabled | Run RLS disable SQL command |
| "Cannot find module" | Prisma Client not generated | `npx prisma generate` |
| Login page loads but button does nothing | NextAuth config issue | Check NEXTAUTH_SECRET and NEXTAUTH_URL |

---

## ✅ Testing Login

**Default credentials (after seed):**
```
Email:    admin@gpf.golf
Password: admin1234
```

**After logging in, you should see:**
- Dashboard with member cards
- Navigation bar with links
- Your profile in top right

---

## 📞 If Nothing Works

Share these details:
1. **Error message** from login page
2. **Vercel logs** (copy/paste relevant error lines)
3. **Supabase query result** (user count)
4. **Environment variables** in Vercel (just say "set" or "missing")

---

**Status:** 🔴 Login blocked → Follow steps above to fix
