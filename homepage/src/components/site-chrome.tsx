import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/logo.svg";
import { useCart } from "@/lib/cart";

const nav = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  // Events and Play are hidden for now (see vite.config.ts routeRules).
  { to: "/members", label: "Members" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight" aria-label="GPF">
          <img src={logo} alt="GPF" width={24} height={24} className="h-6 w-6" />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <a href="https://app.gpf.golf" className="text-[13px] text-muted-foreground hover:text-foreground">
            App
          </a>
          <a href="https://tracer.gpf.golf" className="text-[13px] text-muted-foreground hover:text-foreground">
            Tracer
          </a>
          <a
            href="https://app.gpf.golf/login"
            className="hidden text-[13px] text-muted-foreground hover:text-foreground sm:inline"
          >
            Sign in
          </a>
          <BagLink />
        </div>
      </div>
    </header>
  );
}

function BagLink() {
  const { count, hydrated } = useCart();
  return (
    <Link
      to="/cart"
      className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-secondary"
      aria-label={`Bag${hydrated && count > 0 ? ` (${count})` : ""}`}
    >
      <img src={logo} alt="" aria-hidden className="h-3.5 w-3.5 opacity-80" />
      <span>Bag</span>
      {hydrated && count > 0 && (
        <span className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-[18px] text-primary-foreground tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:grid-cols-2 md:grid-cols-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <img src={logo} alt="GPF" width={22} height={22} className="h-[22px] w-[22px]" />
            GPF.golf
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">
            A private clubhouse, a public shop, and a companion for every round.
          </p>
        </div>
        <FooterCol title="Club" links={[["/members", "Membership"]]} />
        <FooterCol title="Shop" links={[["/shop", "All products"], ["/shop", "Apparel"], ["/shop", "Equipment"]]} />
        <FooterCol title="Members" links={[["https://app.gpf.golf", "GPF App"], ["https://tracer.gpf.golf", "Shot Tracer"]]} />
        <FooterCol title="Company" links={[["/", "About"], ["/", "Contact"], ["/", "Press"]]} />
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-2 px-6 py-6 text-[12px] text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} GPF Golf. All rights reserved.</span>
          <span>Handcrafted on the fairway.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-[12px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      <ul className="mt-4 space-y-2">
        {links.map(([href, label]) => (
          <li key={label}>
            <a href={href} className="text-[13px] text-foreground/80 hover:text-foreground">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
