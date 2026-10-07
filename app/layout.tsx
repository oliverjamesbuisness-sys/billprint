import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BillPrint: your home's carbon footprint from one bill",
  description: "Upload a utility bill photo or PDF. Get your CO2 footprint, with cited EPA factors, and 3 ways to cut it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-page font-sans text-ink">{children}</body>
    </html>
  );
}
