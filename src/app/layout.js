import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// next/font/google downloads fonts at BUILD TIME to Vercel's CDN.
// The browser never makes a request to fonts.googleapis.com or fonts.gstatic.com,
// which eliminates the GDPR / IP-transfer issue from loading Google Fonts externally.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://gpf.golf"),
  title: "Golf P'la Fresquinha",
  description: "Golf P'la Fresquinha — Rank, the GPF Open, games and the members' shop.",
  applicationName: "GPF",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,          // iOS: launch full-screen from the home screen
    title: "GPF",
    statusBarStyle: "default", // light status bar, matches the light header
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf7",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt" className={inter.variable}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
