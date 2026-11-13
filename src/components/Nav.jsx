"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, ChevronDown } from "lucide-react";
import { MENU, HOME_URL } from "@/lib/menu";

// Same header as gpf.golf: logo left, quiet text links, blurred sticky bar.
// Groups ({ label, items }, e.g. Tools) open a small drop-down on desktop and
// show as a labelled block in the phone sheet.
export default function Nav() {
  const path = usePathname();
  const { data } = useSession();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(null);
  const navRef = useRef(null);
  const isAdmin = data?.user?.role === "ADMIN";
  useEffect(() => { setOpen(false); setGroup(null); }, [path]);

  // Close the drop-down on outside click or Escape.
  useEffect(() => {
    if (!group) return;
    const onDown = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setGroup(null); };
    const onKey = (e) => { if (e.key === "Escape") setGroup(null); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [group]);

  const isOn = (href) => href.startsWith("/") && (path === href || path.startsWith(href + "/"));
  const items = isAdmin ? [...MENU, ["/admin", "Admin"]] : MENU;
  const link = ([href, label, ext, cta], extra = "") => ext
    ? <a key={label} href={href} className={`nav-a ${extra}`}>{label}</a>
    : <Link key={label} href={href} className={`nav-a ${extra} ${cta ? "nav-cta" : ""} ${isOn(href) ? "nav-on" : ""}`}>{label}</Link>;

  const desktopItem = (item) => {
    if (Array.isArray(item)) return link(item);
    const isOpen = group === item.label;
    return (
      <div key={item.label} className="nav-group">
        <button type="button" className="nav-a nav-btn nav-group-btn" aria-haspopup="true" aria-expanded={isOpen}
          onClick={() => setGroup(isOpen ? null : item.label)}>
          {item.label} <ChevronDown size={13} className={isOpen ? "nav-chev nav-chev-up" : "nav-chev"} />
        </button>
        {isOpen && <div className="nav-pop" role="menu">{item.items.map((i) => link(i, "nav-pop-a"))}</div>}
      </div>
    );
  };
  const sheetItem = (item) => Array.isArray(item) ? link(item) : (
    <div key={item.label} className="nav-sheet-group">
      <div className="nav-sheet-label">{item.label}</div>
      {item.items.map((i) => link(i))}
    </div>
  );

  const auth = data?.user
    ? <button className="nav-a nav-btn" onClick={() => signOut({ redirect: false }).then(() => { window.location.href = HOME_URL; })}>Log out</button>
    : <Link href="/login" className="nav-a">Login</Link>;

  return (
    <header className="topbar">
      <div className="topbar-in">
        <a href={HOME_URL} className="brand" aria-label="GPF home"><img src="/brand/gpf-logo.svg" alt="GPF" width={24} height={24} /></a>
        <nav ref={navRef} className="nav-links" aria-label="Main">{items.map(desktopItem)}{auth}</nav>
        <button className="nav-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {open && <nav className="nav-sheet" aria-label="Main">{items.map(sheetItem)}{auth}</nav>}
    </header>
  );
}
