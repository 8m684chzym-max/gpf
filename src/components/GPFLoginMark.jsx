"use client";
import { useEffect, useState } from "react";

// GPF · animated login mark (MONO) — uses the real traced mono vector.
// Setup:
//   1) Put the prepared inline SVG at:  public/brand/gpf-mono-inline.svg
//      (it already has .gpf-ring on the outer ring and .gpf-inner around the rest)
//   2) Use on the login page:  <GPFLoginMark />
//
// The component fetches the SVG and injects it inline, so the ring can draw
// itself in and the interior reveals after — no build config (SVGR) needed.
// Respects prefers-reduced-motion.

export default function GPFLoginMark({ size = 300, src = "/brand/gpf-mono-inline.svg", tagline = true }) {
  const [markup, setMarkup] = useState("");
  useEffect(() => {
    let on = true;
    fetch(src).then((r) => r.text()).then((t) => { if (on) setMarkup(t); }).catch(() => {});
    return () => { on = false; };
  }, [src]);

  return (
    <div className="gpf-login">
      <div className="gpf-badge" style={{ width: size }} dangerouslySetInnerHTML={{ __html: markup }} />
      {tagline && (
        <div className="gpf-tag"><b>A ENTRAR…</b><span>Golf p'la Fresquinha</span></div>
      )}

      <style jsx global>{`
        .gpf-badge { position: relative; aspect-ratio: 1 / 1; }
        .gpf-badge svg { display: block; width: 100%; height: 100%; overflow: visible; }

        .gpf-badge::before {
          content: ""; position: absolute; left: 50%; top: 54%; width: 52%; height: 52%;
          transform: translate(-50%,-50%) scale(.4); border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(240,168,24,.55), rgba(240,168,24,0) 68%);
          opacity: 0;
          animation: gpf-bloom 1.4s ease-out 1.1s forwards, gpf-pulse 4.5s ease-in-out 2.6s infinite;
        }
        .gpf-ring { stroke-dasharray: 2960; stroke-dashoffset: 2960; animation: gpf-draw 1.2s ease-out .15s forwards; }
        .gpf-inner { transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(.92);
          animation: gpf-reveal .7s cubic-bezier(.2,.85,.25,1) .85s forwards; }

        @keyframes gpf-draw { to { stroke-dashoffset: 0; } }
        @keyframes gpf-reveal { to { opacity: 1; transform: none; } }
        @keyframes gpf-bloom { to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }
        @keyframes gpf-pulse { 0%,100% { opacity: .5; } 50% { opacity: .9; } }

        .gpf-login { display: grid; place-items: center; }
        .gpf-tag { margin-top: 22px; text-align: center; color: #0F2E1E; opacity: 0; animation: gpf-fade .6s ease 1.5s forwards; }
        .gpf-tag b { font-size: 15px; letter-spacing: 3px; }
        .gpf-tag span { display: block; font-size: 12px; opacity: .7; margin-top: 3px; }
        @keyframes gpf-fade { to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .gpf-ring { stroke-dashoffset: 0; animation: none; }
          .gpf-inner { opacity: 1; transform: none; animation: none; }
          .gpf-badge::before { opacity: .6; transform: translate(-50%,-50%) scale(1); animation: none; }
          .gpf-tag { opacity: 1; animation: none; }
        }
      `}</style>
    </div>
  );
}
