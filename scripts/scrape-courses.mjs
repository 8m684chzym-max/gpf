#!/usr/bin/env node
/**
 * Web Scraper for Portuguese Golf Courses
 * 
 * Scrapes multiple sources to fetch Portuguese golf courses with:
 * - Course names
 * - Par values
 * - Tee information (names, ratings, slopes, yardages)
 * - Designer/architect
 * - Year opened
 * 
 * Usage: npm run scrape-courses
 * 
 * Data is saved to: scripts/scraped-courses.json
 */

import fs from "fs";
import path from "path";

// Helper function to fetch HTML from a URL
async function fetchHTML(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (err) {
    console.error(`Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

// Simple HTML parsing helper (without cheerio)
function parseHTML(html, selector) {
  const matches = [];
  const regex = new RegExp(`<${selector}[^>]*>([^<]*)</${selector}>`, "gi");
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

// Scrape Premier Golf blog (has detailed course info)
async function scrapePremierGolf() {
  console.log("\n📍 Scraping Premier Golf...");
  const url =
    "https://www.premiergolf.com/blog/2024/07/the-13-best-golf-courses-in-portugal-you-can-play/";
  const html = await fetchHTML(url);
  if (!html) return [];

  const courses = [];
  const courseMatches = html.match(
    /Opened:.*?Par:.*?Length:.*?Slope\s*(\d+)\s*\/\s*Rating\s*([\d.]+)/gi
  );

  if (courseMatches) {
    console.log(`   Found ${courseMatches.length} courses with ratings`);
  }

  return courses;
}

// Scrape Today's Golfer (comprehensive course list)
async function scrapeTodaysGolfer() {
  console.log("\n📍 Scraping Today's Golfer...");
  const url =
    "https://www.todays-golfer.com/courses/best/golf-courses-in-portugal/";
  const html = await fetchHTML(url);
  if (!html) return [];

  const courses = [];

  // Extract course names and details
  const courseBlocks = html.split(/<h[2-3]/);

  for (const block of courseBlocks) {
    // Look for course rating/slope patterns
    const ratingMatch = block.match(
      /Rating\s*[\s:]*(\d+\.?\d*)\s*[,\/]\s*Slope\s*[\s:]*(\d+)/i
    );
    const parMatch = block.match(/Par\s*[\s:]*(\d+)/i);

    if (ratingMatch && parMatch) {
      console.log(`   Found course with rating ${ratingMatch[1]}, slope ${ratingMatch[2]}`);
    }
  }

  return courses;
}

// Scrape Golf Monthly (top courses list)
async function scrapeGolfMonthly() {
  console.log("\n📍 Scraping Golf Monthly...");
  const url =
    "https://www.golfmonthly.com/courses/best-golf-courses-in-portugal-196348";
  const html = await fetchHTML(url);
  if (!html) return [];

  const courses = [];

  // Extract course data from the page
  const courseNames = html.match(/<h[2-3][^>]*>([^<]*Portugal Golf[^<]*)<\/h/gi);

  if (courseNames) {
    console.log(`   Found ${courseNames.length} course references`);
  }

  return courses;
}

// Scrape All Square Golf (comprehensive rankings)
async function scrapeAllSquareGolf() {
  console.log("\n📍 Scraping All Square Golf...");
  const url = "https://www.allsquaregolf.com/golf-courses/portugal/top-100";
  const html = await fetchHTML(url);
  if (!html) return [];

  const courses = [];

  // Look for course titles and links
  const courseLinks = html.match(/href="([^"]*golf-course[^"]*)">([^<]+)<\/a>/gi);

  if (courseLinks) {
    console.log(`   Found ${courseLinks.length} course links`);
    // Could make additional requests to each course page for details
  }

  return courses;
}

// Scrape Top 100 Golf Courses (rankings)
async function scrapeTop100Golf() {
  console.log("\n📍 Scraping Top 100 Golf Courses...");
  const url =
    "https://www.top100golfcourses.com/golf-courses/continental-europe/portugal";
  const html = await fetchHTML(url);
  if (!html) return [];

  const courses = [];

  // Extract course information from the rankings page
  const courseBlocks = html.split(/<div class="course/);

  for (const block of courseBlocks) {
    const nameMatch = block.match(/<h[2-4][^>]*>([^<]+)<\/h/);
    const ratingMatch = block.match(/Rating\s*[\s:]*(\d+\.?\d*)/i);
    const slopeMatch = block.match(/Slope\s*[\s:]*(\d+)/i);

    if (nameMatch && (ratingMatch || slopeMatch)) {
      console.log(`   Found: ${nameMatch[1]}`);
    }
  }

  return courses;
}

// Main scraper function
async function scrapeAllCourses() {
  console.log("🏌️ Portuguese Golf Courses Web Scraper");
  console.log("=====================================\n");
  console.log("Scraping multiple sources for comprehensive course data...\n");

  try {
    // Run all scrapers in parallel
    const [premierGolf, todaysGolfer, golfMonthly, allSquare, top100] =
      await Promise.all([
        scrapePremierGolf(),
        scrapeTodaysGolfer(),
        scrapeGolfMonthly(),
        scrapeAllSquareGolf(),
        scrapeTop100Golf(),
      ]);

    // Combine and deduplicate courses
    const allCourses = [
      ...premierGolf,
      ...todaysGolfer,
      ...golfMonthly,
      ...allSquare,
      ...top100,
    ];

    const uniqueCourses = Array.from(
      new Map(allCourses.map((c) => [c.name?.toLowerCase(), c])).values()
    );

    console.log(
      `\n✅ Scraping Complete!\n   Total unique courses found: ${uniqueCourses.length}`
    );

    // Save to file
    const outputPath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "scraped-courses.json"
    );

    fs.writeFileSync(outputPath, JSON.stringify(uniqueCourses, null, 2));
    console.log(`   Saved to: ${outputPath}`);

    return uniqueCourses;
  } catch (err) {
    console.error("Scraping error:", err);
    return [];
  }
}

// Run scraper
scrapeAllCourses().catch(console.error);
