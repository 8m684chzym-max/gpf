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
  image: "/courses/pinheirinho.jpeg", // square thumbnail; null → flag tile
};

// Rank is continuous: only approved qualifying rounds played on or after this date
// count. Set to the day after the last Open — earlier rounds are already reflected in
// the declared handicaps, which were reset to each player's Open playing handicap.
export const RANK_SINCE = "2026-11-08";
export const RANK_SINCE_LABEL = "8 November 2026";

// Shared tiebreak labels (keys are stored in the DB — keep them stable).
export const TIEBREAK = {
  "final-net": "net countback (last 9, 6, 3, 1)",
  back9: "net countback (last 9, 6, 3, 1)",
  manual: "committee decision",
};
