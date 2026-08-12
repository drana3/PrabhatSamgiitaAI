import { ExploreClient } from "@/components/explore-client"
import { MiniPlayer } from "@/components/mini-player"
import { SiteHeader } from "@/components/site-header"
import { searchSongsOnServer } from "@/lib/server-api"
import { exploreSearchKind } from "@/lib/special-collections"
import seedSongs from "../../../../data/seed/songs.json"

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string; mode?: string; lang?: string; kind?: string }> }) {
  const { q = "", mode, lang, kind } = await searchParams
  const searchKind = exploreSearchKind(q, kind)
  const prefetchEnabled = process.env.E2E_DISABLE_SEARCH_PREFETCH !== "true"
  const prefetched = prefetchEnabled && q && searchKind === "catalog"
    ? await searchSongsOnServer(q, "catalog")
    : null
  const initialSongs = prefetched ?? seedSongs.slice(0, 12)

  return (
    <main className="min-h-screen bg-ivory-50">
      <SiteHeader active="Explore" />
      <ExploreClient
        initialSongs={initialSongs}
        initialQuery={q}
        searchKind={searchKind}
        searchPrefetched={Boolean(prefetched && q)}
        inputMode={mode === "voice" ? "voice" : "text"}
        spokenLanguage={lang}
      />
      <div className="sticky bottom-3 z-40 mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10"><MiniPlayer compact /></div>
    </main>
  )
}
