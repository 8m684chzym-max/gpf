// GDPR data minimisation — automatic retention cleanup.
//
// Purges:
//   • AuditLog rows older than 12 months (Art. 5.1.e — storage limitation).
//   • Expired and used PasswordResetToken rows (no longer needed after use/expiry).
//
// How to run:
//   Option A (Vercel Cron — recommended): add to vercel.json:
//     { "crons": [{ "path": "/api/maintenance/cleanup", "schedule": "0 3 * * 0" }] }
//   Option B: call manually from Admin or a one-off script.
//
// Protected by a CRON_SECRET env var — set it in Vercel to a long random string.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req) {
  // Verify shared secret (set CRON_SECRET in Vercel env vars).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const auditCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 12 months ago
  const tokenCutoff = new Date(); // anything expired before now

  const [auditDeleted, tokenDeleted] = await Promise.all([
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: tokenCutoff } },
          { usedAt: { not: null } },
        ],
      },
    }),
  ]);

  const result = {
    cleanedAt: new Date().toISOString(),
    auditLogsDeleted: auditDeleted.count,
    tokensDeleted: tokenDeleted.count,
  };
  console.log("[maintenance/cleanup]", result);
  return NextResponse.json(result);
}

// Vercel Cron jobs call GET; alias to POST so both work.
export async function GET(req) {
  return POST(req);
}
