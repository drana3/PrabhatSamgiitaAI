import { notFound } from "next/navigation"

import { SiteHeader } from "@/components/site-header"

import { LocalHarmoniumPlayer } from "./local-player"

export default function LocalHarmoniumPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader />
      <LocalHarmoniumPlayer />
    </main>
  )
}
