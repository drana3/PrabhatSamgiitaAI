import Link from "next/link"

import { RecommendationSection } from "@/components/recommendation-section"
import { SearchSection } from "@/components/search-section"
import { SongCard } from "@/components/song-card"
import { fetchInventory, fetchSongs } from "@/lib/api"

export default async function HomePage() {
  const [songs, inventory] = await Promise.all([fetchSongs(), fetchInventory()])

  return (
    <main className="min-h-screen bg-aurora">
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur md:p-10">
            <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Prabhat Samgiita AI</p>
            <h1 className="mt-4 font-serif text-5xl leading-none text-ink-900 md:text-7xl">
              Search the dawn songs with grounded, verified context.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-700 md:text-lg">
              Find lyrics by number or first line, explore canonical translations, and listen to verified audio
              or embedded video without the app inventing any of the source content.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#catalog" className="rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white">
                Browse catalog
              </Link>
              <Link href="#inventory" className="rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-900">
                View inventory
              </Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-ink-200 bg-ink-900 p-6 text-white shadow-glow md:p-10">
            <p className="text-xs uppercase tracking-[0.4em] text-ember-300">Why this design works</p>
            <ul className="mt-6 space-y-4 text-sm leading-6 text-ink-100">
              <li>Responsive cards and simple navigation for phones and desktops.</li>
              <li>Streaming explanation endpoint for progressive AI responses.</li>
              <li>Separation of verified canonical content from community media.</li>
              <li>Fallback recommendations even with no model key configured.</li>
            </ul>
          </div>
        </div>

        <div id="search" className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SearchSection initialSongs={songs} />
          <div className="rounded-3xl border border-ink-200 bg-white p-5">
            <h2 className="font-serif text-3xl text-ink-900">Recommendation context</h2>
            <p className="mt-2 text-sm text-ink-600">
              Describe the date, festival, mood, or meditation setting and the backend scores verified songs by
              grounded metadata.
            </p>
            <RecommendationSection />
          </div>
        </div>

        <section id="catalog" className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Catalog</p>
              <h2 className="mt-2 font-serif text-4xl text-ink-900">Sample verified songs</h2>
            </div>
            <p className="text-sm text-ink-600">{songs.length} records loaded from the API</p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {songs.slice(0, 9).map((song) => (
              <SongCard key={song.number} song={song} />
            ))}
          </div>
        </section>

        <section id="inventory" className="mt-10 rounded-[2rem] border border-ink-200 bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-ember-700">Inventory</p>
              <h2 className="mt-2 font-serif text-4xl text-ink-900">Official and verified resources</h2>
            </div>
            <p className="text-sm text-ink-600">{inventory.length} resources indexed</p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {inventory.slice(0, 8).map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-ink-200 bg-ink-50 p-4 transition hover:border-ember-300 hover:bg-white"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-ember-700">{item.source_kind}</p>
                <h3 className="mt-2 font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-1 break-all text-sm text-ink-600">{item.url}</p>
              </a>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
