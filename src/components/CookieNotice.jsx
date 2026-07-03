"use client";
// CookieNotice — GDPR/ePrivacy cookie transparency banner.
//
// This app uses ONE strictly-necessary functional cookie (the NextAuth session).
// Under the ePrivacy Directive, strictly-necessary cookies do not require prior
// consent — but you still must inform users about them. This banner:
//   1. Tells the user what the cookie does.
//   2. Links to the full Privacy Policy.
//   3. Dismisses permanently using localStorage (not a cookie itself).
//
// No consent toggle is needed because we have zero analytics/advertising cookies.
// If you ever add any non-essential cookies you must switch to an opt-in model.
import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Cookie } from "lucide-react";

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("gpf_cookie_notice_dismissed")) setVisible(true);
    } catch {
      // localStorage may be blocked in private mode — show the notice anyway.
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem("gpf_cookie_notice_dismissed", "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      style={{
        position: "fixed", bottom: 80, left: 0, right: 0, zIndex: 200,
        maxWidth: 560, margin: "0 auto", padding: "0 12px",
        animation: "fadeUp .25s ease",
      }}
    >
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{
        background: "var(--green-900,#0c3a2c)", color: "#e8f4ee",
        borderRadius: 14, padding: "14px 16px",
        display: "flex", alignItems: "flex-start", gap: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,.25)",
      }}>
        <Cookie size={18} style={{ flexShrink: 0, marginTop: 2, color: "var(--flag,#f0a818)" }} />
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          <strong>Cookies &amp; privacy</strong> — We use one functional session cookie to keep you logged in. No tracking, no ads, no analytics.{" "}
          <Link href="/privacy" style={{ color: "var(--flag,#f0a818)", textDecoration: "underline" }}>
            Privacy policy
          </Link>.
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss cookie notice"
          style={{
            background: "rgba(255,255,255,.12)", border: "none", color: "#fff",
            borderRadius: 8, width: 28, height: 28, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
