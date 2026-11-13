// FPG (Federação Portuguesa de Golfe) handicap lookup — server-side only.
//
// The FPG "Pesquisa de Handicaps" page embeds an iframe from scoring.fpg.pt
// (linkpage.aspx?page=searchfed&club=All&ack=…). Opening that URL walks three
// redirects and leaves an ASP.NET session (cookies ASP.NET_SessionId +
// DG_Lists_URL). With that session, the jTable endpoint
// FederatedSearch.aspx/HandicapsLST returns clean JSON per federation number.
//
// The `ack` key is public (it sits in the portal's HTML) but the FPG may rotate
// it, so we read it from the portal on every run and only fall back to the last
// known value. A browser User-Agent is required — without it the server 500s.

const PORTAL_URL = "https://portal.fpg.pt/handicaps-course-rating/pesquisa-de-handicaps/";
const FALLBACK_ENTRY = "https://scoring.fpg.pt/lists/linkpage.aspx?page=searchfed&club=All&ack=8428ACK987";
const SEARCH_URL = "https://scoring.fpg.pt/lists/FederatedSearch.aspx/HandicapsLST?jtStartIndex=0&jtPageSize=10&jtSorting=name%20ASC";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const TIMEOUT_MS = 15000;

const timed = (ms = TIMEOUT_MS) => AbortSignal.timeout(ms);

// Find the current iframe URL (with its ack) on the FPG portal page.
async function findEntryUrl() {
  try {
    const r = await fetch(PORTAL_URL, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: timed() });
    if (!r.ok) return { url: FALLBACK_ENTRY, fromPortal: false };
    const html = await r.text();
    const m = html.match(/https:\/\/scoring\.fpg\.pt\/lists\/linkpage\.aspx\?[^"'\s<>]*page=searchfed[^"'\s<>]*/i);
    if (!m) return { url: FALLBACK_ENTRY, fromPortal: false };
    return { url: m[0].replace(/&amp;/g, "&"), fromPortal: true };
  } catch {
    return { url: FALLBACK_ENTRY, fromPortal: false };
  }
}

// Open an ASP.NET session on scoring.fpg.pt. Returns a lookup(fedno) function.
export async function openFpgSession() {
  const entry = await findEntryUrl();
  const jar = {};
  const keep = (res) => {
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const kv = c.split(";")[0];
      const i = kv.indexOf("=");
      if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1);
    }
  };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const navHeaders = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-PT,pt;q=0.9",
    Referer: "https://portal.fpg.pt/",
    "Sec-Fetch-Dest": "iframe",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-site",
    "Upgrade-Insecure-Requests": "1",
  };

  let url = entry.url;
  let finalStatus = 0;
  for (let hop = 0; hop < 6; hop++) {
    const r = await fetch(url, { headers: { ...navHeaders, Cookie: cookie() }, redirect: "manual", signal: timed() });
    keep(r);
    finalStatus = r.status;
    const loc = r.headers.get("location");
    await r.text().catch(() => "");
    if (!loc) break;
    url = new URL(loc, url).href;
  }
  if (finalStatus !== 200 || !jar["ASP.NET_SessionId"]) {
    throw new Error(`Could not open an FPG session (status ${finalStatus}, ack ${entry.fromPortal ? "from portal" : "fallback"}). The FPG may have changed the search page.`);
  }
  const referer = url;

  async function lookup(fedno) {
    const num = String(fedno).trim();
    const body = {
      name: "", fedno: num, ClubCode: "0", FedStat: "9", Gender: "", Agelev: "-1", HcpStat: "-1",
      FAge: "0", FHcp: "-99", IniFlag: "0", MaxResults: "10", MessMax: "Too many results",
      Permit: "", ProAm: "0", TAge: "999", THcp: "-99",
      jtPageSize: "10", jtSorting: "name ASC", jtStartIndex: "0",
    };
    const r = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/json; charset=utf-8",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://scoring.fpg.pt",
        Referer: referer,
        Cookie: cookie(),
      },
      body: JSON.stringify(body),
      signal: timed(),
    });
    if (!r.ok) throw new Error(`FPG search returned HTTP ${r.status}`);
    const json = await r.json();
    const data = json?.d ?? json;
    if (data?.Result !== "OK") throw new Error(data?.Message || "Unexpected FPG response");
    const rec = (data.Records || []).find((x) => String(Number(x.federation_code)) === String(Number(num)));
    if (!rec) return null;
    // "18", "17,9", or a plus handicap written "+2.1" (stored as -2.1, the WHS convention).
    const raw = String(rec.hcp_index ?? "").trim().replace(",", ".");
    const idx = raw.startsWith("+") ? -Number(raw.slice(1)) : Number(raw);
    return {
      fedno: String(Number(rec.federation_code)),
      name: rec.name || null,
      club: rec.acronym || rec.club_name || null,
      index: Number.isFinite(idx) && idx < 99 ? idx : null, // FPG uses 99 for "no handicap"
      status: rec.hcp_status || null, // e.g. "Válido", "Sem HCP"
    };
  }

  return { lookup, ackFromPortal: entry.fromPortal };
}
