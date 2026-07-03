"use client";
export async function api(path, opts) {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...opts });
  let body = null; try { body = await res.json(); } catch { /* csv/no-body */ }
  if (!res.ok) throw new Error(body?.error || "Request failed");
  return body;
}
export const fmtHcp = (v) => (v == null || v === "" ? "—" : Number(v).toFixed(1));
