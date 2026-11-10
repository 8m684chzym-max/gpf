"use client";
import { useEffect } from "react";
import { signOut } from "next-auth/react";

// Linked from the Shot Tracer's menu (a static page on tracer.gpf.golf).
export default function Logout() {
  useEffect(() => {
    signOut({ redirect: false }).finally(() => { window.location.href = process.env.NEXT_PUBLIC_HOME_URL || "https://gpf.golf"; });
  }, []);
  return <div className="loading">Signing out…</div>;
}
