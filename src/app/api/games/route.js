import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { logAudit } from "@/lib/data";

export const dynamic = "force-dynamic";

const LIMITS = { wolf: [4, 4], roundrobin: [4, 4], bbb: [2, 6] };
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function makeCode() {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
}

// Reshape a DB game into the client's game object (same shape the boards expect).
export function shapeGame(g) {
  const holes = Array.from({ length: 18 }, () => null);
  for (const h of g.holes || []) if (h.hole >= 1 && h.hole <= 18) holes[h.hole - 1] = h.data;
  return {
    id: g.id,
    code: g.code,
    type: g.type,
    status: g.status,
    players: (g.players || []).map((p) => ({ id: `p_${p.id}`, name: p.name, position: p.position, userId: p.userId || null })),
    holes,
    createdBy: g.createdBy?.name || null,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

export async function GET(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const finished = (new URL(req.url).searchParams.get("status") || "active").toLowerCase() === "finished";
  const games = await prisma.sideGame.findMany({
    where: { status: finished ? "FINISHED" : "ACTIVE" },
    orderBy: finished ? { updatedAt: "desc" } : { createdAt: "desc" },
    take: finished ? 60 : undefined,
    include: { players: { orderBy: { position: "asc" } }, holes: true, createdBy: { select: { name: true } } },
  });
  return NextResponse.json({ games: games.map(shapeGame) });
}

export async function POST(req) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json();

  if (!LIMITS[b.type]) return NextResponse.json({ error: "Unknown game type." }, { status: 400 });
  const players = Array.isArray(b.players) ? b.players.filter((p) => p && p.name) : [];
  const [min, max] = LIMITS[b.type];
  if (players.length < min || players.length > max)
    return NextResponse.json({ error: `That game needs ${min === max ? min : `${min}–${max}`} players.` }, { status: 400 });

  // Ensure a unique join code.
  let code = makeCode();
  for (let i = 0; i < 6; i++) {
    const clash = await prisma.sideGame.findUnique({ where: { code } });
    if (!clash) break;
    code = makeCode();
  }

  const game = await prisma.sideGame.create({
    data: {
      code,
      type: b.type,
      status: "ACTIVE",
      createdById: user.id,
      players: {
        create: players.map((p, idx) => ({
          position: idx,
          name: String(p.name).slice(0, 40),
          userId: p.userId && !String(p.userId).startsWith("guest_") ? p.userId : null,
        })),
      },
    },
    include: { players: { orderBy: { position: "asc" } }, holes: true, createdBy: { select: { name: true } } },
  });

  await logAudit(user.name, "sidegame.create", game.id, `${b.type} · ${players.length}p`);
  return NextResponse.json({ id: game.id, code: game.code, game: shapeGame(game) });
}
