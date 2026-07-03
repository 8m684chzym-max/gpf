# Golf P'la Fresquinha — Road to GPF Weekend

A private friends' golf competition app: members log in, submit qualifying and
GPF Weekend rounds (manually or by uploading a Hole19 scorecard), track handicap
qualification, and view standings. Built with **Next.js (App Router) · PostgreSQL
via Prisma · NextAuth (credentials + JWT)**, ready to deploy on **Vercel**.

---

## What's inside

- `prisma/schema.prisma` — full data model (users, competitions, courses, tees,
  rounds, scorecards, handicap records, audit log). `score_submissions` are
  pending rounds; the leaderboard is computed on the fly.
- `src/lib/scoring.js` — the scoring engine (90% Medal Net, qualification,
  handicap, tiebreaks). Pure functions shared by server and client.
- `src/app/api/*` — API routes: auth, register, rounds, members, config,
  courses, public leaderboard, CSV export, and the server-side scorecard reader.
- `src/app/*` — pages: public home, login/register, dashboard, submit, road,
  weekend, final standings, profile, admin panel.
- `prisma/seed.mjs` — seeds the committee login, the active competition, and
  Lisbon Sports Club. Set `SEED_SAMPLE=true` to also add demo players + rounds.

Seeded committee login: **admin@gpf.golf** / **admin1234** (change it after first login).

---

## Step-by-step: from zero to live

### 0. Install the tools (once)
- Install **Node.js 18.18+** (LTS) from nodejs.org.
- Install **Git** from git-scm.com.
- Create free accounts at **github.com**, **vercel.com**, and a Postgres host
  (**neon.tech** or **supabase.com**).
- Get an **Anthropic API key** at console.anthropic.com → API Keys.

### 1. Get the code running locally
```bash
cd golf-pla-fresquinha
npm install
cp .env.example .env        # then edit .env (next step)
```

### 2. Create the database, fill in .env
1. In Neon (or Supabase), create a project and copy the **connection string**.
2. Open `.env` and set:
   - `DATABASE_URL` → the connection string (keep `?sslmode=require`).
   - `NEXTAUTH_SECRET` → run `openssl rand -base64 32` and paste the result.
   - `NEXTAUTH_URL` → `http://localhost:3000` for now.
   - `ANTHROPIC_API_KEY` → your key.

### 3. Create the tables and seed
```bash
npm run db:push          # creates all tables in your database
SEED_SAMPLE=true npm run seed   # admin + competition + course + demo data
# (use plain `npm run seed` if you don't want demo players)
```

### 4. Run it
```bash
npm run dev
```
Open http://localhost:3000, click **Enter the clubhouse**, log in as
`admin@gpf.golf` / `admin1234`. Add members under **Admin → Members**.

### 5. Push to GitHub
```bash
git init
git add .
git commit -m "GPF app"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/gpf.git
git branch -M main
git push -u origin main
```

### 6. Deploy on Vercel
1. vercel.com → **Add New… → Project** → import your GitHub repo.
2. Vercel auto-detects Next.js. Before clicking Deploy, open **Environment
   Variables** and add the same four keys from your `.env`:
   - `DATABASE_URL`, `NEXTAUTH_SECRET`, `ANTHROPIC_API_KEY`
   - `NEXTAUTH_URL` → set this to your Vercel URL (e.g.
     `https://gpf-xxxx.vercel.app`); update it again after you add a domain.
3. Click **Deploy**. First build runs `prisma generate && next build` automatically.
4. After it's live, run the migration + seed against the production DB **once**
   from your machine (your `.env` still points at the same database, so):
   ```bash
   npm run db:push
   SEED_SAMPLE=true npm run seed
   ```
   (If your production DB is separate, temporarily set `DATABASE_URL` to the prod
   string before running these.)

### 7. Add your domain (see below), set `NEXTAUTH_URL` to it, redeploy.

---

## Where to get a domain

You buy a domain from a **registrar** (an annual rental, ~€10–15/yr for a `.com`;
`.golf` runs ~€30/yr). Good options:

- **Buy it inside Vercel** (Project → Settings → Domains → search & buy). Easiest
  path: Vercel auto-configures DNS, HTTPS is automatic, nothing else to wire up.
- **Cloudflare Registrar** (cloudflare.com) — sold at cost (cheapest renewals),
  but you point its nameservers/records at Vercel manually.
- **Namecheap** or **Porkbun** — cheap, friendly dashboards; same manual DNS step.

If you buy outside Vercel: in Vercel go to **Settings → Domains → Add**, type your
domain, and Vercel shows the exact DNS records (an `A` record to `76.76.21.21`
and/or a `CNAME` to `cname.vercel-dns.com`) to paste into your registrar. HTTPS
certificates are issued automatically once DNS resolves. Then set `NEXTAUTH_URL`
to `https://yourdomain` and redeploy so login redirects use the real address.

