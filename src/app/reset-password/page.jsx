"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertCircle, Loader2, CircleCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { api } from "@/lib/client";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setErr("");
    if (!token) { setErr("This link is missing its reset token. Request a new one."); return; }
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  if (done) return (
    <div className="success">
      <CircleCheck size={40} />
      <h3>Password updated</h3>
      <p className="muted">You can log in with your new password now.</p>
      <button className="btn btn-primary full" onClick={() => router.push("/login")}>Go to login</button>
    </div>
  );

  return (
    <>
      {!token && <div className="inline-err"><AlertCircle size={15} /> This link is missing a token — open it from the email again, or request a new one.</div>}
      <label className="field"><span className="label">New password</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
      <label className="field"><span className="label">Confirm password</span><input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      {err && <div className="inline-err"><AlertCircle size={15} /> {err}</div>}
      <button className="btn btn-primary full" onClick={submit} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : "Set new password"}</button>
    </>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <button className="back-link" onClick={() => router.push("/login")}><ArrowLeft size={16} /> Back</button>
        <Logo size={92} />
        <div className="auth-eyebrow">Golf P'la Fresquinha</div>
        <h1 className="auth-title">Reset <span>password</span></h1>
      </div>
      <div className="card auth-card">
        <Suspense fallback={<div className="loading"><Loader2 className="spin" size={22} /></div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
