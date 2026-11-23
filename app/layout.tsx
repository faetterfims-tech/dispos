import type { Metadata, Viewport } from "next";
import Link from "next/link";
import RegisterSW from "./RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "dispos", template: "%s · dispos" },
  description: "Daniels værktøjer",
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  // Som app på iPhone: fuld skærm, eget navn under ikonet.
  appleWebApp: { capable: true, title: "dispos", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            dispos
          </Link>
        </header>
        <main className="page">{children}</main>
        <RegisterSW />
      </body>
    </html>
  );
}
