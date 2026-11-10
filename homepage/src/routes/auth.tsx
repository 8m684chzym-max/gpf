import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site-chrome";
import logo from "@/assets/logo.svg";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — GPF Golf" },
      { name: "description", content: "Sign in to your GPF Golf member account." },
      { property: "og:title", content: "Sign in — GPF Golf" },
      { property: "og:description", content: "Access your GPF Golf account." },
    ],
  }),
  component: AuthPage,
});

function isSafeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//");
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = next && isSafeNext(next) ? next : "/members/clubhouse";

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) window.location.href = target;
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const fn =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}${target}` },
            });
      const { data, error } = await fn;
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        window.location.href = target;
      } else {
        setError("Check your email to confirm your account, then sign in.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${target}` },
    });
    if (error) setError(error.message);
  }

  return (
    <PageShell>
      <section className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-16">
        <div className="mb-8 flex items-center gap-2">
          <img src={logo} alt="" aria-hidden className="h-7 w-7" />
          <div className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            GPF · {mode === "signin" ? "Sign in" : "Create account"}
          </div>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {mode === "signin" ? "Welcome back." : "Join the club."}
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {mode === "signin"
            ? "Sign in to access members-only areas and connected tools."
            : "Create an account to access members-only areas and connected tools."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none focus:border-foreground/40"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none focus:border-foreground/40"
            />
          </label>
          {error && (
            <p role="alert" className="text-[13px] text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={google}
          className="mt-3 w-full rounded-full border border-border bg-background py-3 text-[14px] font-medium transition-colors hover:bg-secondary"
        >
          Continue with Google
        </button>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-center text-[13px] text-muted-foreground hover:text-foreground"
        >
          {mode === "signin"
            ? "No account? Create one."
            : "Already have an account? Sign in."}
        </button>
      </section>
    </PageShell>
  );
}
