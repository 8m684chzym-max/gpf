#!/usr/bin/env node
/**
 * Import Portuguese Golf Courses
 * 
 * Usage: npm run import-courses
 * 
 * This script loads all Portuguese golf courses with their course ratings
 * and slope ratings into the database. Existing courses are skipped (matched by name).
 */

import { PrismaClient } from "@prisma/client";
import { portugueseGolfCourses } from "./portuguese-courses.mjs";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let skipped = 0;

  for (const course of portugueseGolfCourses) {
    // Check if course already exists (case-insensitive match)
    const existing = await prisma.course.findFirst({
      where: {
        name: {
          equals: course.name,
          mode: "insensitive",
        },
      },
      include: { tees: true },
    });

    if (existing) {
      console.log(`✓ Skipped: ${course.name} (already exists)`);
      skipped++;
      continue;
    }

    // Create course with tees
    try {
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
        include: { tees: true },
      });
      console.log(
        `✓ Created: ${course.name} (${course.par} par, ${course.tees.length} tees)`
      );
      created++;
    } catch (err) {
      console.error(`✗ Failed: ${course.name} - ${err.message}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created} courses`);
  console.log(`   Skipped: ${skipped} courses (already exist)`);
  console.log(`   Total:   ${portugueseGolfCourses.length} courses in database`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
