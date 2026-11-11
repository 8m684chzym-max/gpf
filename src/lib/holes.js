// Hole layouts for the courses with a hole map (Play › Start play).
//
// Each hole: tee / green = [lat, lng] (green = centre of the green),
// greenPoly = optional outline of the green ([lat, lng] points) for front/back
// distances. A null tee/green means "not mapped yet": the map then opens in
// setup mode and any player can tap the tee and green in place (shared with
// everyone via /api/holes). Use "Copy layout" on the map to export them and
// paste them here so they become the course's defaults.
//
// To map another course: add an entry to COURSES below (and an image in
// public/courses/, a sketch in public/holes/ if there is one). Play, the round
// set-up and the map pick it up from here.

// ── Pinheirinho (Comporta) — GPF Open 2026. Par / SI match scripts/add-pinheirinho.mjs.
const PINHEIRINHO = {
  slug: "pinheirinho",
  name: "Pinheirinho",
  place: "Comporta",
  image: "/courses/pinheirinho.jpeg",
  centre: [38.3045, -8.7660], // rough centre of the course, used before a hole is mapped
  sketchUrl: "/holes/pinheirinho-sketch.json", // traced hole sketches, local metres from the tee
  pars: [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 5, 4, 4, 4, 3, 5, 3, 4],
  si: [9, 7, 15, 1, 3, 13, 5, 17, 11, 14, 6, 8, 4, 16, 18, 12, 10, 2],
  lengths: null,
  // [tee, green, greenPoly] per hole, 1–18.
  geo: [
    /*  1 */ [null, null, null],
    /*  2 */ [null, null, null],
    /*  3 */ [null, null, null],
    /*  4 */ [null, null, null],
    /*  5 */ [null, null, null],
    /*  6 */ [null, null, null],
    /*  7 */ [null, null, null],
    /*  8 */ [null, null, null],
    /*  9 */ [null, null, null],
    /* 10 */ [null, null, null],
    /* 11 */ [null, null, null],
    /* 12 */ [null, null, null],
    /* 13 */ [null, null, null],
    /* 14 */ [null, null, null],
    /* 15 */ [null, null, null],
    /* 16 */ [null, null, null],
    /* 17 */ [null, null, null],
    /* 18 */ [null, null, null],
  ],
};

// ── Lisbon Sports Club (Belas). Par 69. Par / SI / yellow-tee metres from the
// club's GPS-app screens (Nov 2026; newer SI than the old printed cards online).
// Yellow lengths not legible on those screens are null. Par / SI also go on the
// tees in the DB via scripts/add-lisbon-sports-club.mjs.
const LISBON_SPORTS_CLUB = {
  slug: "lisbon-sports-club",
  name: "Lisbon Sports Club",
  place: "Belas",
  image: null,
  centre: [38.797719, -9.276001], // clubhouse area (where2golf), used before a hole is mapped
  sketchUrl: null,
  pars: [3, 4, 3, 4, 5, 4, 4, 3, 4, 4, 3, 5, 3, 4, 4, 5, 3, 4],
  si: [16, 4, 8, 6, 12, 10, 2, 14, 18, 11, 17, 13, 5, 9, 7, 1, 15, 3],
  lengths: [151, 389, 165, 317, 432, null, null, null, 254, 250, 123, null, 184, null, 289, 458, 144, 357], // yellow, metres
  geo: Array.from({ length: 18 }, () => [null, null, null]),
};

const build = (c) => ({
  ...c,
  holes: c.geo.map(([tee, green, greenPoly], i) => ({
    n: i + 1, par: c.pars[i], si: c.si[i], len: c.lengths?.[i] ?? null, tee, green, greenPoly,
  })),
});

export const COURSES = [PINHEIRINHO, LISBON_SPORTS_CLUB].map(build);
export const DEFAULT_COURSE = COURSES[0];

export const courseBySlug = (slug) => COURSES.find((c) => c.slug === slug) || null;
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
// The mapped course a DB course name belongs to (e.g. "Lisbon Sports Club" → its map).
export const courseMapFor = (name) => COURSES.find((c) => norm(name).includes(norm(c.name))) || null;

// Back-compat: the GPF Open course.
export const COURSE_MAP = DEFAULT_COURSE;
export const HOLES = DEFAULT_COURSE.holes;
