"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Loader2, AlertCircle, Smartphone, ExternalLink, CircleCheck } from "lucide-react";
import { api } from "@/lib/client";
import { euro, STATUS_LABEL, statusBadge } from "@/lib/shopClient";

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="copy-btn" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} }}>
      {ok ? <Check size={14} /> : <Copy size={14} />}{ok ? "Copied" : "Copy"}
    </button>);
}

export default function Order({ params }) {
  const { id } = use(params);
  const [d, setD] = useState(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const load = () => api(`/api/shop/orders/${id}`).then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action) => {
    if (action === "cancel" && !confirm("Cancel this order?")) return;
    setBusy(true);
    try { await api(`/api/shop/orders/${id}`, { method: "PATCH", body: JSON.stringify({ action }) }); await load(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (!d) return <div className="loading">{err ? <><AlertCircle size={18} /> {err}</> : <><Loader2 className="spin" size={22} /> Loading…</>}</div>;
  const { order: o, pay } = d;
  const amount = euro(o.totalCents);
  const open = o.status === "PENDING" || o.status === "SENT";

  return (
    <div className="stack">
      <Link href="/shop" className="link" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: 0 }}><ArrowLeft size={15} /> Shop</Link>
      <div className="order-head">
        <div><div className="muted small">Order</div><h1 className="page-h tight">{o.ref}</h1></div>
        <span className={`badge ${statusBadge(o.status)}`}>{STATUS_LABEL[o.status]}</span>
      </div>

      {o.status === "PENDING" && (
        <div className="card pay-card">
          <div className="pay-amount"><span className="muted small">Amount to pay</span><b className="num">{amount}</b></div>
          {o.method === "MBWAY" ? (
            pay.mbwayPhone ? (<>
              <div className="pay-step"><Smartphone size={18} /><div>Open your banking app or MB WAY and send <b>{amount}</b> to:</div></div>
              <div className="pay-field"><div><div className="muted small">MB WAY number{pay.mbwayName ? ` · ${pay.mbwayName}` : ""}</div><b className="num pay-big">{pay.mbwayPhone}</b></div><CopyBtn text={pay.mbwayPhone.replace(/\s/g, "")} /></div>
              <div className="pay-field"><div><div className="muted small">In the description, write</div><b className="num pay-big">{o.ref}</b></div><CopyBtn text={o.ref} /></div>
            </>) : <div className="warn-strip"><AlertCircle size={14} /> The committee hasn't set the MB WAY number yet. They'll contact you with the details.</div>
          ) : (
            pay.revolutTag ? (<>
              <div className="pay-step"><Smartphone size={18} /><div>Pay <b>{amount}</b> on Revolut to <b>{pay.revolutTag.startsWith("http") ? "the GPF account" : `@${pay.revolutTag.replace(/^@/, "")}`}</b>, with this reference:</div></div>
              <div className="pay-field"><div><div className="muted small">Reference</div><b className="num pay-big">{o.ref}</b></div><CopyBtn text={o.ref} /></div>
              <a className="btn btn-primary full" href={pay.revolutLink} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open Revolut</a>
            </>) : <div className="warn-strip"><AlertCircle size={14} /> The committee hasn't set the Revolut account yet. They'll contact you with the details.</div>
          )}
          {pay.payNote && <p className="muted small" style={{ margin: 0 }}>{pay.payNote}</p>}
          <button className="btn btn-primary full" disabled={busy} onClick={() => act("sent")}><CircleCheck size={16} /> I've paid</button>
          <p className="hint center">The committee confirms the payment and lets you know when your order is ready.</p>
        </div>)}

      {o.status === "SENT" && <div className="card"><b>Thanks! Payment sent.</b><p className="muted small" style={{ margin: "4px 0 0" }}>The committee will confirm it shortly. Reference {o.ref} · {amount} by {o.method === "MBWAY" ? "MB WAY" : "Revolut"}.</p></div>}
      {o.status === "PAID" && <div className="card"><b>Payment confirmed.</b><p className="muted small" style={{ margin: "4px 0 0" }}>Your order is being prepared. The committee will hand it over.</p></div>}
      {o.status === "DELIVERED" && <div className="card"><b>Delivered.</b><p className="muted small" style={{ margin: "4px 0 0" }}>Enjoy your GPF gear.</p></div>}
      {o.status === "CANCELLED" && <div className="card"><b>This order was cancelled.</b></div>}

      <div className="card">
        {o.items.map((i) => (
          <div key={i.id} className="bag-line">
            <div><div className="row-title">{i.name}{i.size && <span className="muted"> · {i.size}</span>}</div><div className="muted small">{i.qty} × {euro(i.unitCents)}</div></div>
            <b className="num">{euro(i.unitCents * i.qty)}</b>
          </div>))}
        <div className="bag-total"><span>Total</span><b className="num">{amount}</b></div>
        {o.note && <p className="muted small" style={{ margin: "8px 0 0" }}>Note: {o.note}</p>}
        <p className="muted small" style={{ margin: "6px 0 0" }}>Placed {new Date(o.createdAt).toLocaleString("pt-PT")} · {o.method === "MBWAY" ? "MB WAY" : "Revolut"}</p>
      </div>

      {err && <div className="inline-err"><AlertCircle size={15} /> {err}</div>}
      {open && <button className="btn btn-ghost" disabled={busy} onClick={() => act("cancel")}>Cancel order</button>}
    </div>
  );
}
