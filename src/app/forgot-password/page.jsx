"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, Loader2, MailCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { api } from "@/lib/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setErr("");
    if (!email.trim()) { setErr("Enter your email."); return; }
    setBusy(true);
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <button className="back-link" onClick={() => router.push("/login")}><ArrowLeft size={16} /> Back</button>
        <Logo size={92} />
        <div className="auth-eyebrow">Golf P'la Fresquinha</div>
        <h1 className="auth-title">Forgot <span>password</span></h1>
      </div>
      <div className="card auth-card">
        {sent ? (
          <div className="success">
            <MailCheck size={36} />
            <h3>Check your email</h3>
            <p className="muted">If that address has a password set, a reset link is on its way. It expires in 1 hour.</p>
            <p className="muted small">No email arriving? Ask the committee — they can reset your password directly from Admin.</p>
            <button className="btn btn-ghost full" onClick={() => router.push("/login")}>Back to login</button>
          </div>
        ) : (
          <>
            <p className="muted small">Enter the email you registered with and we'll send a reset link.</p>
            <label className="field"><span className="label">Email</span><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gpf.golf" /></label>
            {err && <div className="inline-err"><AlertCircle size={15} /> {err}</div>}
            <button className="btn btn-primary full" onClick={submit} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : "Send reset link"}</button>
          </>
        )}
      </div>
    </div>
  );
}
