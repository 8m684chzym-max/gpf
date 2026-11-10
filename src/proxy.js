import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Next 16 renamed the "middleware" file convention to "proxy".
//
// Hosts served by this project:
//   app.gpf.golf     the members' app; every page needs a login except the auth pages
//   tracer.gpf.golf  the Shot Tracer; members only, logs in through app.gpf.golf
//   gpf.golf / www   legacy app addresses; redirected to app.gpf.golf (same path)
// The session cookie is shared across *.gpf.golf (see COOKIE_DOMAIN in lib/auth.js),
// so one login opens both the app and the tracer.

const APP_HOST = process.env.APP_HOST || "app.gpf.golf";
const TRACER_HOST = process.env.TRACER_HOST || "tracer.gpf.golf";
const LEGACY_HOSTS = (process.env.LEGACY_APP_HOSTS || "gpf.golf,www.gpf.golf").split(",").map((h) => h.trim()).filter(Boolean);

// Pages anyone may open on the app host.
const PUBLIC_PAGES = ["/login", "/forgot-password", "/reset-password", "/privacy"];

const isPublicPage = (p) => PUBLIC_PAGES.some((x) => p === x || p.startsWith(x + "/"));
// Static files (logos, icons, course images, manifest) stay public, except the tracer.
const isStaticFile = (p) => /\.[a-z0-9]+$/i.test(p) && !p.startsWith("/tracer/");

export async function proxy(req) {
  const url = req.nextUrl;
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const path = url.pathname;

  // Old addresses: send people (and installed home-screen apps) to the new one.
  if (LEGACY_HOSTS.includes(host)) {
    return NextResponse.redirect(`https://${APP_HOST}${path}${url.search}`, 308);
  }

  // API routes do their own checks (lib/guard.js, CRON_SECRET), as before.
  if (path.startsWith("/api/")) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (host === TRACER_HOST) {
    if (!token) {
      const back = `https://${TRACER_HOST}/`;
      return NextResponse.redirect(`https://${APP_HOST}/login?callbackUrl=${encodeURIComponent(back)}`);
    }
    // The tracer is a single page: serve it at the root, send anything else back to it.
    if (path === "/" || path === "/index.html") return NextResponse.rewrite(new URL("/tracer/index.html", req.url));
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isStaticFile(path) || isPublicPage(path)) return NextResponse.next();

  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", path + url.search);
    return NextResponse.redirect(login);
  }

  if (path === "/") return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = {
  // Everything except Next's own build assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
