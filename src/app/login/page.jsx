"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import GPFLoginMark from "@/components/GPFLoginMark";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", handicap: "", email: "", password: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const go = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "register") {
        await api("/api/register", { method: "POST", body: JSON.stringify(form) });
      }
      const res = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      if (res?.error) setErr("Email or password is incorrect.");
      else router.push("/dashboard");
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <button className="back-link" onClick={() => router.push("/")}><ArrowLeft size={16} /> Home</button>
        <GPFLoginMark size={140} tagline={false} />
        <div className="auth-eyebrow">Golf P'la Fresquinha</div>
        <h1 className="auth-title">Road to <span>GPF</span></h1>
      </div>
      <div className="card auth-card">
        <div className="seg">
          <button className={mode === "login" ? "seg-on" : ""} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "register" ? "seg-on" : ""} onClick={() => setMode("register")}>Register</button>
        </div>
        {mode === "register" && (
          <>
            <label className="field"><span className="label">Full name</span><input className="input" value={form.name} onChange={set("name")} placeholder="e.g. Lourenco" /></label>
            <label className="field"><span className="label">Handicap index (WHS)</span><input className="input" inputMode="decimal" value={form.handicap} onChange={set("handicap")} placeholder="e.g. 12.5" /></label>
          </>
        )}
        <label className="field"><span className="label">Email</span><input className="input" value={form.email} onChange={set("email")} placeholder="you@gpf.golf" /></label>
        <label className="field"><span className="label">Password</span><input className="input" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" /></label>
        {mode === "login" && <button className="link" type="button" style={{ alignSelf: "flex-end" }} onClick={() => router.push("/forgot-password")}>Forgot password?</button>}
        {err && <div className="inline-err"><AlertCircle size={15} /> {err}</div>}
        {mode === "register" && (
          <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0" }}>
            By creating an account you agree that your name, email and round data will be stored and used to run the competition. Read our{" "}
            <Link href="/privacy" style={{ color: "var(--green-700)", textDecoration: "underline" }}>Privacy Policy</Link>.
          </p>
        )}
        <button className="btn btn-primary full" onClick={go} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : mode === "login" ? "Log in" : "Create account"}</button>
      </div>
    </div>
  );
}
