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
  metadataBase: new URL("https://gpf.golf"),
  title: "Golf P'la Fresquinha",
  description: "Road to GPF Open — the friends' golf competition.",
  applicationName: "GPF",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,          // iOS: launch full-screen from the home screen
    title: "GPF",
    statusBarStyle: "black", // opaque dark status bar, white text
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#113221",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt" className={`${oswald.variable} ${inter.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
