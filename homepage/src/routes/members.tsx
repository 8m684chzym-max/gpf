import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/site-chrome";
import clubhouse from "@/assets/clubhouse.jpg";
import logo from "@/assets/logo.svg";
import { clearIdentity, loadIdentity, signInMember, type MemberIdentity } from "@/lib/member-identity";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/members")({
  head: () => ({
    meta: [
      { title: "Members — GPF Golf" },
      {
        name: "description",
        content:
          "The members' area: a private clubhouse for club life, and a playing area for tee times, scoring, and stats.",
      },
      { property: "og:title", content: "Members — GPF Golf" },
      {
        property: "og:description",
        content: "A private clubhouse and a companion for every round.",
      },
    ],
  }),
  component: MembersLayout,
});

function useMemberAuth() {
  const [identity, setIdentity] = useState<MemberIdentity | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    loadIdentity().then((id) => {
      if (!mounted) return;
      setIdentity(id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        const id = await loadIdentity();
        if (mounted) setIdentity(id);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  const signIn = async (email: string, password: string, displayName: string) => {
    const id = await signInMember(email, password, displayName);
    setIdentity(id);
  };
  const signOut = async () => {
    await clearIdentity();
    setIdentity(null);
  };
  return { identity, ready, signIn, signOut };
}

function MembersLayout() {
  const { identity, ready, signIn, signOut } = useMemberAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onMembersRoot = pathname === "/members" || pathname === "/members/";

  if (!ready) return <PageShell><div className="min-h-[60vh]" /></PageShell>;

  if (!identity)
    return (
      <SignInGate
        onSignIn={async (email, password, name) => {
          await signIn(email, password, name);
          navigate({ to: "/members/clubhouse" });
        }}
      />
    );


  if (onMembersRoot) return <RedirectToClubhouse />;

  return (
    <PageShell>
      <div className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" aria-hidden className="h-6 w-6" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Members
              </div>
              <div className="text-[15px] font-semibold tracking-tight">
                {identity.displayName}
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <TabLink to="/members/clubhouse">Clubhouse</TabLink>
            <TabLink to="/members/playing">Playing</TabLink>
          </nav>
          <button
            onClick={signOut}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
      <Outlet />
    </PageShell>
  );
}

function TabLink({ to, children }: { to: "/members/clubhouse" | "/members/playing"; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "rounded-full px-4 py-1.5 text-[13px] font-medium bg-primary text-primary-foreground" }}
    >
      {children}
    </Link>
  );
}

function RedirectToClubhouse() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/members/clubhouse", replace: true });
  }, [navigate]);
  return <PageShell><div className="min-h-[60vh]" /></PageShell>;
}

function SignInGate({ onSignIn }: { onSignIn: (email: string, password: string, name: string) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);


  return (
    <PageShell>
      <section className="relative isolate overflow-hidden">
        <img
          src={clubhouse}
          alt="Warm clubhouse interior overlooking the course"
          className="absolute inset-0 -z-10 h-[92vh] w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 h-[92vh] bg-gradient-to-b from-background/40 via-background/60 to-background" />
        <div className="mx-auto grid h-[92vh] max-w-6xl grid-cols-1 items-center gap-14 px-6 md:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground/80">
              Membership
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.03] tracking-tight sm:text-6xl">
              The Clubhouse, in your pocket.
            </h1>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-foreground/80">
              Two rooms for members: a private feed and chat for the people
              you play with, and a playing area for tees, scoring, events and
              stats.
            </p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || !email.trim() || !password || busy) return;
              setBusy(true);
              setError(null);
              try { await onSignIn(email.trim(), password, name.trim()); }
              catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed"); }
              finally { setBusy(false); }
            }}
            className="w-full max-w-sm justify-self-end rounded-3xl border border-border/60 bg-card/80 p-8 backdrop-blur-xl"
          >

            <div className="flex items-center gap-2">
              <img src={logo} alt="" aria-hidden className="h-6 w-6" />
              <div className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
                Members Sign In
              </div>
            </div>
            <label className="mt-6 block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">Display name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="How the clubhouse sees you"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none focus:border-foreground/40"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none focus:border-foreground/40"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-[14px] outline-none focus:border-foreground/40"
              />
            </label>
            {error && (
              <p className="mt-3 text-center text-[12px] text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy || !name.trim() || !email.trim() || !password}
              className="mt-6 w-full rounded-full bg-primary py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Opening the doors…" : "Enter the Clubhouse"}
            </button>
            <p className="mt-4 text-center text-[12px] text-muted-foreground">
              New here? We'll create your account automatically.
            </p>

            <p className="mt-4 text-center text-[12px] text-muted-foreground">
              Demo: any email/password lets you in. Your display name is used in chat.
            </p>
          </form>
        </div>
      </section>
    </PageShell>
  );
}
