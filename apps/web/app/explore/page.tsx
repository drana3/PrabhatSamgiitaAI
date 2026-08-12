import { ExploreClient } from "@/components/explore-client"
import { MiniPlayer } from "@/components/mini-player"
import { SiteHeader } from "@/components/site-header"
import { exploreSearchKind } from "@/lib/special-collections"
import seedSongs from "../../../../data/seed/songs.json"

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; mode?: string; lang?: string; kind?: string }> }) {
  const { q = "", mode, lang, kind } = await searchParams
  const searchKind = exploreSearchKind(q, kind)

  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader active="Explore" />
      <ExploreClient
        initialSongs={seedSongs.slice(0, 12)}
        initialQuery={q}
        searchKind={searchKind}
        inputMode={mode === "voice" ? "voice" : "text"}
        spokenLanguage={lang}
      />
      <div className="sticky bottom-3 z-40 mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10"><MiniPlayer compact /></div>
    </main>
  )
}
