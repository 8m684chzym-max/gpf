// myFPG (logged-in area) client — server-side only. Used to import members'
// official rounds (date, course, gross, Stableford) for Rank.
//
// Login flow, as the area.my.fpg.pt login page does it:
//   1. POST area.my.fpg.pt/wp-admin/admin-ajax.php  action=myfpg_login&user=…&password=…
//      → JSON { sucess, user_id, auth_token, … }   (sic: "sucess")
//   2. GET  my.fpg.pt/ExternalLandingPage.aspx?loginuser=<user_id>&token=<auth_token>&startpage=comeback
//      → ASP.NET session cookies on my.fpg.pt
//   3. POST my.fpg.pt/Home/PlayerResults.aspx/ResultsLST  { fed_code, pp:"N", … }
//      → jTable JSON with the player's rounds.
// Credentials come from FPG_USER / FPG_PASSWORD (Vercel env, never in the repo).

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const AJAX = "https://area.my.fpg.pt/wp-admin/admin-ajax.php";
const LANDING = "https://my.fpg.pt/ExternalLandingPage.aspx";
const RESULTS = "https://my.fpg.pt/Home/PlayerResults.aspx/ResultsLST";
const timed = (ms = 20000) => AbortSignal.timeout(ms);

export async function openMyFpgSession() {
  const user = process.env.FPG_USER, password = process.env.FPG_PASSWORD;
  if (!user || !password) throw new Error("FPG_USER / FPG_PASSWORD are not set in Vercel.");

  // 1. WordPress AJAX login
  const form = new URLSearchParams({ action: "myfpg_login", user, password });
  const r1 = await fetch(AJAX, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", Origin: "https://area.my.fpg.pt", Referer: "https://area.my.fpg.pt/login/" },
    body: form.toString(),
    signal: timed(),
  });
  if (!r1.ok) throw new Error(`myFPG login returned HTTP ${r1.status}`);
  let login;
  try { login = JSON.parse(await r1.text()); } catch { throw new Error("myFPG login: unexpected response"); }
  if (!(login?.sucess === true || login?.success === true) || !login.user_id || !login.auth_token) {
    throw new Error(`myFPG login refused${login?.message ? `: ${String(login.message).replace(/<[^>]+>/g, "").slice(0, 160)}` : ""}`);
  }

  // 2. Hand the token to my.fpg.pt and keep its session cookies
  const jar = {};
  const keep = (res) => {
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of list) { const kv = c.split(";")[0]; const i = kv.indexOf("="); if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1); }
  };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  let url = `${LANDING}?loginuser=${encodeURIComponent(login.user_id)}&token=${encodeURIComponent(login.auth_token)}&startpage=comeback`;
  for (let hop = 0; hop < 8; hop++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "pt-PT,pt;q=0.9", Cookie: cookie(), Referer: "https://area.my.fpg.pt/" }, redirect: "manual", signal: timed() });
    keep(r);
    const loc = r.headers.get("location");
    await r.text().catch(() => "");
    if (!loc) break;
    url = new URL(loc, url).href;
  }
  if (!Object.keys(jar).length) throw new Error("myFPG: no session after login (the landing page may have changed).");
  const referer = "https://my.fpg.pt/Home/PlayerResults.aspx";

  async function results(fedno, pageSize = 20) {
    const r = await fetch(`${RESULTS}?jtStartIndex=0&jtPageSize=${pageSize}`, {
      method: "POST",
      headers: { "User-Agent": UA, Accept: "application/json, text/javascript, */*; q=0.01", "Content-Type": "application/json; charset=utf-8", "X-Requested-With": "XMLHttpRequest", Origin: "https://my.fpg.pt", Referer: referer, Cookie: cookie() },
      body: JSON.stringify({ fed_code: String(fedno), pp: "N", jtStartIndex: "0", jtPageSize: String(pageSize) }),
      signal: timed(),
    });
    if (!r.ok) throw new Error(`myFPG results HTTP ${r.status}`);
    const json = await r.json();
    const data = json?.d ?? json;
    if (data?.Result !== "OK") throw new Error(data?.Message || "Unexpected myFPG results response");
    return data.Records ?? [];
  }
  return { results };
}

// ---- record helpers (field names as returned by ResultsLST) ----

const num = (v) => {
  if (v == null || v === "") return null;
  const s = String(v).trim().replace(",", ".");
  const n = s.startsWith("+") ? -Number(s.slice(1)) : Number(s);
  return Number.isFinite(n) ? n : null;
};

// "2026-11-14 10:30", "14/11/2026", "14-11-2026", "/Date(1794500000000)/" → "2026-11-14"
export function fpgDate(rec) {
  const raw = rec.score_dateStr ?? rec.score_date ?? rec.date ?? "";
  const s = String(raw);
  const ms = s.match(/\/Date\((\d+)/);
  if (ms) return new Date(Number(ms[1])).toISOString().slice(0, 10);
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function normaliseRecord(rec, fedno) {
  const date = fpgDate(rec);
  const gross = num(rec.gross_total);
  const points = num(rec.calc_stablnet_total);
  const course = (rec.course_description ?? rec.course_name ?? "").toString().trim() || null;
  const id = rec.score_id ?? rec.id_score ?? rec.scorecard_id ?? rec.id ?? null;
  return {
    id: id != null ? `fpg:${id}` : `fpg:${fedno}:${date}:${course}:${gross}`,
    date, gross, points, course,
    holes: num(rec.hole_count),
    differential: num(rec.score_differential),
    qualifying: rec.hcp_qualifying_name ?? null,
    index: num(rec.hcp_index ?? rec.exact_hcp ?? rec.hcp_exact ?? rec.player_hcp ?? rec.handicap),
    playingHcp: num(rec.playing_hcp ?? rec.play_hcp ?? rec.course_hcp ?? rec.hcp_jogo),
    tee: (rec.tee_description ?? rec.tee_name ?? rec.tee ?? "").toString().trim() || null,
    rating: num(rec.course_rating ?? rec.cr),
    slope: num(rec.slope_rating ?? rec.slope),
    par: num(rec.par ?? rec.course_par),
  };
}
