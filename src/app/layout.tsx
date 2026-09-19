import type { Metadata } from "next";
import { Geist, Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spruce & Co — Back Office",
  description: "Projects, capital and finance for Spruce & Co — Construction & Interior Design",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${playfair.variable} ${dmSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
