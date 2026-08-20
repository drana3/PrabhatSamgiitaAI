"use client"

import { collectionPrompt, queryMatchesCollection, specialCollectionCount, specialCollectionGroups } from "@/lib/special-collections"
import { scrollToSectionId } from "@/lib/scroll-to-section"

export function SpecialCollections({
  activeQuery = "",
  onSelect,
}: {
  activeQuery?: string
  onSelect?: (query: string) => void
}) {
  return (
    <details id="collections" className="group/collection-browser scroll-mt-28">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-navy-900/10 bg-white px-4 py-3.5 marker:content-none transition hover:border-gold-400 hover:bg-gold-50/60">
        <div className="min-w-0">
          <h2 id="collections-title" className="text-sm font-semibold text-navy-950">
            Browse {specialCollectionCount} collections
          </h2>
          <p className="mt-0.5 truncate text-xs leading-5 text-stone-600">
            Language, ceremony, season, story, and more
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gold-800">
          <span className="group-open/collection-browser:hidden">Show</span>
          <span className="hidden group-open/collection-browser:inline">Hide</span>
          <span className="text-base leading-none transition group-open/collection-browser:rotate-180" aria-hidden="true">⌄</span>
        </span>
      </summary>

      <div className="mt-4 space-y-5">
        {specialCollectionGroups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3 className="text-sm font-semibold text-navy-950">{group.title}</h3>
            <p className="mt-1 text-xs leading-5 text-stone-600">{group.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.collections.map((collection) => {
                const prompt = collectionPrompt(collection.query)
                const isActive = queryMatchesCollection(activeQuery, collection.query)
                const href = isActive
                  ? "/explore#catalog-search"
                  : `/explore?q=${encodeURIComponent(prompt)}&kind=catalog#catalog-search`
                return (
                  <a
                    key={collection.label}
                    href={href}
                    aria-current={isActive ? "true" : undefined}
                    onClick={(event) => {
                      if (!onSelect || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      event.preventDefault()
                      if (isActive) {
                        scrollToSectionId("catalog-search")
                        return
                      }
                      const browser = event.currentTarget.closest("details#collections") as HTMLDetailsElement | null
                      if (browser?.open) browser.open = false
                      void onSelect(prompt)
                    }}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold text-navy-950 transition hover:border-gold-500 hover:bg-gold-50 ${isActive ? "border-gold-600 bg-gold-100 shadow-sm" : "border-navy-900/10 bg-white"}`}
                  >
                    <span>{collection.label}</span>
                    <span className="rounded-full bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold text-navy-700">{collection.count}</span>
                  </a>
                )
              })}
            </div>
          </section>
        ))}

        <p className="text-xs leading-5 text-stone-500">
          <strong className="text-navy-950">Raga & tala:</strong> the musical index is published as notation pages are reviewed.
          Counts follow the currently reviewed lists.{" "}
          <a href="https://prabhatasamgiita.net/themes.html" target="_blank" rel="noreferrer" className="font-semibold text-gold-700 underline underline-offset-4">Theme index</a>
        </p>
      </div>
    </details>
  )
}
