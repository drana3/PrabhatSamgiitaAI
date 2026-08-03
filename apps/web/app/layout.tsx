import type { Metadata } from "next"
import { Cormorant_Garamond, Manrope } from "next/font/google"

import { Providers } from "@/components/providers"
import { FeedbackWidget } from "@/components/feedback-widget"
import { AnalyticsTracker } from "@/components/analytics-tracker"
import "./globals.css"

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["500", "600", "700"],
})

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "Prabhat Samgiita AI",
  description: "Search lyrics, read meanings, listen from verified sources, and browse curated Prabhat Samgiita resources.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    title: "Prabhat Samgiita AI",
    statusBarStyle: "default",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} font-sans`}>
        <Providers><AnalyticsTracker />{children}<FeedbackWidget /></Providers>
      </body>
    </html>
  )
}
