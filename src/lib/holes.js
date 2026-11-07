// Hole layout for the GPF Open course (Pinheirinho, Comporta) used by the hole map.
//
// Each hole: tee / green = [lat, lng] (green = centre of the green),
// greenPoly = optional outline of the green ([lat, lng] points) for front/back
// distances. A null tee/green means "not mapped yet": the map then opens in
// setup mode and any player can tap the tee and green in place (saved on that
// phone). Use "Copy layout" on the map to export corrections and paste them here
// so everyone gets them.
//
// Par / stroke index match scripts/add-pinheirinho.mjs.

export const COURSE_MAP = {
  name: "Pinheirinho",
  centre: [38.3045, -8.7660], // rough centre of the course, used before a hole is mapped
};

const PARS = [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 5, 4, 4, 4, 3, 5, 3, 4];
const SI = [9, 7, 15, 1, 3, 13, 5, 17, 11, 14, 6, 8, 4, 16, 18, 12, 10, 2];

// [tee, green, greenPoly] per hole, 1–18.
const GEO = [
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
];

export const HOLES = GEO.map(([tee, green, greenPoly], i) => ({
  n: i + 1, par: PARS[i], si: SI[i], tee, green, greenPoly,
}));
