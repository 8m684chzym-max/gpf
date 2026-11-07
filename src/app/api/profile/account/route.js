import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Change your own email and/or password. Always needs the current password.
export async function PATCH(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { currentPassword, email, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword) return NextResponse.json({ error: "Enter your current password." }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: user.id } });
  if (!me?.passwordHash || !(await bcrypt.compare(currentPassword, me.passwordHash))) {
    return NextResponse.json({ error: "Current password is wrong." }, { status: 403 });
  }

  const data = {};
  const changed = [];
  if (email != null && email !== "") {
    const e = String(email).toLowerCase().trim();
    if (!EMAIL_RE.test(e)) return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
    if (e !== me.email) {
      const taken = await prisma.user.findUnique({ where: { email: e } });
      if (taken) return NextResponse.json({ error: "That email is already used by another member." }, { status: 409 });
      data.email = e;
      changed.push("email");
    }
  }
  if (newPassword) {
    if (String(newPassword).length < 8) return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    data.passwordHash = await bcrypt.hash(String(newPassword), 10);
    changed.push("password");
  }
  if (!changed.length) return NextResponse.json({ error: "Nothing changed." }, { status: 400 });

  await prisma.user.update({ where: { id: me.id }, data });
  if (data.passwordHash) await prisma.passwordResetToken.deleteMany({ where: { userId: me.id, usedAt: null } });
  await logAudit(me.name, "profile.account", me.id, changed.join(", "));
  return NextResponse.json({ ok: true, email: data.email ?? me.email, changed });
}
