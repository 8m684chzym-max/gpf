#!/usr/bin/env node
/**
 * Add Pinheirinho (Comporta) — venue of the GPF Open, 7 Nov 2026.
 *
 * Usage: npm run add-pinheirinho
 *
 * Idempotent: creates the course if missing, adds any tee not already there
 * (matched by name), and fills in par / stroke index per hole on tees that
 * don't have them yet. Ratings on existing tees are never overwritten.
 * Needs the Tee.holePars / Tee.strokeIndex columns: run `npm run db:push` first.
 *
 * Source: GolfPass "Herdade do Pinheirinho" tee table (par 72, 6,530 m Black).
 * NOT confirmed by the club — check against the card on the day and correct
 * rating/slope in the DB if they differ. Ladies' tees carry a "(W)" suffix.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Per hole 1–18 (same source). Ladies' tees use the same SI here — check the card.
const HOLE_PARS = [4, 4, 3, 5, 4, 4, 5, 3, 4,  4, 5, 4, 4, 4, 3, 5, 3, 4];
const STROKE_INDEX = [9, 7, 15, 1, 3, 13, 5, 17, 11,  14, 6, 8, 4, 16, 18, 12, 10, 2];

const COURSE = {
  name: "Pinheirinho",
  par: 72,
  tees: [  // each also gets holePars / strokeIndex below
    { name: "Black",      par: 72, rating: 73.8, slope: 136 }, // 6,530 m
    { name: "White",      par: 72, rating: 71.5, slope: 131 }, // 6,080 m
    { name: "Yellow",     par: 72, rating: 69.7, slope: 128 }, // 5,670 m
    { name: "Blue",       par: 72, rating: 67.5, slope: 123 }, // 5,315 m
    { name: "Red",        par: 72, rating: 64.7, slope: 118 }, // 4,685 m
    { name: "Yellow (W)", par: 72, rating: 75.5, slope: 135 },
    { name: "Blue (W)",   par: 72, rating: 72.8, slope: 130 },
    { name: "Red (W)",    par: 72, rating: 69.3, slope: 123 },
  ],
};

const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const withHoles = (t) => ({ ...t, holePars: HOLE_PARS, strokeIndex: STROKE_INDEX });

async function main() {
  const all = await prisma.course.findMany({ include: { tees: true } });
  let course = all.find((c) => norm(c.name) === norm(COURSE.name));

  if (!course) {
    course = await prisma.course.create({
      data: { name: COURSE.name, par: COURSE.par, tees: { create: COURSE.tees.map(withHoles) } },
      include: { tees: true },
    });
    console.log(`Created ${course.name} with ${course.tees.length} tees.`);
    return;
  }

  const have = new Set(course.tees.map((t) => norm(t.name)));
  const missing = COURSE.tees.filter((t) => !have.has(norm(t.name)));
  for (const t of missing) await prisma.tee.create({ data: { ...withHoles(t), courseId: course.id } });
  let filled = 0;
  for (const t of course.tees) {
    if ((t.holePars?.length ?? 0) === 18 && (t.strokeIndex?.length ?? 0) === 18) continue;
    await prisma.tee.update({ where: { id: t.id }, data: { holePars: HOLE_PARS, strokeIndex: STROKE_INDEX } });
    filled++;
  }
  console.log(`${course.name} already exists — added ${missing.length} tee(s), filled hole data on ${filled}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
