import type { Metadata } from "next";
import { Manrope, Noto_Sans } from 'next/font/google';
import "./globals.css";
import Layout from "@/components/Layout";
import ResponsiveNavbar from "@/components/ResponsiveNavbar";

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-noto-sans',
});

export const metadata: Metadata = {
  title: "the Gathering",
  description: "Connect, support, and thrive with the Gathering.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${notoSans.variable}`}>
      <body className={`${manrope.className} bg-brand-primary text-brand-background`}>
        <ResponsiveNavbar />
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
