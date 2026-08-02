import Link from "next/link"

import { specialCollectionCount, specialCollectionGroups } from "@/lib/special-collections"

export function SpecialCollections({ activeQuery = "" }: { activeQuery?: string }) {
  return (
    <details id="collections" className="group/collection-browser scroll-mt-28 rounded-[2rem] border border-navy-900/10 bg-white p-5 shadow-[0_16px_45px_rgba(42,31,15,0.08)] sm:p-7 lg:p-9">
      <summary className="grid cursor-pointer list-none gap-5 border-b border-navy-900/10 pb-6 marker:content-none lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow">Special collections</p>
          <h2 id="collections-title" className="mt-3 font-serif text-4xl leading-tight text-navy-950 sm:text-5xl">Find the songs that meet your moment</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-700">
            Browse by original language, sacred figure, ceremony, season, social ideal, story, place, or musical tradition.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="rounded-full bg-gold-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-gold-800">{specialCollectionCount} collections</p>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-gold-500/35 text-lg text-gold-700 transition group-open/collection-browser:rotate-180" aria-hidden="true">⌄</span>
        </div>
      </summary>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {specialCollectionGroups.map((group, index) => (
          <details key={group.title} className="group rounded-2xl border border-navy-900/10 bg-ivory-50 p-4" open={index < 2}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 marker:content-none">
              <span>
                <span className="block font-serif text-xl font-semibold text-navy-950">{group.title}</span>
                <span className="mt-1 block text-xs leading-5 text-stone-600">{group.description}</span>
              </span>
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold-500/35 text-gold-700 transition group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {group.collections.map((collection) => {
                const isActive = queryMatchesCollection(activeQuery, collection.query)
                return (
                  <Link
                    key={collection.label}
                    href={isActive ? "/explore#catalog-search" : `/explore?q=${encodeURIComponent(collectionPrompt(collection.query))}#catalog-search`}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold text-navy-950 transition hover:border-gold-500 hover:bg-gold-50 ${isActive ? "border-gold-600 bg-gold-100 shadow-sm" : "border-navy-900/10 bg-white"}`}
                  >
                    <span>{collection.label}</span>
                    <span className="shrink-0 rounded-full bg-navy-50 px-2 py-1 text-[10px] font-bold text-navy-700">{collection.count}</span>
                  </Link>
                )
              })}
            </div>
          </details>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-stone-500">
        Indexed song counts reflect the currently reviewed thematic lists. The source notes that these lists are not yet exhaustive. <a href="https://prabhatasamgiita.net/themes.html" target="_blank" rel="noreferrer" className="font-semibold text-gold-700 underline underline-offset-4">View source theme index</a>
      </p>
    </details>
  )
}

export function collectionPrompt(label: string) {
  return `Search Prabhat Samgiita for ${label}`
}

function queryMatchesCollection(query: string, collectionQuery: string) {
  return query.trim().toLocaleLowerCase() === collectionPrompt(collectionQuery).toLocaleLowerCase()
}
