#!/usr/bin/env node
/**
 * Lisbon Sports Club (Belas) — fill in par / stroke index per hole on its tees.
 *
 * Usage: npm run add-lisbon-sports-club
 *
 * Idempotent: creates the course if missing; on existing par-69 tees that have
 * no hole data yet, sets holePars / strokeIndex. Ratings / slopes and tee pars
 * are never touched (existing rounds were scored off them).
 *
 * NOTE: once a tee has hole data, rounds on it with 18 hole scores are scored
 * with exact Stableford instead of the gross-based estimate (src/lib/scoring.js).
 *
 * Source: the club's GPS-app hole screens (Nov 2026), matching src/lib/holes.js.
 * The SI there is newer than the old printed cards online. Ladies' SI may differ.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOLE_PARS = [3, 4, 3, 4, 5, 4, 4, 3, 4,  4, 3, 5, 3, 4, 4, 5, 3, 4];
const STROKE_INDEX = [16, 4, 8, 6, 12, 10, 2, 14, 18,  11, 17, 13, 5, 9, 7, 1, 15, 3];

// Only used if the course doesn't exist yet. Published ratings (GolfPass / club):
// White 69.2 / 127 (5,309 m), Yellow 67.8 / 124 (5,029 m), Red (W) 70.5 / 127 (4,658 m).
const COURSE = {
  name: "Lisbon Sports Club",
  par: 69,
  tees: [
    { name: "White",   par: 69, rating: 69.2, slope: 127 },
    { name: "Yellow",  par: 69, rating: 67.8, slope: 124 },
    { name: "Red (W)", par: 69, rating: 70.5, slope: 127 },
  ],
};

const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const holes = { holePars: HOLE_PARS, strokeIndex: STROKE_INDEX };

async function main() {
  if (HOLE_PARS.reduce((a, b) => a + b, 0) !== 69 || new Set(STROKE_INDEX).size !== 18) throw new Error("Bad hole data");
  const all = await prisma.course.findMany({ include: { tees: true } });
  const course = all.find((c) => norm(c.name) === norm(COURSE.name));

  if (!course) {
    const c = await prisma.course.create({
      data: { name: COURSE.name, par: COURSE.par, tees: { create: COURSE.tees.map((t) => ({ ...t, ...holes })) } },
      include: { tees: true },
    });
    console.log(`Created ${c.name} with ${c.tees.length} tees.`);
    return;
  }

  let filled = 0;
  for (const t of course.tees) {
    if (t.par !== 69) { console.log(`Skipped ${t.name}: tee par ${t.par} ≠ 69 — check it in Admin.`); continue; }
    if ((t.holePars?.length ?? 0) === 18 && (t.strokeIndex?.length ?? 0) === 18) continue;
    await prisma.tee.update({ where: { id: t.id }, data: holes });
    filled++;
  }
  console.log(`${course.name}: filled hole data on ${filled} tee(s).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
