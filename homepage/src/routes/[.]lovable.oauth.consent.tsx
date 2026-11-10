import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/site-chrome";
import logo from "@/assets/logo.svg";
import { supabase } from "@/integrations/supabase/client";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = {
  data: AuthorizationDetails | null;
  error: { message: string } | null;
};
const authOAuth = () =>
  (supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
      approveAuthorization: (id: string) => Promise<OAuthResult>;
      denyAuthorization: (id: string) => Promise<OAuthResult>;
    };
  }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await authOAuth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <PageShell>
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Couldn't load this authorization</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </main>
    </PageShell>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await authOAuth().approveAuthorization(authorization_id)
      : await authOAuth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <PageShell>
      <main className="mx-auto max-w-md px-6 py-20">
        <div className="mb-8 flex items-center gap-2">
          <img src={logo} alt="" aria-hidden className="h-7 w-7" />
          <div className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground">
            GPF · Connect an app
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Connect {clientName} to your GPF account
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground">
          This lets {clientName} use GPF Golf tools as you while you are signed in.
          It does not bypass this app's permissions or backend policies.
        </p>

        {scopes.length > 0 && (
          <ul className="mt-6 space-y-2 rounded-2xl border border-border bg-card p-4 text-[13px]">
            {scopes.map((s: string) => (
              <li key={s} className="text-muted-foreground">
                Requested permission: <span className="text-foreground">{s}</span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-red-600">
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="w-full rounded-full bg-primary py-3 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="w-full rounded-full border border-border bg-background py-3 text-[14px] font-medium transition-colors hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </main>
    </PageShell>
  );
}
