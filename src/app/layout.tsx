import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans } from 'next/font/google';
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import ResponsiveNavbar from "@/components/ResponsiveNavbar";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import MedicationShelf from "@/components/MedicationShelf";
import Script from "next/script";

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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2A4A42',
};

export const metadata: Metadata = {
  title: "KinSpace - Your Cozy Corner for Healing",
  description: "Connect, support, and thrive with KinSpace. A community platform for chronic illness, mental health, addiction recovery, grief support and more.",
  metadataBase: new URL('https://www.kinspace.co.za'),
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KinSpace',
  },
  icons: {
    icon: '/images/gather_logo.png',
    shortcut: '/images/gather_logo.png',
    apple: '/images/gather_logo.png',
  },
  openGraph: {
    title: 'KinSpace - Your Cozy Corner for Healing',
    description: 'Connect, support, and thrive with KinSpace.',
    url: 'https://www.kinspace.co.za',
    siteName: 'KinSpace',
    images: [{ url: '/images/gather_logo1.png', width: 800, height: 600, alt: 'KinSpace Logo' }],
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${notoSans.variable}`}>
      <head>
        <link rel="icon" href="/images/gather_logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/gather_logo.png" />
        <link href="https://cdn.jsdelivr.net/npm/remixicon@4.3.0/fonts/remixicon.css" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${manrope.className} bg-brand-canvas text-brand-ink antialiased`}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <ResponsiveNavbar />
              <main className="min-h-screen">{children}</main>
              <MedicationShelf />
              <ServiceWorkerRegistrar />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
        {/* Cloudflare Web Analytics, privacy-first traffic, no cookies. Renders
            only when the beacon token is configured (set NEXT_PUBLIC_CF_BEACON_TOKEN). */}
        {process.env.NEXT_PUBLIC_CF_BEACON_TOKEN && (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={`{"token":"${process.env.NEXT_PUBLIC_CF_BEACON_TOKEN}"}`}
          />
        )}
      </body>
    </html>
  );
}
