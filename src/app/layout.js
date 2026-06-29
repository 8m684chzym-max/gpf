import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Golf P'la Fresquinha",
  description: "Road to GPF Weekend — the friends' golf competition.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
