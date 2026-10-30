// Single source of truth for the GPF Open (the Major).
// Change the date / venue / format here and every page follows.
// Internal identifiers (RoundType "WEEKEND", roundNo, r1Date) stay as they are.

export const MAJOR = {
  name: "GPF Open",
  rounds: 1,                       // single round
  dateISO: "2026-11-07",
  dateLabel: "7 November",
  dayLabel: "Saturday",
  course: "Pinheirinho",
  location: "Comporta",
  url: "https://pinheirinhocomporta.com/pt/golf/",
};

// Shared tiebreak labels (keys are stored in the DB — keep them stable).
export const TIEBREAK = {
  "final-net": "net countback (last 9, 6, 3, 1)",
  back9: "net countback (last 9, 6, 3, 1)",
  manual: "committee decision",
};
