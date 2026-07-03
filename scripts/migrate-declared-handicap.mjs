// OPTIONAL one-time migration.
//
// Before this change, the registration flow stored a member's self-declared
// handicap in `manualHandicap` — which the scoring engine treats as a committee
// hard override that never adjusts by results. This moves those values into the
// new `declaredHandicap` field (provisional, yields to results) for MEMBER users.
//
// It clears `manualHandicap` for members so results can take over. It does NOT
// touch ADMIN accounts. If you have intentionally set committee overrides on some
// members, edit the `where` filter before running, or re-apply them in Admin after.
//
// Run with:  node scripts/migrate-declared-handicap.mjs
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const members = await prisma.user.findMany({
  where: { role: "MEMBER", manualHandicap: { not: null }, declaredHandicap: null },
  select: { id: true, name: true, manualHandicap: true },
});

console.log(`Found ${members.length} member(s) with a legacy handicap to migrate.`);
for (const m of members) {
  await prisma.user.update({
    where: { id: m.id },
    data: { declaredHandicap: m.manualHandicap, manualHandicap: null },
  });
  console.log(`  ${m.name}: ${m.manualHandicap} -> declaredHandicap (override cleared)`);
}

await prisma.$disconnect();
console.log("Done.");
