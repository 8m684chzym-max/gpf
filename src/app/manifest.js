// Web App Manifest (App Router convention) → served at /manifest.webmanifest.
// Lets members "Add to Home Screen" and launch GPF full-screen (no browser chrome).
export default function manifest() {
  return {
    name: "Golf P'la Fresquinha",
    short_name: "GPF",
    description: "Road to GPF Open — the friends' golf competition.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt",
    dir: "ltr",
    categories: ["sports"],
    background_color: "#113221",
    theme_color: "#113221",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
