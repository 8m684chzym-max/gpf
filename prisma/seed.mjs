import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function main() {
  const year = new Date().getFullYear();

  // Admin
  const adminHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@gpf.golf" },
    update: {},
    create: { name: "GPF Committee", email: "admin@gpf.golf", passwordHash: adminHash, role: "ADMIN" },
  });

  // Active competition
  const comp = await prisma.competition.upsert({
    where: { year },
    update: { active: true },
    create: { year, active: true, qualifyingRoundsRequired: 3, handicapAllowance: 90, roundingMode: "round", tiebreak: "final-net",
      r1Date: new Date(`${year}-10-10`), r2Date: new Date(`${year}-10-11`) },
  });

  // Home course
  let course = await prisma.course.findFirst({ where: { name: "Lisbon Sports Club" }, include: { tees: true } });
  if (!course) {
    course = await prisma.course.create({
      data: { name: "Lisbon Sports Club", par: 69, tees: { create: [
        { name: "Yellow", par: 69, rating: 69.0, slope: 123 },
        { name: "White", par: 69, rating: 70.5, slope: 126 },
        { name: "Red", par: 71, rating: 71.2, slope: 128 },
      ] } },
      include: { tees: true },
    });
  }

  if (process.env.SEED_SAMPLE === "true") {
    const names = ["Lourenco", "Diogo", "Tiago", "Bruno", "Andre", "Rafa"];
    const handicaps = [8.5, 12.3, 6.2, 14.1, 18.7, 10.4]; // Sample WHS handicaps
    const hash = await bcrypt.hash("welcome123", 10);
    const yellow = course.tees.find((t) => t.name === "Yellow") || course.tees[0];
    const members = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const u = await prisma.user.upsert({
        where: { email: `${name.toLowerCase()}@gpf.golf` },
        update: {},
        create: { name, email: `${name.toLowerCase()}@gpf.golf`, passwordHash: hash, role: "MEMBER", manualHandicap: handicaps[i] },
      });
      members.push(u);
    }
    for (let i = 0; i < members.length; i++) {
      const u = members[i];
      const partner = members[(i + 1) % members.length];
      for (const g of [88, 91, 86]) {
        await prisma.round.create({ data: { userId: u.id, competitionId: comp.id, type: "QUALIFYING", date: new Date(`${year}-04-15`),
          courseId: course.id, teeId: yellow.id, gross: g + i, partnerId: partner.id, status: "APPROVED", reviewedBy: "GPF Committee", reviewedAt: new Date() } });
      }
      const base = [80, 84, 78, 82, 86, 79][i];
      await prisma.round.create({ data: { userId: u.id, competitionId: comp.id, type: "WEEKEND", roundNo: 1, date: comp.r1Date,
        courseId: course.id, teeId: yellow.id, gross: base, status: "APPROVED", reviewedBy: "GPF Committee", reviewedAt: new Date() } });
      await prisma.round.create({ data: { userId: u.id, competitionId: comp.id, type: "WEEKEND", roundNo: 2, date: comp.r2Date,
        courseId: course.id, teeId: yellow.id, gross: base + (i % 2 ? 2 : -1), status: "APPROVED", reviewedBy: "GPF Committee", reviewedAt: new Date(),
        scorecard: { create: { holes: Array.from({ length: 18 }, () => 4 + (Math.random() < 0.3 ? 1 : 0)) } } } });
    }
  }
  console.log("Seed complete.");
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
