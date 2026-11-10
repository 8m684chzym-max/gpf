"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Home, Plus, Trophy, Dices, Shield, User, LogOut, Spline, House, ShoppingBag } from "lucide-react";
import Logo from "./Logo";

export default function Nav() {
  const path = usePathname();
  const { data } = useSession();
  const isAdmin = data?.user?.role === "ADMIN";
  const last = isAdmin ? ["/admin", "Admin", Shield] : ["/profile", "Profile", User];
  const tabs = [["/dashboard", "Home", Home], ["/submit", "Submit", Plus], ["/open", "GPF Open", Trophy], ["/games", "Games", Dices], ["/shop", "Shop", ShoppingBag], last];
  return (
    <>
      <header className="topbar">
        <Link href="/dashboard" className="brand"><Logo size={30} withText={false} /><span>Golf P'la Fresquinha</span></Link>
        <div className="top-right">
          <Link href={last[0]} className="ghost-link"><span className="who">{data?.user?.name}</span></Link>
          <a className="icon-btn" title="GPF.golf (página inicial)" href={process.env.NEXT_PUBLIC_HOME_URL || "https://www.gpf.golf"}><House size={16} /></a>
          <a className="icon-btn" title="Shot Tracer" href={process.env.NEXT_PUBLIC_TRACER_URL || "https://tracer.gpf.golf"}><Spline size={16} /></a>
          <button className="icon-btn" title="Log out" onClick={() => signOut({ callbackUrl: "/login" })}><LogOut size={16} /></button>
        </div>
      </header>
      <nav className="tabbar">
        {tabs.map(([href, label, Icon]) => (
          <Link key={href} href={href} className={`tab ${path === href || path.startsWith(href + "/") ? "tab-on" : ""}`}><Icon size={19} /><span>{label}</span></Link>
        ))}
      </nav>
    </>
  );
}
