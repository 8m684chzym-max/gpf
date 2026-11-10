// @lovable.dev/vite-tanstack-config already includes many plugins — see original comment.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  // The members' app moved from gpf.golf to app.gpf.golf: send old links, bookmarks
  // and home-screen shortcuts (and password-reset emails) to the same page there.
  nitro: {
    routeRules: Object.fromEntries(
      [
        "dashboard", "submit", "road", "open", "games", "weekend", "final", "profile", "admin",
        "login", "forgot-password", "reset-password", "privacy",
      ].flatMap((p) => [
        [`/${p}`, { redirect: { to: `https://app.gpf.golf/${p}`, status: 308 } }],
        [`/${p}/**`, { redirect: { to: `https://app.gpf.golf/${p}/**`, status: 308 } }],
      ]),
    ),
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
  },
});
