"use client";
// "Register on myFPG" helper.
// GPF never talks to the FPG: there's no public API, and submitting on a
// player's behalf would mean holding their myFPG password. Instead we lay the
// round out exactly as the myFPG "Novo Cartão Jogo" form asks for it, with
// copy buttons, and send the player to myFPG to submit it themselves.
// The "registered" tick is a per-device reminder only (localStorage).
import { useEffect, useRef, useState } from "react";
import { Copy, Check, ExternalLink, ClipboardList, CircleCheck, Wand2, Bookmark } from "lucide-react";
import { FPG_BOOKMARKLET, fpgPayload } from "@/lib/fpgBookmarklet";

export const FPG_NEW_CARD_URL = "https://my.fpg.pt/Home/SingleScoreRegister.aspx?PP=0";
const KEY = (id) => `gpf.fpg.${id}`;

export function fpgRegistered(id) {
  if (!id) return false;
  try { return localStorage.getItem(KEY(id)) === "1"; } catch { return false; }
}
function setFpgRegistered(id, on) {
  try { on ? localStorage.setItem(KEY(id), "1") : localStorage.removeItem(KEY(id)); } catch { /* private mode */ }
}

const ptDate = (d) => { const s = String(d || "").slice(0, 10); const [y, m, day] = s.split("-"); return y && m && day ? `${day}/${m}/${y}` : s; };
const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    // iOS in-app browsers sometimes block the async clipboard
    const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove(); return ok;
  }
}

function CopyBtn({ text, label }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="icon-btn fpg-copy" title={`Copy ${label}`} aria-label={`Copy ${label}`}
      onClick={async () => { if (await copyText(String(text))) { setOk(true); setTimeout(() => setOk(false), 1400); } }}>
      {ok ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// round: { id, date, gross, course:{name}, tee:{name, rating, slope, par}, scorecard:{holes}, partner:{name} }
export default function FpgCard({ round, onChange }) {
  const [done, setDone] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedFill, setCopiedFill] = useState(false);
  useEffect(() => { setDone(fpgRegistered(round.id)); }, [round.id]);

  const holes = round.scorecard?.holes?.length === 18 ? round.scorecard.holes.map(Number) : null;
  const tee = round.tee || {};
  const teeLine = [tee.name, tee.rating != null ? `CR ${tee.rating}` : null, tee.slope != null ? `Slope ${tee.slope}` : null].filter(Boolean).join(" · ");
  const rows = [
    ["Data", ptDate(round.date), "date"],
    ["Campo", round.course?.name || "—", "course"],
    ["Marcas", teeLine || "—", "tee"],
    ["Marcador", round.partner?.name ? `${round.partner.name}${round.partner.fpgNumber ? ` · nº ${round.partner.fpgNumber}` : ""}` : "—", "marker"],
    ["Pancadas (gross)", String(round.gross), "gross"],
  ];

  const allText = [
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(holes ? [
      `Buracos 1–9: ${holes.slice(0, 9).join(" ")} (OUT ${sum(holes.slice(0, 9))})`,
      `Buracos 10–18: ${holes.slice(9).join(" ")} (IN ${sum(holes.slice(9))})`,
    ] : []),
  ].join("\n");

  const toggle = () => { const v = !done; setFpgRegistered(round.id, v); setDone(v); onChange?.(v); };

  return (
    <div className="fpg-card">
      <div className="fpg-head">
        <ClipboardList size={16} />
        <div style={{ flex: 1 }}>
          <div className="row-title">Register on myFPG</div>
          <div className="muted small">Copy for autofill, open myFPG, tap the GPF → FPG bookmark. You check and press Save.</div>
        </div>
      </div>

      <div className="fpg-rows">
        {rows.map(([k, v, id]) => (
          <div key={id} className="fpg-row">
            <span className="muted small">{k}</span>
            <span className="fpg-val">{v}</span>
            {v !== "—" ? <CopyBtn text={v} label={k} /> : <span />}
          </div>
        ))}
      </div>

      {holes ? (
        <div className="fpg-holes">
          {[0, 9].map((start) => (
            <div key={start} className="fpg-nine">
              {holes.slice(start, start + 9).map((h, i) => (
                <div key={i} className="fpg-h"><span className="hole-no">{start + i + 1}</span><b>{h}</b></div>
              ))}
              <div className="fpg-h fpg-tot"><span className="hole-no">{start ? "IN" : "OUT"}</span><b>{sum(holes.slice(start, start + 9))}</b></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="warn-strip">No hole-by-hole scores on this round. myFPG needs strokes per hole — add them by editing the round first.</div>
      )}

      <div className="btn-row" style={{ justifyContent: "flex-start" }}>
        <button type="button" className="btn btn-primary small-btn" disabled={!holes}
          onClick={async () => { if (await copyText(fpgPayload(round))) { setCopiedFill(true); setTimeout(() => setCopiedFill(false), 2500); } }}>
          {copiedFill ? <Check size={14} /> : <Wand2 size={14} />} {copiedFill ? "Copied — now use GPF → FPG" : "Copy for autofill"}
        </button>
        <button type="button" className="btn btn-ghost small-btn"
          onClick={async () => { if (await copyText(allText)) { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 1600); } }}>
          {copiedAll ? <Check size={14} /> : <Copy size={14} />} {copiedAll ? "Copied" : "Copy all"}
        </button>
        <a className="btn btn-ghost small-btn" href={FPG_NEW_CARD_URL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} /> Open myFPG
        </a>
      </div>

      <BookmarkletHelp />

      <label className="fpg-done">
        <input type="checkbox" checked={done} onChange={toggle} />
        <span>I've registered this card on myFPG</span>
        {done && <CircleCheck size={14} />}
      </label>
      <div className="hint" style={{ margin: 0 }}>You log in to myFPG with your own federation number — GPF never sees that password. Your marker validates the card on the FPG side as usual.</div>
    </div>
  );
}

// One-time setup: the "GPF → FPG" bookmark. React refuses javascript: hrefs in
// JSX, so the href is set on the DOM node after mount.
function BookmarkletHelp() {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { ref.current?.setAttribute("href", FPG_BOOKMARKLET); }, []);
  return (
    <details className="more fpg-setup">
      <summary><Bookmark size={13} /> Set up the GPF → FPG bookmark (once)</summary>
      <div className="stack" style={{ gap: 8, marginTop: 8 }}>
        <div className="small"><b>Computer:</b> drag this button to your bookmarks bar →{" "}
          <a ref={ref} className="btn btn-ghost small-btn fpg-bm" onClick={(e) => { e.preventDefault(); alert("Drag this to your bookmarks bar, then use it on the myFPG page."); }}>GPF → FPG</a></div>
        <div className="small"><b>iPhone (Safari):</b> bookmark any page, then Edit bookmark → name it "GPF → FPG" and replace the address with the code copied here:{" "}
          <button type="button" className="link" onClick={async () => { if (await copyText(FPG_BOOKMARKLET)) { setCopied(true); setTimeout(() => setCopied(false), 1600); } }}>{copied ? "copied" : "copy bookmark code"}</button></div>
        <div className="hint" style={{ margin: 0 }}>How it works: on myFPG's new game card tap the bookmark — it fills date, course and tee, 18 holes and "HCP round". Press Save. On the next page tap it again — it fills the 18 scores and your marker's federation number. Validate the marker and press Save/Recalc. It never submits anything by itself, and runs only in your browser.</div>
      </div>
    </details>
  );
}
