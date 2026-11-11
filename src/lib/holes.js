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
  image: "/courses/lisbon-sports-club.jpeg",
  centre: [38.797719, -9.276001], // clubhouse area (where2golf), used before a hole is mapped
  sketchUrl: null,
  pars: [3, 4, 3, 4, 5, 4, 4, 3, 4, 4, 3, 5, 3, 4, 4, 5, 3, 4],
  si: [16, 4, 8, 6, 12, 10, 2, 14, 18, 11, 17, 13, 5, 9, 7, 1, 15, 3],
  lengths: { // metres per tee; the first one is shown when no round is in progress
    Yellow: [151, 389, 165, 317, 432, 279, 351, 135, 254,  250, 123, 446, 184, 251, 289, 458, 144, 357],
    White:  [168, 403, 174, 347, 440, 296, 358, 148, 272,  263, 126, 467, 198, 262, 326, 479, 163, 419],
  },
  // Tee / green from Esri World Imagery (ArcGIS), Nov 2026; greens numbered by Joaquim.
  // Greens are on the real greens; tees are estimated from the card length (±15 m).
  // 17 / 18 placed from Joaquim's description; hole 7 tee still to confirm (Nov 2026).
  geo: [
    /*  1 */ [[38.797765, -9.274495], [38.796532, -9.274093], null],
    /*  2 */ [[38.796866, -9.274710], [38.793668, -9.273396], null],
    /*  3 */ [[38.793889, -9.273557], [38.792518, -9.272671], null],
    /*  4 */ [[38.793760, -9.272967], [38.796013, -9.273664], null],
    /*  5 */ [[38.796523, -9.273557], [38.796795, -9.278385], null],
    /*  6 */ [[38.796941, -9.278277], [38.797966, -9.281281], null],
    /*  7 */ [[38.797652, -9.280155], [38.799387, -9.283373], null],
    /*  8 */ [[38.798714, -9.283467], [38.799784, -9.283990], null],
    /*  9 */ [[38.800061, -9.283740], [38.799262, -9.281013], null],
    /* 10 */ [[38.799471, -9.280718], [38.800474, -9.283213], null],
    /* 11 */ [[38.800271, -9.283767], [38.801101, -9.282944], null],
    /* 12 */ [[38.801373, -9.282998], [38.798655, -9.279404], null],
    /* 13 */ [[38.798446, -9.279457], [38.800098, -9.279297], null],
    /* 14 */ [[38.800657, -9.279274], [38.802559, -9.278255], null],
    /* 15 */ [[38.802120, -9.277208], [38.801535, -9.273748], null],
    /* 16 */ [[38.801222, -9.273561], [38.801117, -9.278925], null],
    /* 17 */ [[38.798593, -9.277848], [38.797882, -9.279162], null],
    /* 18 */ [[38.798049, -9.279189], [38.797389, -9.275032], null],
  ],
};

// ── Estoril Blue (Clube de Golf do Estoril, 9-hole Blue Course). Par 34, played as two
// loops for an 18-hole card: holes 10–18 are holes 1–9 again (the tees in the DB carry
// the 18-hole par / SI / rating, scripts/add-estoril-blue.mjs). Par / SI / yellow metres
// from the Hole19 card; sketches traced from Hole19 screenshots (scripts/hole-sketches),
// holes 4 and 5 not traced yet. Tee / green positions below are from satellite imagery.
const ESTORIL_BLUE = {
  slug: "estoril-blue",
  name: "Estoril Blue",
  place: "Estoril",
  image: "/courses/estoril-blue.jpeg",
  centre: [38.7187, -9.3949],
  sketchUrl: "/holes/estoril-blue-sketch.json",
  pars: [4, 4, 5, 4, 3, 4, 3, 3, 4],
  si: [5, 2, 4, 7, 6, 3, 8, 9, 1],
  lengths: [298, 351, 407, null, null, 304, 131, 97, 302], // yellow, metres
  // Tee / green read off Esri World Imagery (ArcGIS), Nov 2026: holes 1–3 and 6–9 by matching
  // the traced sketches against the satellite image, 4 and 5 by eye (the two remaining greens
  // between 3 and 6, 284 m and 150 m). Approximate (±10 m); GPS setup on the course overrides.
  geo: [
    /* 1 */ [[38.718073, -9.398016], [38.720521, -9.399189], null],
    /* 2 */ [[38.720839, -9.399840], [38.723706, -9.401415], null],
    /* 3 */ [[38.723940, -9.401760], [38.720446, -9.400498], null],
    /* 4 */ [[38.720241, -9.400892], [38.722578, -9.402207], null],
    /* 5 */ [[38.722668, -9.401912], [38.723991, -9.402234], null],
    /* 6 */ [[38.724270, -9.402841], [38.721705, -9.402687], null],
    /* 7 */ [[38.721305, -9.402107], [38.720209, -9.401517], null],
    /* 8 */ [[38.720544, -9.401348], [38.720125, -9.400482], null],
    /* 9 */ [[38.720057, -9.399412], [38.717340, -9.399377], null],
  ],
};

// lengths: one array (yellow metres) or { teeName: [metres per hole] }.
const build = (c) => {
  const byTee = Array.isArray(c.lengths) ? { Yellow: c.lengths } : c.lengths || null;
  return {
    ...c,
    holes: c.geo.map(([tee, green, greenPoly], i) => ({
      n: i + 1, par: c.pars[i], si: c.si[i], tee, green, greenPoly,
      lens: byTee ? Object.fromEntries(Object.entries(byTee).map(([t, ls]) => [t, ls[i] ?? null])) : null,
      len: byTee ? Object.values(byTee)[0][i] ?? null : null,
    })),
  };
};

export const COURSES = [PINHEIRINHO, LISBON_SPORTS_CLUB, ESTORIL_BLUE].map(build);
export const DEFAULT_COURSE = COURSES[0];

export const courseBySlug = (slug) => COURSES.find((c) => c.slug === slug) || null;
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
// The mapped course a DB course name belongs to (e.g. "Lisbon Sports Club" → its map).
export const courseMapFor = (name) => COURSES.find((c) => norm(name).includes(norm(c.name))) || null;

// Back-compat: the GPF Open course.
export const COURSE_MAP = DEFAULT_COURSE;
export const HOLES = DEFAULT_COURSE.holes;
