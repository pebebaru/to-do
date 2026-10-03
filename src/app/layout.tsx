import type { Metadata } from "next";
import localFont from "next/font/local";
import { brand } from "@/lib/brand";
import "./globals.css";
const inter = localFont({
  src: "./fonts/inter.ttf",
  weight: "100 900",
  variable: "--font-body",
  display: "swap",
});
const jakarta = localFont({
  src: "./fonts/jakarta.ttf",
  weight: "200 800",
  variable: "--font-heading",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/mono.ttf",
  weight: "100 800",
  variable: "--font-mono",
  display: "swap",
});
export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
  icons: { icon: brand.icon },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: brand.name },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
