import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OJT Logbook Maker",
  description:
    "AI-powered form filling for your OJT logbook. Paste your daily notes and auto-fill logbook sections — your text, your words, perfectly organized.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-50 text-surface-900 font-[family-name:var(--font-geist-sans)]">
        {children}
      </body>
    </html>
  );
}
