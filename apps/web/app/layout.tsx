import { PRODUCT_NAME } from "@prabhat/core"
import type { Metadata } from "next"

import { Providers } from "@/components/providers"
import { FeedbackWidget } from "@/components/feedback-widget"
import { AnalyticsTracker } from "@/components/analytics-tracker"
import "./globals.css"

const publicSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.prabhatasamgiita.org"

const manropeStylesheet =
  "https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap"

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  title: PRODUCT_NAME,
  description: "Search lyrics, read meanings, listen from verified sources, and browse curated Prabhat Samgiita resources.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: PRODUCT_NAME,
    description: "Search lyrics, read meanings, listen from verified sources, and browse curated Prabhat Samgiita resources.",
    siteName: PRODUCT_NAME,
    type: "website",
    images: [
      {
        url: "/brand/share-icon.png",
        width: 1024,
        height: 1024,
        alt: PRODUCT_NAME,
      },
      {
        url: "/brand/og-share.png",
        width: 1200,
        height: 630,
        alt: PRODUCT_NAME,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: PRODUCT_NAME,
    description: "Search lyrics, read meanings, listen from verified sources, and browse curated Prabhat Samgiita resources.",
    images: ["/brand/share-icon.png"],
  },
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME,
    statusBarStyle: "default",
  },
  other: {
    "apple-itunes-app": "app-id=6802943117, app-argument=https://www.prabhatasamgiita.org",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/cormorant-garamond-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/cormorant-garamond-latin-ext.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={manropeStylesheet} />
      </head>
      <body className="font-sans">
        <Providers><AnalyticsTracker />{children}<FeedbackWidget /></Providers>
      </body>
    </html>
  )
}
