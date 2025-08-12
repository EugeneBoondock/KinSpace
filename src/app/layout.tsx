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
  title: "KinSpace",
  description: "Connect, support, and thrive with KinSpace.",
  metadataBase: new URL('https://kin-space-jade.vercel.app'),
  icons: {
    icon: '/images/gather_logo.png',
    shortcut: '/images/gather_logo.png',
    apple: '/images/gather_logo.png',
  },
  openGraph: {
    title: 'KinSpace',
    description: 'Connect, support, and thrive with KinSpace.',
    url: 'https://kin-space-jade.vercel.app',
    siteName: 'KinSpace',
    images: [
      {
        url: '/images/gather_logo1.png',
        width: 800,
        height: 600,
        alt: 'KinSpace Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KinSpace',
    description: 'Connect, support, and thrive with KinSpace.',
    images: ['/images/gather_logo1.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${notoSans.variable}`}>
      <head>
        <link rel="icon" href="/images/gather_logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/gather_logo.png" />
        <link rel="shortcut icon" href="/images/gather_logo.png" type="image/png" />
        <link href="https://cdn.jsdelivr.net/npm/remixicon@4.3.0/fonts/remixicon.css" rel="stylesheet" />
      </head>

      <body className={`${manrope.className} bg-brand-primary text-brand-background`}>
        <ResponsiveNavbar />
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
