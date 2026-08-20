"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"

import { planSearch } from "@prabhat/core"

import { LoadingIndicator } from "@/components/loading-indicator"
import { SearchForm } from "@/components/search-form"
import { SongCard } from "@/components/song-card"
import { SpecialCollections } from "@/components/special-collections"
import { fetchSongs, searchSongs, searchSongsByVoice } from "@/lib/api"
import type { SongSummary, VoiceSearchResult } from "@/lib/api"
import { useSearchAuth } from "@/lib/feeling-search"
import {
  instantExploreSongs,
  lyricHitsToSongs,
  searchCatalogLyrics,
  shouldSearchCatalogLyrics,
} from "@/lib/lyric-search"
import { scrollToSectionId } from "@/lib/scroll-to-section"
import type { ExploreSearchKind } from "@/lib/special-collections"
import { collectionSearchDisplayLabel, collectionSearchCount, exploreSearchKind, isCollectionSearchQuery } from "@/lib/special-collections"
import {
  COMPLETE_SARGAM_LABEL,
  COMPLETE_SARGAM_QUERY,
  completeSargamCount,
  completeSargamSongs,
  isCompleteSargamQuery,
} from "@/lib/complete-sargam"

const themes = [
  { label: "♡ Love & devotion", query: "love devotion" },
  { label: "♧ Peace & bliss", query: "peace bliss" },
  { label: "☀ Spiritual awakening", query: "spiritual awakening" },
  { label: "♙ Service & humanity", query: "service humanity" },
  { label: "♧ Nature", query: "nature river mountain" },
  { label: "♪ Full Sargam", query: COMPLETE_SARGAM_QUERY },
]

function cacheKey(query: string, kind: ExploreSearchKind) {
  return `${kind}:${query.trim()}`
}

function exploreUrl(
  query: string,
  kind: ExploreSearchKind,
  options?: { voice?: boolean; lang?: string },
) {
  const params = new URLSearchParams({
    q: query.trim(),
    kind,
  })
  if (options?.voice) params.set("mode", "voice")
  if (options?.lang) params.set("lang", options.lang)
  return `/explore?${params.toString()}#catalog-search`
}

function scrollToSearchBar() {
  scrollToSectionId("catalog-search")
}

function scrollToResults() {
  scrollToSectionId("results", { behavior: "smooth" })
}

function beginSearchState(
  apply: () => void,
) {
  flushSync(apply)
  // Mobile taps (and Playwright actionability) often keep the clicked control
  // centered after the handler returns, so re-assert the search-bar scroll
  // after the click gesture settles.
  scrollToSearchBar()
  window.requestAnimationFrame(() => {
    scrollToSearchBar()
    window.setTimeout(scrollToSearchBar, 50)
  })
}

