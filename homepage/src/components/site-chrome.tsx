import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import logo from "@/assets/logo.svg";
import { useCart } from "@/lib/cart";

// One menu for every GPF surface — keep in sync with the app (src/lib/menu.js)
// and the Shot Tracer (public/tracer/index.html) in the main repo.
const APP = "https://app.gpf.golf";
const menu: [string, string][] = [
  ["/", "Home"],
  [`${APP}/play`, "Play"],
  [`${APP}/open`, "Open"],
  [`${APP}/team-cup`, "Team Cup"],
  [`${APP}/rank`, "Rank"],
  [`${APP}/shop`, "Shop"],
  ["https://tracer.gpf.golf", "Tracer"],
  [`${APP}/profile`, "My profile"],
  [`${APP}/submit`, "Submit score"],
  [`${APP}/login`, "Login"],
];

function MenuLink({ href, label, big = false }: { href: string; label: string; big?: boolean }) {
  const cls = big
    ? "py-2.5 text-[17px] text-foreground"
    : "text-[13px] text-muted-foreground transition-colors hover:text-foreground";
  if (label === "Submit score")
    return (
      <a
        href={href}
        className={
          big
            ? "my-2 rounded-full bg-primary py-2.5 text-center text-[16px] font-medium text-primary-foreground"
            : "rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        }
      >
        {label}
      </a>
    );
  if (href === "/")
    return (
      <Link to="/" className={cls} activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>
        {label}
      </Link>
    );
  return <a href={href} className={cls}>{label}</a>;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center" aria-label="GPF">
          <img src={logo} alt="GPF" width={24} height={24} className="h-6 w-6" />
        </Link>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {menu.map(([href, label]) => <MenuLink key={label} href={href} label={label} />)}
        </nav>
        <button
          type="button"
          className="-mr-2 grid h-9 w-9 place-items-center text-foreground lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden className="text-[20px] leading-none">{open ? "×" : "☰"}</span>
        </button>
      </div>
      {open && (
        <nav className="flex flex-col border-t border-border/60 px-6 pb-4 pt-1 lg:hidden" aria-label="Main">
          {menu.map(([href, label]) => <MenuLink key={label} href={href} label={label} big />)}
        </nav>
      )}
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
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl justify-between gap-2 px-6 py-6 text-[12px] text-muted-foreground">
        <span>© {new Date().getFullYear()} Golf P'la Fresquinha</span>
        <span>gpf.golf</span>
      </div>
    </footer>
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
