"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { MENU, HOME_URL } from "@/lib/menu";

// Same header as gpf.golf: logo left, quiet text links, blurred sticky bar.
// Phones get the same links in a drop-down sheet.
export default function Nav() {
  const path = usePathname();
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const isAdmin = data?.user?.role === "ADMIN";
  useEffect(() => setOpen(false), [path]);

  const isOn = (href) => href.startsWith("/") && (path === href || path.startsWith(href + "/"));
  const items = isAdmin ? [...MENU, ["/admin", "Admin"]] : MENU;
  const link = ([href, label, ext]) => ext
    ? <a key={label} href={href} className="nav-a">{label}</a>
    : <Link key={label} href={href} className={`nav-a ${isOn(href) ? "nav-on" : ""}`}>{label}</Link>;
  const auth = data?.user
    ? <button className="nav-a nav-btn" onClick={() => signOut({ redirect: false }).then(() => { window.location.href = HOME_URL; })}>Log out</button>
    : <Link href="/login" className="nav-a">Login</Link>;

  return (
    <header className="topbar">
      <div className="topbar-in">
        <a href={HOME_URL} className="brand" aria-label="GPF home"><img src="/brand/gpf-logo.svg" alt="GPF" width={24} height={24} /></a>
        <nav className="nav-links" aria-label="Main">{items.map(link)}{auth}</nav>
        <button className="nav-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && <nav className="nav-sheet" aria-label="Main">{items.map(link)}{auth}</nav>}
    </header>
  );
}
