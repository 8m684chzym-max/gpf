import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guard";
import { getActiveCompetition, configFrom, getScopedRounds } from "@/lib/data";
import { buildFinalBoard, buildRoadBoard } from "@/lib/scoring";

export const dynamic = 'force-dynamic';

const fmt = (v) => (v == null ? "" : v);
function toCsv(rows) { return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); }

export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Admins only", { status: 403 });
  const type = new URL(req.url).searchParams.get("type") || "standings";
  const comp = await getActiveCompetition();
  const config = configFrom(comp);
  const users = await prisma.user.findMany({ where: { role: "MEMBER" }, select: { id: true, name: true, declaredHandicap: true, manualHandicap: true, tiebreakOverride: true } });
  const rounds = await getScopedRounds(comp.id);
  let rows, filename;
  if (type === "road") {
    rows = [["Player", "Points (best 3)", "Approved qualifying", "Handicap", "Qualified"]];
    buildRoadBoard(users, rounds, config).forEach((r) => rows.push([r.user.name, r.points, r.count, fmt(r.hcp), r.qualified ? "yes" : "no"]));
    filename = `gpf-road-${comp.year}.csv`;
  } else {
    rows = [["Rank", "Player", "Handicap", "Playing Hcp", "R1 Net", "R2 Net", "Total Net"]];
    buildFinalBoard(users, rounds, config).forEach((r, i) => rows.push([i + 1, r.user.name, fmt(r.hcp), fmt(r.ph), fmt(r.net1), fmt(r.net2), fmt(r.total)]));
    filename = `gpf-standings-${comp.year}.csv`;
  }
  return new Response(toCsv(rows), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="${filename}"` } });
}