export function ExploreClient({
  initialSongs,
  initialQuery,
  searchKind,
  searchPrefetched = false,
  inputMode = "text",
  spokenLanguage,
}: {
  initialSongs: SongSummary[]
  initialQuery: string
  searchKind: ExploreSearchKind
  searchPrefetched?: boolean
  inputMode?: "text" | "voice"
  spokenLanguage?: string
}) {
  const searchAuth = useSearchAuth()
  const pendingInitialSearch = Boolean(initialQuery) && !searchPrefetched
  const instantInitial = initialQuery.trim() ? instantExploreSongs(initialQuery.trim(), searchKind, searchAuth) : null
  const [songs, setSongs] = useState<SongSummary[]>(
    instantInitial !== null ? instantInitial : pendingInitialSearch ? [] : initialSongs,
  )
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [activeKind, setActiveKind] = useState<ExploreSearchKind>(searchKind)
  const [searching, setSearching] = useState(pendingInitialSearch && instantInitial === null)
  const [completedQuery, setCompletedQuery] = useState("")
  const [voiceResult, setVoiceResult] = useState<VoiceSearchResult | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const searchCache = useRef((() => {
    const map = new Map<string, SongSummary[]>()
    if (instantInitial !== null && initialQuery.trim()) {
      map.set(cacheKey(initialQuery.trim(), searchKind), instantInitial)
    }
    return map
  })())
  const bootstrappedQuery = useRef<string | null>(null)

  useEffect(() => {
    if (initialQuery) return
    let active = true
    void fetchSongs().then((value) => { if (active && value.length) setSongs(value) })
    return () => { active = false }
  }, [initialQuery])

  const finishSearch = useCallback((trimmed: string) => {
    setCompletedQuery(trimmed)
    window.requestAnimationFrame(() => {
      scrollToResults()
      window.setTimeout(scrollToResults, 50)
    })
  }, [])

  const runSearch = useCallback(async (query: string, kind: ExploreSearchKind) => {
    const trimmed = query.trim()
    if (!trimmed) return

    const key = cacheKey(trimmed, kind)
    const cached = searchCache.current.get(key)
    if (cached) {
      beginSearchState(() => {
        setSearching(false)
        setActiveQuery(trimmed)
        setActiveKind(kind)
        setCompletedQuery("")
        setSongs(cached)
        setVoiceResult(null)
        setSearchError(null)
      })
      window.history.replaceState(null, "", exploreUrl(trimmed, kind))
      finishSearch(trimmed)
      return
    }

    const instant = instantExploreSongs(trimmed, kind, searchAuth)
    if (instant !== null) {
      searchCache.current.set(key, instant)
      beginSearchState(() => {
        setSearching(false)
        setActiveQuery(trimmed)
        setActiveKind(kind)
        setCompletedQuery("")
        setSongs(instant)
        setVoiceResult(null)
        setSearchError(null)
      })
      window.history.replaceState(null, "", exploreUrl(trimmed, kind))
      finishSearch(trimmed)
      return
    }

    const plan = planSearch(trimmed, searchAuth)
    const keepSongs = isCollectionSearchQuery(trimmed)
    const sargam = isCompleteSargamQuery(trimmed)
    const localHits =
      !sargam && shouldSearchCatalogLyrics(trimmed, kind)
        ? searchCatalogLyrics(trimmed, 5, { interpret: true })
        : []
    const networkMode = plan.layer === "semantic" ? "semantic" as const : "catalog" as const
    const needsNetwork =
      !sargam &&
      localHits.length === 0 &&
      (plan.layer === "semantic" || plan.layer === "collection" || plan.layer === "catalog")
    beginSearchState(() => {
      setSearching(needsNetwork)
      setActiveQuery(trimmed)
      setActiveKind(kind)
      setCompletedQuery("")
      if (!keepSongs) setSongs([])
      setVoiceResult(null)
      setSearchError(null)
    })
    window.history.replaceState(null, "", exploreUrl(trimmed, kind))

    try {
      const results = sargam
        ? completeSargamSongs()
        : localHits.length
          ? lyricHitsToSongs(localHits)
          : needsNetwork
            ? await searchSongs(trimmed, { mode: networkMode })
            : []
      searchCache.current.set(key, results)
      setSongs(results)
      finishSearch(trimmed)
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search is temporarily unavailable.")
      setCompletedQuery(trimmed)
    } finally {
      setSearching(false)
    }
  }, [finishSearch, searchAuth])

  const runCatalogSearch = useCallback(
    (query: string) => void runSearch(query, "catalog"),
    [runSearch],
  )

  const handleQueryInput = useCallback((query: string) => {
    setActiveQuery(query)
    const trimmed = query.trim()
    if (!trimmed) {
      setSearching(false)
      setSongs(initialSongs)
      return
    }
    const instant = instantExploreSongs(trimmed, undefined, searchAuth)
    if (instant?.length) {
      searchCache.current.set(cacheKey(trimmed, "catalog"), instant)
      setSongs(instant)
      setSearching(false)
      setActiveKind("catalog")
      setSearchError(null)
    }
  }, [initialSongs, searchAuth])

  const runVoiceSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return

    beginSearchState(() => {
      setSearching(true)
      setActiveQuery(trimmed)
      setActiveKind("catalog")
      setCompletedQuery("")
      setSongs([])
      setSearchError(null)
    })
    window.history.replaceState(null, "", exploreUrl(trimmed, "catalog", { voice: true, lang: spokenLanguage }))

    try {
      const instant = instantExploreSongs(trimmed, undefined, searchAuth)
      if (instant !== null) {
        searchCache.current.set(cacheKey(trimmed, "catalog"), instant)
        setSongs(instant)
        finishSearch(trimmed)
        return
      }
      if (shouldSearchCatalogLyrics(trimmed, "catalog")) {
        const localHits = searchCatalogLyrics(trimmed, 5, { interpret: true })
        if (localHits.length) {
          const songs = lyricHitsToSongs(localHits)
          searchCache.current.set(cacheKey(trimmed, "catalog"), songs)
          setSongs(songs)
          finishSearch(trimmed)
          return
        }
      }
      const plan = planSearch(trimmed, searchAuth)
      if (plan.layer !== "semantic") {
        setSongs([])
        finishSearch(trimmed)
        return
      }
      const voiceResult = await searchSongsByVoice(trimmed, spokenLanguage)
      setVoiceResult(voiceResult)
      if (voiceResult.matches.length) {
        setSongs(voiceResult.matches.map((match) => match.song))
      } else {
        const semanticResults = await searchSongs(trimmed, { mode: "semantic" })
        setSongs(semanticResults)
      }
      finishSearch(trimmed)
    } catch (error) {
      try {
        if (planSearch(trimmed, searchAuth).layer !== "semantic") throw error
        const semanticResults = await searchSongs(trimmed, { mode: "semantic" })
        setVoiceResult(null)
        setSongs(semanticResults)
        finishSearch(trimmed)
      } catch {
        setSearchError(error instanceof Error ? error.message : "Voice search is temporarily unavailable.")
        setCompletedQuery(trimmed)
      }
    } finally {
      setSearching(false)
    }
  }, [finishSearch, searchAuth, spokenLanguage])

  useEffect(() => {
    if (!initialQuery) return
    const pendingKey = `${inputMode}:${searchKind}:${initialQuery}`
    if (bootstrappedQuery.current === pendingKey) return
    bootstrappedQuery.current = pendingKey

    if (searchPrefetched) {
      searchCache.current.set(cacheKey(initialQuery, searchKind), initialSongs)
      setSongs(initialSongs)
      setSearching(false)
      finishSearch(initialQuery)
      return
    }

    if (inputMode === "voice") {
      void runVoiceSearch(initialQuery)
      return
    }
    void runSearch(initialQuery, searchKind)
  }, [initialQuery, initialSongs, inputMode, runSearch, runVoiceSearch, searchKind, searchPrefetched, finishSearch])

  function handleSearching(nextSearching: boolean) {
    setSearching(nextSearching)
    setCompletedQuery(nextSearching ? "" : activeQuery)
  }

  const loadingLabel = activeKind === "catalog"
    ? "Finding the verified songs in this collection"
    : "Searching meanings and themes across the catalog"

  const queryLabel = collectionSearchDisplayLabel(activeQuery)
  const collectionSearch = isCollectionSearchQuery(activeQuery)
  const collectionTotal = collectionSearchCount(activeQuery)
  const completeSargamSearch = isCompleteSargamQuery(activeQuery)
  const completeSargamTotal = completeSargamSearch ? completeSargamCount() : null
  const isCollectionResult = collectionTotal !== null && collectionSearch
  const showsTopPredictions = activeKind === "semantic" && !isCollectionResult && !completeSargamSearch
  const resultsEyebrow = showsTopPredictions
    ? "Top 5 predictions"
    : isCollectionResult || completeSargamSearch
      ? "Collection results"
      : "Catalog matches"
  const collectionCountShown = isCollectionResult && collectionTotal !== null
    ? !searching && songs.length > 0
      ? songs.length
      : collectionTotal
    : null
  const resultsCountLabel = collectionCountShown !== null
    ? !searching && songs.length > 0 && collectionTotal !== null && collectionTotal > songs.length
      ? `${songs.length} of ${collectionTotal} shown`
      : `${collectionCountShown} song${collectionCountShown === 1 ? "" : "s"}`
    : searching
      ? "Searching…"
      : searchError
        ? "Unavailable"
        : completeSargamSearch && completeSargamTotal !== null
          ? `${songs.length} song${songs.length === 1 ? "" : "s"}`
          : `${songs.length} shown`

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="font-serif text-4xl text-navy-950 sm:text-5xl">Explore Prabhat Samgiita</h1>
        <span className="text-sm font-semibold text-gold-700">5,018 songs</span>
      </div>

      {activeQuery ? (
        <div id="active-filter" role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-500/35 bg-gold-50 px-5 py-4">
          <p className="text-sm text-stone-700">
            <span className="font-semibold text-navy-950">Showing songs for:</span>{" "}
            {collectionSearch ? queryLabel : completeSargamSearch ? COMPLETE_SARGAM_LABEL : activeQuery}
          </p>
          <Link href="/explore" className="text-xs font-semibold text-gold-700 underline underline-offset-4">Clear search</Link>
        </div>
      ) : null}

      <div ref={resultsRef} id="results" className="mt-8 flex scroll-mt-28 items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{resultsEyebrow}</p>
          <h2 className="mt-2 font-serif text-3xl text-navy-950">
            {activeQuery ? (
              inputMode === "voice" ? (
                <>Top voice matches for <span className="text-gold-700">“{queryLabel}”</span></>
              ) : collectionSearch ? (
                <>Songs in the <span className="text-gold-700">{queryLabel}</span> collection</>
              ) : completeSargamSearch ? (
                <>Songs with complete <span className="text-gold-700">Sargam</span></>
              ) : (
                <>Songs matching <span className="text-gold-700">“{queryLabel}”</span></>
              )
            ) : "Explore the songs"}
          </h2>
        </div>
        <span className="text-xs font-semibold text-stone-500">{resultsCountLabel}</span>
      </div>
      {searching && (songs.length === 0 || collectionSearch) ? (
        <div className="mt-6 rounded-2xl border border-gold-500/25 bg-white p-8"><LoadingIndicator label={loadingLabel} /></div>
      ) : songs.length ? (
        <div className="mt-6 space-y-4">
          {isCollectionResult && collectionTotal > songs.length ? (
            <p className="text-sm text-stone-600">
              Showing the first {songs.length} of {collectionTotal} songs in this collection.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{songs.map((song, index) => <SongCard key={song.number} song={song} index={index} />)}</div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div role="status" className="rounded-2xl border border-dashed border-gold-500/40 bg-white p-8 text-center">
            <h3 className="font-serif text-2xl text-navy-950">No songs matched your search criteria</h3>
            <p className="mt-2 text-sm text-stone-600">Try a song number, opening words, feeling, language, festival, or occasion.</p>
          </div>
          {initialSongs.length ? (
            <section aria-labelledby="recommended-after-search-title">
              <p className="eyebrow">A gentle next step</p>
              <h3 id="recommended-after-search-title" className="mt-2 font-serif text-2xl text-navy-950">Recommended songs to explore</h3>
              <p className="mt-2 text-sm text-stone-600">These are suggestions, not matches for your search.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {initialSongs.slice(0, 3).map((song, index) => <SongCard key={song.number} song={song} index={index} />)}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <div className="mt-8 max-w-4xl">
        <SearchForm
          initialQuery={activeQuery}
          inputMode={inputMode}
          spokenLanguage={spokenLanguage}
          isSearching={searching}
          onResults={setSongs}
          onSearching={handleSearching}
          onVoiceResult={setVoiceResult}
          onQueryChange={handleQueryInput}
          onSemanticSearch={(query) => {
            void runSearch(query, exploreSearchKind(query, null, searchAuth))
          }}
          onVoiceSearch={(query) => { void runVoiceSearch(query) }}
          searchError={searchError}
        />
      </div>

      {voiceResult ? (
        <div role="status" className={`mt-4 max-w-4xl rounded-2xl border px-5 py-4 ${voiceResult.confidence === "low" || voiceResult.confidence === "none" ? "border-amber-500/40 bg-amber-50" : "border-emerald-700/20 bg-emerald-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-700"><span className="font-semibold text-navy-950">We heard:</span> “{voiceResult.heard}”</p>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-navy-950">{voiceResult.confidence} confidence</span>
          </div>
          {voiceResult.interpreted_as && voiceResult.interpreted_as.toLocaleLowerCase() !== voiceResult.heard.toLocaleLowerCase() ? <p className="mt-2 text-xs text-stone-600">Interpreted for search as “{voiceResult.interpreted_as}”.</p> : null}
          {voiceResult.guidance ? <p className="mt-2 text-sm font-medium text-amber-900">{voiceResult.guidance}</p> : <p className="mt-2 text-xs text-stone-600">Searching meanings and feelings across all 5,018 songs.</p>}
        </div>
      ) : null}

      <div className="mt-8 space-y-5 border-y border-navy-900/10 py-6">
        <FilterRow label="Browse by theme" items={themes} onSelect={runCatalogSearch} />
        <SpecialCollections activeQuery={activeQuery} onSelect={runCatalogSearch} />
      </div>

    </div>
  )
}

function FilterRow({
  label,
  items,
  onSelect,
}: {
  label: string
  items: Array<{ label: string; query: string }>
  onSelect: (query: string) => void
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold text-navy-950">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => void onSelect(item.query)}
            className="soft-chip"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
