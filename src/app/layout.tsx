import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://freshhaul.app"),
  title: {
    default: "FreshHaul",
    template: "%s | FreshHaul",
  },
  description: "Fresh produce marketplace connecting farmers, buyers, and refrigerated drivers.",
  applicationName: "FreshHaul",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FreshHaul",
  },
  openGraph: {
    title: "FreshHaul",
    description: "Fresh produce marketplace connecting farmers, buyers, and refrigerated drivers.",
    siteName: "FreshHaul",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
};

import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} min-h-screen overflow-x-hidden antialiased`}
      >
        <Providers>
          <div className="mx-auto flex min-h-screen w-full max-w-360 flex-1 flex-col px-4 pb-12 sm:px-6 lg:px-8">
            <Navbar />
            <main className="flex-1 pb-6">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
