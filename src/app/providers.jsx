"use client";
import { SessionProvider } from "next-auth/react";
import CookieNotice from "@/components/CookieNotice";
export default function Providers({ children }) {
  return (
    <SessionProvider>
      {children}
      <CookieNotice />
    </SessionProvider>
  );
}
