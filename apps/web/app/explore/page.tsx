import { ExploreClient } from "@/components/explore-client"
import { MiniPlayer } from "@/components/mini-player"
import { SiteHeader } from "@/components/site-header"
import seedSongs from "../../../../data/seed/songs.json"

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader active="Explore" />
      <ExploreClient initialSongs={seedSongs.slice(0, 12)} initialQuery={q} />
      <div className="sticky bottom-3 z-40 mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10"><MiniPlayer compact /></div>
    </main>
  )
}
