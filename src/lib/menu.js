// One menu for every GPF surface: gpf.golf (homepage), app.gpf.golf and tracer.gpf.golf.
// The homepage (homepage/src/components/site-chrome.tsx), the Shot Tracer
// (public/tracer/index.html) and Swing Lab (public/swing/index.html) carry a copy
// of this list — keep the four in sync.

export const HOME_URL = process.env.NEXT_PUBLIC_HOME_URL || "https://gpf.golf";
export const TRACER_URL = process.env.NEXT_PUBLIC_TRACER_URL || "https://tracer.gpf.golf";
// Swing Lab is a static page in public/swing, served at app.gpf.golf/swing (members only).
export const SWING_URL = "/swing";

// Tools menu: members' video tools. Both are static pages, so they open with a full
// page load (external = true), never through the client router.
export const TOOLS = [
  [TRACER_URL, "Tracer", true],
  [SWING_URL, "Swing", true],
];

// [href, label, external?, cta?] — cta renders as the action button (Submit score).
// { label, items } renders as a drop-down group.
export const MENU = [
  [HOME_URL, "Home", true],
  ["/play", "Play"],
  ["/open", "Open"],
  ["/team-cup", "Team Cup"],
  ["/rank", "Rank"],
  ["/shop", "Shop"],
  { label: "Tools", items: TOOLS },
  ["/profile", "My profile"],
  ["/submit", "Submit score", false, true],
];
