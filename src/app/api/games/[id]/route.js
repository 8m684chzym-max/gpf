import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { shapeGame } from "../route";

export const dynamic = "force-dynamic";

async function loadShaped(id) {
  const g = await prisma.sideGame.findUnique({
    where: { id },
    include: { players: { orderBy: { position: "asc" } }, holes: true, createdBy: { select: { name: true } } },
  });
  return g ? shapeGame(g) : null;
}

export async function GET(_req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const game = await loadShaped(params.id);
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  return NextResponse.json({ game });
}

// PATCH is used for two things, chosen by body:
//   { hole: 1..18, data: {...}|null }  → upsert (or clear) one hole
//   { status: "FINISHED" }             → close the game
export async function PATCH(req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await prisma.sideGame.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  const b = await req.json();

  if (typeof b.hole === "number") {
    if (b.hole < 1 || b.hole > 18) return NextResponse.json({ error: "Bad hole." }, { status: 400 });
    if (b.data == null) {
      await prisma.sideGameHole.deleteMany({ where: { gameId: game.id, hole: b.hole } });
    } else {
      await prisma.sideGameHole.upsert({
        where: { gameId_hole: { gameId: game.id, hole: b.hole } },
        create: { gameId: game.id, hole: b.hole, data: b.data },
        update: { data: b.data },
      });
    }
    // touch the parent so updatedAt reflects the latest change
    await prisma.sideGame.update({ where: { id: game.id }, data: { updatedAt: new Date() } });
  }

  if (b.status === "FINISHED" || b.status === "ACTIVE") {
    await prisma.sideGame.update({ where: { id: game.id }, data: { status: b.status } });
  }

  const shaped = await loadShaped(game.id);
  return NextResponse.json({ game: shaped });
}

export async function DELETE(_req, { params: paramsPromise }) {
  const params = await paramsPromise;
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.sideGame.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
