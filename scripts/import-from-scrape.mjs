#!/usr/bin/env node
/**
 * Import Scraped Portuguese Golf Courses
 * 
 * Usage: npm run import-courses:scraped
 * 
 * Imports the complete Portuguese golf courses database (with ratings & slopes)
 * into the Prisma database. Existing courses are detected and skipped.
 */

import { PrismaClient } from "@prisma/client";
import { portugueseGolfCourses } from "./portuguese-courses-complete.mjs";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let skipped = 0;
  let failed = 0;

  console.log("🏌️ Importing Portuguese Golf Courses");
  console.log("====================================\n");
  console.log(`Total courses to import: ${portugueseGolfCourses.length}\n`);

  for (const course of portugueseGolfCourses) {
    try {
      // Check if course already exists (case-insensitive)
      const existing = await prisma.course.findFirst({
        where: {
          name: {
            equals: course.name,
            mode: "insensitive",
          },
        },
      });

      if (existing) {
        console.log(`✓ SKIP: ${course.name}`);
        skipped++;
        continue;
      }

      // Create course with all tees
      await prisma.course.create({
        data: {
          name: course.name,
          par: course.par,
          tees: {
            create: course.tees.map((tee) => ({
              name: tee.name,
              par: tee.par,
              rating: tee.rating,
              slope: tee.slope,
            })),
          },
        },
      });

      console.log(
        `✓ CREATED: ${course.name} (${course.region}) - Par ${course.par}, ${course.tees.length} tees`
      );
      created++;
    } catch (err) {
      console.error(`✗ FAILED: ${course.name} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Import Summary:`);
  console.log(`   Created: ${created} courses`);
  console.log(`   Skipped: ${skipped} courses (already exist)`);
  console.log(`   Failed:  ${failed} courses`);
  console.log(`   Total:   ${portugueseGolfCourses.length} courses`);

  if (created > 0) {
    console.log(
      `\n✅ Successfully imported ${created} Portuguese golf courses!`
    );
  } else if (skipped === portugueseGolfCourses.length) {
    console.log(`\nℹ️  All Portuguese golf courses are already in the database.`);
  } else {
    console.log(`\n⚠️  Import completed with ${failed} failures.`);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
