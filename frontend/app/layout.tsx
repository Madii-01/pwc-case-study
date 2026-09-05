import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lease Extraction Console",
  description: "Submit raw lease text and browse extracted contract records.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line">
          <nav className="mx-auto flex max-w-4xl items-center gap-8 px-6 py-4">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Lease<span className="text-accent">Extract</span>
            </Link>
            <div className="flex gap-6 text-sm text-muted">
              <Link href="/" className="transition-colors hover:text-ink">
                Extract
              </Link>
              <Link href="/contracts" className="transition-colors hover:text-ink">
                Contracts
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
