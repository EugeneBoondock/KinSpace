import type { Metadata } from "next";
import "./globals.css";
import Layout from "@/components/Layout";
import ResponsiveNavbar from "@/components/ResponsiveNavbar";

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
    <html lang="en">
      <body>
        <ResponsiveNavbar />
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
