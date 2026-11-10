"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Pencil, Trash2, Check, Truck, X, ImagePlus, Eye, EyeOff, Save } from "lucide-react";
import { api } from "@/lib/client";
import { euro, STATUS_LABEL, statusBadge, resizeImage } from "@/lib/shopClient";

const FILTERS = [["open", "To handle"], ["all", "All"], ["PENDING", "Awaiting payment"], ["SENT", "Payment sent"], ["PAID", "Paid"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"]];

export default function AdminShop() {
  const [sub, setSub] = useState("orders");
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState(null);
  const [settings, setSettings] = useState(null);
  const load = useCallback(() => {
    Promise.all([api("/api/shop/orders?all=1"), api("/api/shop/products?all=1"), api("/api/shop/settings")])
      .then(([o, p, s]) => { setOrders(o.orders); setProducts(p.products); setSettings(s.settings); }).catch((e) => alert(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  if (!orders) return <div className="loading"><Loader2 className="spin" size={20} /> Loading shop…</div>;
  const toHandle = orders.filter((o) => ["PENDING", "SENT", "PAID"].includes(o.status)).length;

  return (
    <div className="stack">
      <div className="adm-tabs">
        {[["orders", "Orders"], ["products", "Products"], ["payment", "Payment & settings"]].map(([k, l]) => (
          <button key={k} className={sub === k ? "adm-on" : ""} onClick={() => setSub(k)}>{l}{k === "orders" && toHandle ? <span className="pill">{toHandle}</span> : null}</button>))}
      </div>
      {sub === "orders" && <Orders orders={orders} reload={load} />}
      {sub === "products" && <Products products={products} reload={load} />}
      {sub === "payment" && <Settings settings={settings} reload={load} />}
    </div>
  );
}

function Orders({ orders, reload }) {
  const [f, setF] = useState("open");
  const list = orders.filter((o) => f === "all" ? true : f === "open" ? ["PENDING", "SENT", "PAID"].includes(o.status) : o.status === f);
  const toReceive = orders.filter((o) => ["PENDING", "SENT"].includes(o.status)).reduce((t, o) => t + o.totalCents, 0);
  const received = orders.filter((o) => ["PAID", "DELIVERED"].includes(o.status)).reduce((t, o) => t + o.totalCents, 0);
  const setStatus = async (o, status) => {
    if (status === "CANCELLED" && !confirm(`Cancel ${o.ref}? Stock goes back on sale.`)) return;
    try { await api(`/api/shop/orders/${o.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); reload(); } catch (e) { alert(e.message); }
  };
  return (<>
    <div className="grid2">
      <div className="card stat"><div className="muted small">To receive</div><div className="hcp-big sm num">{euro(toReceive)}</div></div>
      <div className="card stat"><div className="muted small">Received</div><div className="hcp-big sm num">{euro(received)}</div></div>
    </div>
    <select className="input" value={f} onChange={(e) => setF(e.target.value)} style={{ maxWidth: 260 }}>{FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    {list.length === 0 && <div className="card empty">No orders here.</div>}
    {list.map((o) => (
      <div key={o.id} className="card approve-card">
        <div>
          <div className="row-title">{o.ref} · {o.buyerName} · <span className="num">{euro(o.totalCents)}</span> <span className={`badge ${statusBadge(o.status)}`}>{STATUS_LABEL[o.status]}</span></div>
          <div className="muted small">{new Date(o.createdAt).toLocaleString("pt-PT")} · {o.method === "MBWAY" ? "MB WAY" : "Revolut"} · {o.buyerEmail}</div>
          <div className="small" style={{ marginTop: 6 }}>{o.items.map((i) => `${i.qty}× ${i.name}${i.size ? ` (${i.size})` : ""}`).join(" · ")}</div>
          {o.note && <div className="muted small" style={{ marginTop: 4 }}>Note: {o.note}</div>}
        </div>
        <div className="btn-row">
          {["PENDING", "SENT"].includes(o.status) && <button className="btn btn-primary small-btn" onClick={() => setStatus(o, "PAID")}><Check size={14} /> Payment received</button>}
          {o.status === "PAID" && <button className="btn btn-primary small-btn" onClick={() => setStatus(o, "DELIVERED")}><Truck size={14} /> Delivered</button>}
          {o.status !== "CANCELLED" && o.status !== "DELIVERED" && <button className="btn btn-ghost small-btn" onClick={() => setStatus(o, "CANCELLED")}><X size={14} /> Cancel</button>}
          {(o.status === "CANCELLED" || o.status === "DELIVERED") && <button className="btn btn-ghost small-btn" onClick={() => setStatus(o, "PENDING")}>Reopen</button>}
        </div>
      </div>))}
  </>);
}

const EMPTY = { name: "", price: "", description: "", sizes: "", stock: "", sort: 0, active: true, image: null };

function Products({ products, reload }) {
  const [edit, setEdit] = useState(null); // product being edited, or EMPTY for new
  if (edit) return <ProductForm initial={edit} onDone={() => { setEdit(null); reload(); }} />;
  const toggle = async (p) => { await api(`/api/shop/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) }); reload(); };
  const del = async (p) => { if (!confirm(`Delete ${p.name}? Past orders keep their details.`)) return; await api(`/api/shop/products/${p.id}`, { method: "DELETE" }); reload(); };
  return (<>
    <div className="btn-row" style={{ justifyContent: "flex-start" }}><button className="btn btn-primary" onClick={() => setEdit(EMPTY)}><Plus size={15} /> New product</button></div>
    <p className="muted small">Only products marked <b>on sale</b> appear in the shop. Leave stock empty for unlimited.</p>
    {products.length === 0 && <div className="card empty">No products yet.</div>}
    {products.map((p) => (
      <div key={p.id} className="card row-card">
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <div className="adm-thumb">{p.image ? <img src={p.image} alt="" /> : <ImagePlus size={18} />}</div>
          <div style={{ minWidth: 0 }}>
            <div className="row-title">{p.name} <span className={`badge ${p.active ? "badge-ok" : "badge-warn"}`}>{p.active ? "on sale" : "hidden"}</span></div>
            <div className="muted small">{euro(p.priceCents)}{p.sizes.length ? ` · ${p.sizes.join(", ")}` : ""} · stock {p.stock == null ? "∞" : p.stock}</div>
          </div>
        </div>
        <div className="row-right">
          <button className="icon-btn" title={p.active ? "Hide" : "Put on sale"} onClick={() => toggle(p)}>{p.active ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          <button className="icon-btn" title="Edit" onClick={() => setEdit({ ...p, price: (p.priceCents / 100).toFixed(2), sizes: p.sizes.join(", "), stock: p.stock ?? "" })}><Pencil size={15} /></button>
          <button className="icon-btn" title="Delete" onClick={() => del(p)}><Trash2 size={15} /></button>
        </div>
      </div>))}
  </>);
}

function ProductForm({ initial, onDone }) {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const pickImage = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { setF({ ...f, image: await resizeImage(file), imageChanged: true }); } catch (x) { setErr(x.message); }
  };
  const save = async () => {
    setBusy(true); setErr("");
    const body = { name: f.name, price: f.price, description: f.description, sizes: f.sizes, stock: f.stock, sort: f.sort, active: f.active };
    if (f.imageChanged || !f.id) body.image = f.image;
    try {
      if (f.id) await api(`/api/shop/products/${f.id}`, { method: "PATCH", body: JSON.stringify(body) });
      else await api("/api/shop/products", { method: "POST", body: JSON.stringify(body) });
      onDone();
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="card form">
      <div className="row-title">{f.id ? `Edit ${initial.name}` : "New product"}</div>
      <div className="prod-photo">
        <div className="adm-thumb big">{f.image ? <img src={f.image} alt="" /> : <ImagePlus size={26} />}</div>
        <label className="btn btn-ghost small-btn" style={{ cursor: "pointer" }}><ImagePlus size={14} /> {f.image ? "Change photo" : "Add photo"}<input type="file" accept="image/*" hidden onChange={pickImage} /></label>
        {f.image && <button className="link" onClick={() => setF({ ...f, image: null, imageChanged: true })}>Remove</button>}
      </div>
      <label className="field"><span className="label">Name</span><input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Polo GPF" /></label>
      <div className="grid2">
        <label className="field"><span className="label">Price (€)</span><input className="input" inputMode="decimal" value={f.price} onChange={set("price")} placeholder="45,00" /></label>
        <label className="field"><span className="label">Stock</span><input className="input" inputMode="numeric" value={f.stock} onChange={set("stock")} placeholder="Unlimited" /></label>
      </div>
      <label className="field"><span className="label">Sizes</span><input className="input" value={f.sizes} onChange={set("sizes")} placeholder="S, M, L, XL (leave empty if none)" /></label>
      <label className="field"><span className="label">Description</span><textarea className="input" rows={3} value={f.description} onChange={set("description")} /></label>
      <div className="grid2">
        <label className="field"><span className="label">Order in shop</span><input className="input" type="number" value={f.sort} onChange={set("sort")} /></label>
        <label className="field" style={{ justifyContent: "flex-end" }}><span className="label" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={!!f.active} onChange={set("active")} /> On sale</span></label>
      </div>
      {err && <div className="inline-err">{err}</div>}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onDone} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : <Save size={15} />} Save</button>
      </div>
    </div>);
}

function Settings({ settings, reload }) {
  const [f, setF] = useState(settings);
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => { setSaved(false); setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target.checked ? "1" : "0") : e.target.value }); };
  const save = async () => {
    await api("/api/shop/settings", { method: "PATCH", body: JSON.stringify({ mbwayPhone: f.mbwayPhone, mbwayName: f.mbwayName, revolutTag: f.revolutTag, payNote: f.payNote, shopOpen: f.shopOpen }) });
    setSaved(true); reload();
  };
  return (
    <div className="card form">
      <p className="muted small" style={{ margin: 0 }}>Members see these details after placing an order, with the order reference to include in the payment. Only methods with details filled in are offered at checkout.</p>
      <div className="grid2">
        <label className="field"><span className="label">MB WAY number</span><input className="input" inputMode="tel" value={f.mbwayPhone} onChange={set("mbwayPhone")} placeholder="+351 912 345 678" /></label>
        <label className="field"><span className="label">MB WAY name shown</span><input className="input" value={f.mbwayName} onChange={set("mbwayName")} placeholder="e.g. Joaquim (GPF)" /></label>
      </div>
      <label className="field"><span className="label">Revolut @username or revolut.me link</span><input className="input" value={f.revolutTag} onChange={set("revolutTag")} placeholder="@gpfgolf or https://revolut.me/gpfgolf" /></label>
      <label className="field"><span className="label">Extra note for members (optional)</span><textarea className="input" rows={2} value={f.payNote} onChange={set("payNote")} placeholder="e.g. Orders are handed over at the next GPF round." /></label>
      <label className="field"><span className="label" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.shopOpen !== "0"} onChange={set("shopOpen")} /> Shop open for new orders</span></label>
      <div className="btn-row">{saved && <span className="muted small" style={{ alignSelf: "center" }}>Saved</span>}<button className="btn btn-primary" onClick={save}><Save size={15} /> Save</button></div>
    </div>);
}
