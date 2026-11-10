"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, Minus, Plus, Trash2, Loader2, AlertCircle, ChevronRight, Lock } from "lucide-react";
import { api } from "@/lib/client";
import { euro, STATUS_LABEL, statusBadge } from "@/lib/shopClient";

const BAG_KEY = "gpf.bag.v1";
const readBag = () => { try { return JSON.parse(localStorage.getItem(BAG_KEY) || "[]"); } catch { return []; } };
const writeBag = (b) => { try { localStorage.setItem(BAG_KEY, JSON.stringify(b)); } catch {} };

export default function Shop() {
  const router = useRouter();
  const [products, setProducts] = useState(null);
  const [settings, setSettings] = useState(null);
  const [orders, setOrders] = useState([]);
  const [bag, setBag] = useState([]);
  const [pick, setPick] = useState({}); // productId -> { size, qty }
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBag(readBag());
    Promise.all([api("/api/shop/products"), api("/api/shop/settings"), api("/api/shop/orders")])
      .then(([p, s, o]) => { setProducts(p.products); setSettings(s.settings); setOrders(o.orders); })
      .catch((e) => setErr(e.message));
  }, []);

  const byId = useMemo(() => Object.fromEntries((products || []).map((p) => [p.id, p])), [products]);
  // Drop lines whose product is no longer on sale.
  const lines = bag.filter((l) => byId[l.productId]);
  const total = lines.reduce((t, l) => t + byId[l.productId].priceCents * l.qty, 0);
  const setBagSave = (b) => { setBag(b); writeBag(b); };

  const add = (p) => {
    const sel = pick[p.id] || {};
    const size = p.sizes.length ? sel.size : "";
    if (p.sizes.length && !size) { setErr(`Choose a size for ${p.name}`); return; }
    setErr("");
    const qty = sel.qty || 1;
    const i = bag.findIndex((l) => l.productId === p.id && l.size === size);
    const next = [...bag];
    if (i >= 0) next[i] = { ...next[i], qty: Math.min(20, next[i].qty + qty) }; else next.push({ productId: p.id, size, qty });
    setBagSave(next);
  };
  const changeQty = (idx, d) => {
    const next = [...lines]; const q = next[idx].qty + d;
    if (q < 1) next.splice(idx, 1); else next[idx] = { ...next[idx], qty: Math.min(20, q) };
    setBagSave(next);
  };

  const methods = settings ? [
    ["MBWAY", "MB WAY", settings.mbwayPhone],
    ["REVOLUT", "Revolut", settings.revolutTag],
  ].filter(([, , configured]) => configured) : [];
  const allMethods = methods.length ? methods : [["MBWAY", "MB WAY"], ["REVOLUT", "Revolut"]];

  const placeOrder = async () => {
    setErr("");
    if (!method) { setErr("Choose how you want to pay"); return; }
    setBusy(true);
    try {
      const r = await api("/api/shop/orders", { method: "POST", body: JSON.stringify({ items: lines, method, note }) });
      setBagSave([]);
      router.push(`/shop/orders/${r.order.id}`);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  if (!products) return <div className="loading">{err ? <><AlertCircle size={18} /> {err}</> : <><Loader2 className="spin" size={22} /> Loading…</>}</div>;
  const closed = settings?.shopOpen === "0";

  return (
    <div className="stack">
      <div>
        <h1 className="page-h">Shop</h1>
        <div className="muted small" style={{ display: "flex", alignItems: "center", gap: 5 }}><Lock size={12} /> GPF gear, for members only. Pay by MB WAY or Revolut.</div>
      </div>

      {closed && <div className="warn-strip"><AlertCircle size={14} /> The shop is closed for now. You can still see your orders below.</div>}

      {products.length === 0 && <div className="card empty">No products yet. Check back soon.</div>}

      <div className="shop-grid">
        {products.map((p) => {
          const sel = pick[p.id] || {};
          const soldOut = p.stock != null && p.stock <= 0;
          return (
            <div key={p.id} className="card shop-card">
              <div className="shop-img">{p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <ShoppingBag size={36} />}</div>
              <div className="shop-body">
                <div className="shop-top"><b className="shop-name">{p.name}</b><span className="shop-price num">{euro(p.priceCents)}</span></div>
                {p.description && <p className="muted small shop-desc">{p.description}</p>}
                {p.sizes.length > 0 && (
                  <div className="shop-sizes">{p.sizes.map((s) => (
                    <button key={s} className={`shop-size ${sel.size === s ? "on" : ""}`} onClick={() => setPick({ ...pick, [p.id]: { ...sel, size: s } })}>{s}</button>))}
                  </div>)}
                {p.stock != null && p.stock > 0 && p.stock <= 5 && <div className="hint">Only {p.stock} left</div>}
                <div className="shop-actions">
                  <div className="qty">
                    <button aria-label="Less" onClick={() => setPick({ ...pick, [p.id]: { ...sel, qty: Math.max(1, (sel.qty || 1) - 1) } })}><Minus size={14} /></button>
                    <span className="num">{sel.qty || 1}</span>
                    <button aria-label="More" onClick={() => setPick({ ...pick, [p.id]: { ...sel, qty: Math.min(20, (sel.qty || 1) + 1) } })}><Plus size={14} /></button>
                  </div>
                  <button className="btn btn-primary small-btn" disabled={soldOut || closed} onClick={() => add(p)}>{soldOut ? "Sold out" : "Add to bag"}</button>
                </div>
              </div>
            </div>);
        })}
      </div>

      {lines.length > 0 && (
        <div className="card shop-bag" id="bag">
          <div className="sec-h" style={{ marginTop: 0 }}><ShoppingBag size={15} /> Your bag</div>
          {lines.map((l, i) => {
            const p = byId[l.productId];
            return (
              <div key={`${l.productId}-${l.size}`} className="bag-line">
                <div><div className="row-title">{p.name}{l.size && <span className="muted"> · {l.size}</span>}</div><div className="muted small">{euro(p.priceCents)} each</div></div>
                <div className="bag-right">
                  <div className="qty">
                    <button aria-label="Less" onClick={() => changeQty(i, -1)}>{l.qty === 1 ? <Trash2 size={13} /> : <Minus size={14} />}</button>
                    <span className="num">{l.qty}</span>
                    <button aria-label="More" onClick={() => changeQty(i, 1)}><Plus size={14} /></button>
                  </div>
                  <b className="num bag-sum">{euro(p.priceCents * l.qty)}</b>
                </div>
              </div>);
          })}
          <div className="bag-total"><span>Total</span><b className="num">{euro(total)}</b></div>

          <div className="field"><span className="label">How will you pay?</span>
            <div className="pay-opts">{allMethods.map(([k, l]) => (
              <button key={k} className={`pay-opt ${method === k ? "on" : ""}`} onClick={() => setMethod(k)}>
                <b>{l}</b><span className="muted small">{k === "MBWAY" ? "Send from your banking app" : "Pay with your Revolut app"}</span>
              </button>))}
            </div>
          </div>
          <label className="field"><span className="label">Note (optional)</span>
            <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I'll collect it at the next round" /></label>
          {err && <div className="inline-err"><AlertCircle size={15} /> {err}</div>}
          <button className="btn btn-primary full" disabled={busy || closed} onClick={placeOrder}>{busy ? <Loader2 className="spin" size={16} /> : `Place order · ${euro(total)}`}</button>
          <p className="hint center">After placing the order you'll see the payment details and a reference to include.</p>
        </div>)}
      {lines.length === 0 && err && <div className="inline-err"><AlertCircle size={15} /> {err}</div>}

      {orders.length > 0 && (<>
        <div className="sec-h">Your orders</div>
        {orders.map((o) => (
          <Link key={o.id} href={`/shop/orders/${o.id}`} className="card row-card">
            <div><div className="row-title">{o.ref} · {o.items.reduce((t, i) => t + i.qty, 0)} item(s)</div><div className="muted small">{o.createdAt.slice(0, 10)} · {o.method === "MBWAY" ? "MB WAY" : "Revolut"}</div></div>
            <div className="row-right"><b className="num">{euro(o.totalCents)}</b><span className={`badge ${statusBadge(o.status)}`}>{STATUS_LABEL[o.status]}</span><ChevronRight size={16} className="muted" /></div>
          </Link>))}
      </>)}
    </div>
  );
}
