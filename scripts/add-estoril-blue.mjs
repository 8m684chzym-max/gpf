#!/usr/bin/env node
/**
 * Add Estoril Blue (Clube de Golf do Estoril, 9-hole Blue Course).
 *
 * Usage: npm run add-estoril-blue
 *
 * The course has 9 holes (par 34). GPF cards are 18 holes, so it is stored as
 * two loops of the 9: par 68, holes 10–18 = holes 1–9, and per WHS the 18-hole
 * stroke index gives the odd numbers to the first loop and the even ones to the
 * second (9-hole SI s → 2s−1 on loop 1, 2s on loop 2). 18-hole rating = 2 × the
 * 9-hole rating, slope unchanged.
 *
 * Idempotent like add-pinheirinho.mjs: creates the course if missing, adds any
 * missing tee (by name), fills hole data on tees without it. Ratings on existing
 * tees are never overwritten.
 *
 * Source: Hole19 "Clube de Golf do Estoril (Blue)" card (9-hole CR / SR per tee).
 * NOT confirmed by the club — check against the card. Ladies' tees carry "(W)".
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PARS_9 = [4, 4, 5, 4, 3, 4, 3, 3, 4];
const SI_9 = [5, 2, 4, 7, 6, 3, 8, 9, 1];
const HOLE_PARS = [...PARS_9, ...PARS_9];
const STROKE_INDEX = [...SI_9.map((s) => 2 * s - 1), ...SI_9.map((s) => 2 * s)];

// 9-hole course rating / slope (Hole19). Stored as 18 holes: rating × 2.
const NINE = [
  ["Yellow", 32.5, 113], // 2,331 m
  ["White", 32.7, 113],  // 2,371 m
  ["Blue", 32.0, 110],   // 2,236 m
  ["Red", 31.7, 110],    // 2,190 m
  ["Purple", 29.2, 101], // 1,412 m
  ["Yellow (W)", 34.6, 123],
  ["White (W)", 34.8, 123],
  ["Blue (W)", 34.2, 119],
  ["Red (W)", 34.0, 118],
  ["Purple (W)", 29.6, 100],
];

export const COURSE = {
  name: "Estoril Blue",
  par: 68,
  tees: NINE.map(([name, cr, slope]) => ({ name, par: 68, rating: +(cr * 2).toFixed(1), slope })),
};

const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const withHoles = (t) => ({ ...t, holePars: HOLE_PARS, strokeIndex: STROKE_INDEX });

async function main() {
  const all = await prisma.course.findMany({ include: { tees: true } });
  const course = all.find((c) => norm(c.name) === norm(COURSE.name));

  if (!course) {
    const made = await prisma.course.create({
      data: { name: COURSE.name, par: COURSE.par, tees: { create: COURSE.tees.map(withHoles) } },
      include: { tees: true },
    });
    console.log(`Created ${made.name} with ${made.tees.length} tees.`);
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
