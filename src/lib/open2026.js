// GPF Open 2026 — final, committee-validated results (Pinheirinho, Yellow tees, 7 Nov 2026).
// Frozen on purpose: Rank is continuous now and declared handicaps moved on after the
// Open, so recomputing this board from live data would change it. Do not derive — edit
// here only if the committee corrects a result.
//
//   hcp   playing handicap used on the day (scoring app)
//   gross total strokes (picked-up holes count the strokes on the card)
//   bonus Rank bonus strokes (3/2/1), taken off the gross
//   net   gross − bonus − hcp   → lowest wins
//   pts   Stableford points off hcp (information only; bonus strokes don't change them)

export const OPEN_2026 = {
  date: "7 November 2026",
  course: "Pinheirinho",
  tee: "Yellow",
  format: "single round · medal net",
  // Champion caricature ("The Golffather"). Local file is the master; the CDN copy
  // only covers the gap until public/open/golffather-2026.png is committed.
  championArt: "/open/golffather-2026.png",
  championArtFallback: "https://d8j0ntlcm91z4.cloudfront.net/user_3EgZl6XTm29RFytRBe8DU6rbJSJ/hf_20261111_091441_396c897d-0ff0-40be-bfa5-a1591d708eb7.png",
};

const rows = [
  { name: "João Tinoco", hcp: 18, gross: 99, bonus: 3, pts: 27 },
  { name: "David Guerreiro", hcp: 16, gross: 95, bonus: 0, pts: 29 },
  { name: "Diogo Castro", hcp: 14, gross: 94, bonus: 1, pts: 28 },
  { name: "Martim", hcp: 23, gross: 103, bonus: 0, pts: 29 },
  { name: "Lourenco Simas", hcp: 17, gross: 100, bonus: 2, pts: 25 },
  { name: "Afonso", hcp: 20, gross: 102, bonus: 0, pts: 26 },
  { name: "Joaquim DS", hcp: 18, gross: 101, bonus: 0, pts: 25 },
  { name: "Pipas", hcp: 13, gross: 99, bonus: 0, pts: 24 },
  { name: "António", hcp: 14, gross: 100, bonus: 0, pts: 22 },
  { name: "Francisco CP", hcp: 16, gross: 103, bonus: 0, pts: 21 },
  { name: "Tomas Rodrigues", hcp: 20, gross: 110, bonus: 0, pts: 18 },
  { name: "Joao Goncalves", hcp: 23, gross: 113, bonus: 0, pts: 20 },
];

// Net, then shared positions for equal nets (no countback applied by the committee).
export const OPEN_2026_RESULTS = rows
  .map((r) => ({ ...r, net: r.gross - r.bonus - r.hcp }))
  .sort((a, b) => a.net - b.net)
  .map((r, _, all) => ({ ...r, pos: all.findIndex((x) => x.net === r.net) + 1, tied: all.filter((x) => x.net === r.net).length > 1 }));
