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
  lengths: null, // metres per tee name, e.g. { Yellow: [...18] }
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

// ── Lisbon Sports Club (Belas). Par 69. Par / SI / metres per tee from the
// club's scorecard (Nov 2026; newer SI than the old printed cards online):
// White 5,309 m (CR 69.2 / SR 127), Yellow 4,975 m (CR 67.8 / SR 124).
// Par / SI also go on the tees in the DB via scripts/add-lisbon-sports-club.mjs.
const LISBON_SPORTS_CLUB = {
  slug: "lisbon-sports-club",
  name: "Lisbon Sports Club",
  place: "Belas",
  image: null,
  centre: [38.797719, -9.276001], // clubhouse area (where2golf), used before a hole is mapped
  sketchUrl: null,
  pars: [3, 4, 3, 4, 5, 4, 4, 3, 4, 4, 3, 5, 3, 4, 4, 5, 3, 4],
  si: [16, 4, 8, 6, 12, 10, 2, 14, 18, 11, 17, 13, 5, 9, 7, 1, 15, 3],
  lengths: { // metres per tee; the first one is shown when no round is in progress
    Yellow: [151, 389, 165, 317, 432, 279, 351, 135, 254,  250, 123, 446, 184, 251, 289, 458, 144, 357],
    White:  [168, 403, 174, 347, 440, 296, 358, 148, 272,  263, 126, 467, 198, 262, 326, 479, 163, 419],
  },
  geo: Array.from({ length: 18 }, () => [null, null, null]),
};

// ── Estoril Blue (Clube de Golf do Estoril, 9-hole Blue Course). Par 34, played as two
// loops for an 18-hole card: holes 10–18 are holes 1–9 again (the tees in the DB carry
// the 18-hole par / SI / rating, scripts/add-estoril-blue.mjs). Par / SI / yellow metres
// from the Hole19 card; sketches traced from Hole19 screenshots (scripts/hole-sketches),
// holes 4 and 5 not traced yet (GPS setup on the course still works).
const ESTORIL_BLUE = {
  slug: "estoril-blue",
  name: "Estoril Blue",
  place: "Estoril",
  image: "/holes/estoril-blue/hole-3.webp", // engraved hole 3 as the card picture
  centre: [38.7187, -9.3949],
  sketchUrl: "/holes/estoril-blue-sketch.json",
  pars: [4, 4, 5, 4, 3, 4, 3, 3, 4],
  si: [5, 2, 4, 7, 6, 3, 8, 9, 1],
  lengths: [298, 351, 407, null, null, 304, 131, 97, 302], // yellow, metres
  geo: Array.from({ length: 9 }, () => [null, null, null]),
};

const build = (c) => ({
  ...c,
  holes: c.geo.map(([tee, green, greenPoly], i) => ({
    n: i + 1, par: c.pars[i], si: c.si[i], tee, green, greenPoly,
    lens: c.lengths ? Object.fromEntries(Object.entries(c.lengths).map(([t, ls]) => [t, ls[i]])) : null,
    len: c.lengths ? Object.values(c.lengths)[0][i] : null,
  })),
});

export const COURSES = [PINHEIRINHO, LISBON_SPORTS_CLUB, ESTORIL_BLUE].map(build);
export const DEFAULT_COURSE = COURSES[0];

export const courseBySlug = (slug) => COURSES.find((c) => c.slug === slug) || null;
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
// The mapped course a DB course name belongs to (e.g. "Lisbon Sports Club" → its map).
export const courseMapFor = (name) => COURSES.find((c) => norm(name).includes(norm(c.name))) || null;

// Back-compat: the GPF Open course.
export const COURSE_MAP = DEFAULT_COURSE;
export const HOLES = DEFAULT_COURSE.holes;
