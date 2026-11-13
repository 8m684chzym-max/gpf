// One-off: attach FPG federation numbers to existing members (matched by name
// as stored in GPF). Safe to re-run. Run after `npm run db:push`:
//   npm run set-fpg-numbers
// Afterwards, trigger a first sync from Admin › Members › "Sync FPG now".
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NUMBERS = {
  "Pipas": "25044",            // Pedro Cota Dias
  "João Tinoco": "30506",
  "Diogo Castro": "31087",
  "Francisco CP": "38936",     // Francisco Cardoso Pinto
  "Martim": "39339",           // Martim Salgado
  "Joaquim DS": "40796",
  "David Guerreiro": "47360",
  "Lourenco Simas": "47587",
};

let done = 0;
for (const [name, fpgNumber] of Object.entries(NUMBERS)) {
  const r = await prisma.user.updateMany({ where: { name }, data: { fpgNumber } });
  if (r.count) { done += r.count; console.log(`✓ ${name} → ${fpgNumber}`); }
  else console.warn(`✗ no member named "${name}" — set it in Admin › Members instead`);
}
console.log(`\n${done} member(s) updated.`);
await prisma.$disconnect();