---

## Hosting requirements & cost

For a private group this fits comfortably on free tiers:
- **Vercel Hobby** — free, fine for a private app (don't use it for a commercial
  product per Vercel's terms; a friends' competition is fine).
- **Neon / Supabase free tier** — plenty for dozens of members and a few hundred
  rounds a year.
- **Anthropic API** — pay-as-you-go; scorecard reads cost a fraction of a cent each.
- **Domain** — the only guaranteed cost, ~€10–30/yr.

Expect **€0–3/month** plus the domain unless usage grows a lot.

---

## Optional: password reset emails (SMTP)

"Forgot password?" on the login page always works for the committee — an admin
can reset any member's password instantly from **Admin → Members** (the key
icon next to each member), no email required. To also let members reset their
own password by email, set four environment variables:

```
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="you@gmail.com"
SMTP_PASS="your-16-character-app-password"
```

The easiest free option is a personal Gmail account:
1. Turn on **2-Step Verification** at myaccount.google.com → Security.
2. Once it's on, a new **App Passwords** option appears in the same Security
   section. Generate one (any name, e.g. "GPF app") — it gives you a 16-character
   password. That's `SMTP_PASS`; your Gmail address is `SMTP_USER`.
3. Redeploy with those four variables set (plus `SMTP_FROM` if you want a nicer
   "from" name, e.g. `"Golf P'la Fresquinha <you@gmail.com>"`).

Any other SMTP provider (Resend, SendGrid, Mailgun, your own mail server) works
the same way — just point `SMTP_HOST`/`SMTP_PORT` at it. Without any of this
configured, the reset link is printed to the server log instead (useful in
local dev), and the admin-side reset always remains available either way.

---

## Optional: Sign in with Google

Free, and the quickest of the two to set up:
1. console.cloud.google.com → create a project (or use an existing one).
2. **APIs & Services → OAuth consent screen** — set it up for "External" users,
   add your own email as a test user if it stays in testing mode.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   type **Web application**.
4. Under **Authorized redirect URIs**, add:
   `{your domain or http://localhost:3000}/api/auth/callback/google`
5. Copy the **Client ID** and **Client Secret** into `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, then redeploy.

The "Continue with Google" button on the login page appears automatically once
both variables are set — no code changes needed. Leave them blank to hide it.

---

## Optional: Sign in with Apple

This one's a heavier lift than Google — be aware before starting: it requires
an **Apple Developer Program membership, which costs $99/year**, even just for
website sign-in (not for publishing an app). If that's not worth it for a
private group this size, Google + email/password cover the same need for free.

If you do want it:
1. Enroll at developer.apple.com/programs ($99/yr).
2. **Certificates, Identifiers & Profiles → Identifiers → Services IDs** —
   create one (e.g. `golf.fresquinha.signin`). This becomes `APPLE_CLIENT_ID`.
   Enable "Sign in with Apple" on it, and configure your domain plus the
   redirect URL: `{your domain}/api/auth/callback/apple`.
3. **Certificates, Identifiers & Profiles → Keys** — create a new key with
   "Sign in with Apple" enabled. Download the `.p8` file it gives you —
   **Apple only lets you download it once**, so keep it safe. Note the Key ID
   shown on screen, and your Team ID (top-right of the developer site).
4. Unlike Google, Apple doesn't give you a plain secret string — you sign a
   short-lived JWT yourself. This repo includes a script for that:
   ```
   npm run apple-secret -- --team YOUR_TEAM_ID --key YOUR_KEY_ID --client golf.fresquinha.signin --keyfile ./AuthKey_XXXX.p8
   ```
   Paste the output into `APPLE_CLIENT_SECRET`.
5. Redeploy. The "Continue with Apple" button appears automatically once both
   variables are set.

That generated secret expires after about 6 months — re-run the script and
update `APPLE_CLIENT_SECRET` before it does, or the Apple button will start
failing silently for everyone until you do.

---

## A note on Google/Apple sign-in and who can join

Right now, anyone who reaches your app's URL can create a member account —
either by registering with email/password, or, once enabled, by signing in
with Google or Apple (which creates an account automatically on first login).
This matches how email registration already worked before adding OAuth; it's
not a stricter or looser gate, just another door into the same room. If you'd
rather restrict joining to people the committee has explicitly added, that's a
straightforward follow-up (e.g. an invite-only allowlist checked before account
creation) — just ask.

---



## Decisions you may want to revisit
- **Handicap formula**: this uses the average of the best-3 (gross − tee par)
  differentials. For true WHS course handicaps (index × slope/113) you'd extend
  `calcHandicap` and store slope/rating per tee (already in the schema).
- **Who approves**: currently committee/admin only. The schema records the
  playing partner, so partner-approval is a small extension.
- **Telegram bot** for submitting scores in chat is a clean optional add-on later.
