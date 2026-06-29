import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const courses = await prisma.course.findMany({ include: { tees: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ courses });
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, par, tees } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Course name required." }, { status: 400 });

  // Avoid duplicates: reuse an existing course with the same name (case/space-insensitive).
  const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const existing = await prisma.course.findMany({ include: { tees: true } });
  const dupe = existing.find((c) => norm(c.name) === norm(name));
  if (dupe) return NextResponse.json({ ok: true, course: dupe, reused: true });

  const coursePar = Number(par) || 72;
  const course = await prisma.course.create({
    data: {
      name: name.trim(),
      par: coursePar,
      tees: {
        create: (tees || [{ name: "White", par: coursePar }]).map((t) => {
          const teePar = Number(t.par) || coursePar;
          return {
            name: t.name,
            par: teePar,
            // Default rating to par, slope to 113 (standard neutral slope) if not provided
            rating: t.rating != null ? Number(t.rating) : teePar,
            slope: t.slope != null ? Number(t.slope) : 113,
          };
        }),
      },
    },
    include: { tees: true },
  });
  await logAudit(user.name, "course.add", course.id, name);
  return NextResponse.json({ ok: true, course });
}
