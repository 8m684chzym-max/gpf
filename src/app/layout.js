import { Oswald, Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// next/font/google downloads fonts at BUILD TIME to Vercel's CDN.
// The browser never makes a request to fonts.googleapis.com or fonts.gstatic.com,
// which eliminates the GDPR / IP-transfer issue from loading Google Fonts externally.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Golf P'la Fresquinha",
  description: "Road to GPF Open — the friends' golf competition.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt" className={`${oswald.variable} ${inter.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
