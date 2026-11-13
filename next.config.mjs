/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// script-src needs 'unsafe-eval' in development because:
//   – React DevTools reconstructs call stacks from different environments using eval().
//   – Next.js fast-refresh and source-map tooling also rely on eval() in dev.
// In production neither React nor Next.js ever uses eval(), so it is safe to omit.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const securityHeaders = [
  // HSTS: force HTTPS for 2 years. Vercel manages the certificate automatically
  // for domains purchased or configured through Vercel.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Prevent the app from being loaded inside an iframe (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing the content type of responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only send the origin (not the full URL) as referrer when leaving the site.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Opt out of Google's FLoC / Topics interest-cohort tracking.
  { key: "Permissions-Policy", value: "interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      // Default: only same-origin resources.
      "default-src 'self'",
      // Scripts: same-origin + inline (Next.js hydration). unsafe-eval only in dev.
      scriptSrc,
      // Styles: inline styles are needed by Next.js and Tailwind/CSS-in-JS.
      "style-src 'self' 'unsafe-inline'",
      // Images: same-origin, local object blobs (scorecard preview), data URIs, HTTPS.
      "img-src 'self' blob: data: https:",
      // Video/audio: the Shot Tracer plays the member's own clip from a local blob: URL.
      "media-src 'self' blob:",
      // Fetch/XHR: same-origin API calls + Anthropic for scorecard OCR.
      "connect-src 'self' https://api.anthropic.com",
      // Fonts: next/font self-hosts at build time — no external CDN needed.
      "font-src 'self'",
      // Belt-and-suspenders against embedding.
      "frame-ancestors 'none'",
      // No plugins or Flash.
      "object-src 'none'",
      // Restrict <base> to same origin.
      "base-uri 'self'",
      // Forms only submit to same origin.
      "form-action 'self'",
    ].join("; "),
  },
];

// Swing Lab (public/swing) runs MediaPipe pose detection in the browser: the library and
// its WebAssembly come from jsDelivr and the pose model from Google Storage. Only these
// paths get the wider policy; everything else keeps the strict one above.
const swingCsp = securityHeaders.map((h) => h.key !== "Content-Security-Policy" ? h : {
  key: h.key,
  value: h.value
    .replace(scriptSrc, `${scriptSrc} 'wasm-unsafe-eval' https://cdn.jsdelivr.net`)
    .replace("connect-src 'self' https://api.anthropic.com", "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com")
    + "; worker-src 'self' blob:",
});

const nextConfig = {
  reactStrictMode: true,
  // Dev-only: allow these LAN origins to load /_next/* dev resources (HMR) when
  // you open the dev server from a phone/other device on the network. Has no
  // effect in production. Add more IPs/hostnames as needed.
  allowedDevOrigins: ["192.168.1.65"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Later entries win for the same header key.
      { source: "/swing", headers: swingCsp },
      { source: "/swing/:path*", headers: swingCsp },
    ];
  },
};

export default nextConfig;
