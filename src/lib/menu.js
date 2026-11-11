// One menu for every GPF surface: gpf.golf (homepage), app.gpf.golf and tracer.gpf.golf.
// The homepage (homepage/src/components/site-chrome.tsx) and the tracer
// (public/tracer/index.html) carry a copy of this list — keep the three in sync.

export const HOME_URL = process.env.NEXT_PUBLIC_HOME_URL || "https://gpf.golf";
export const TRACER_URL = process.env.NEXT_PUBLIC_TRACER_URL || "https://tracer.gpf.golf";

// [href, label, external?, cta?] — cta renders as the action button (Submit score).
export const MENU = [
  [HOME_URL, "Home", true],
  ["/play", "Play"],
  ["/open", "Open"],
  ["/team-cup", "Team Cup"],
  ["/rank", "Rank"],
  ["/shop", "Shop"],
  [TRACER_URL, "Tracer", true],
  ["/profile", "My profile"],
  ["/submit", "Submit score", false, true],
];
