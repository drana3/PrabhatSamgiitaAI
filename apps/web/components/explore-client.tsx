"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import {
  FEELING_SEARCH_EMPTY_BODY_GUEST,
  FEELING_SEARCH_EMPTY_BODY_SIGNED_IN,
  FEELING_SEARCH_EMPTY_NO_MATCH,
  FEELING_SEARCH_EMPTY_TITLE,
  planSearch,
} from "@prabhat/core"

import { LoadingIndicator } from "@/components/loading-indicator"
import { SearchForm } from "@/components/search-form"
import { SongCard } from "@/components/song-card"
import { SpecialCollections } from "@/components/special-collections"
import { searchSongs, searchSongsByVoice } from "@/lib/api"
import type { SongSummary, VoiceSearchResult } from "@/lib/api"
import { useSearchAuth } from "@/lib/feeling-search"
import {
  instantExploreSongs,
  lyricHitsToSongs,
  searchCatalogLyrics,
  shouldSearchCatalogLyrics,
} from "@/lib/lyric-search"
import { scrollToSectionId } from "@/lib/scroll-to-section"
import { signInHref } from "@/lib/sign-in"
import type { ExploreSearchKind } from "@/lib/special-collections"
import { collectionSearchDisplayLabel, collectionSearchCount, exploreSearchKind, isCollectionSearchQuery } from "@/lib/special-collections"
import {
  COMPLETE_SARGAM_LABEL,
  COMPLETE_SARGAM_QUERY,
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
  const router = useRouter()
  const pathname = usePathname()
  const pendingInitialSearch = Boolean(initialQuery) && !searchPrefetched
  const instantInitial = initialQuery.trim() ? instantExploreSongs(initialQuery.trim(), searchKind, searchAuth) : null
  const [songs, setSongs] = useState<SongSummary[]>(
    instantInitial !== null ? instantInitial : [],
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

    // Feeling search on (signed-in): treat as semantic for free text — same path for every
    // signed-in member with the toggle enabled.
    const feelingAllowed = searchAuth.signedIn && searchAuth.feelingSearchEnabled
    const effectiveAuth =
      (kind === "semantic" || feelingAllowed) && searchAuth.signedIn
        ? { signedIn: true, feelingSearchEnabled: true }
        : searchAuth

    const key = cacheKey(trimmed, kind === "semantic" || feelingAllowed ? "semantic" : kind)
    const cached = searchCache.current.get(key)
    if (cached) {
      beginSearchState(() => {
        setSearching(false)
        setActiveQuery(trimmed)
        setActiveKind(feelingAllowed || kind === "semantic" ? "semantic" : kind)
        setCompletedQuery("")
        setSongs(cached)
        setVoiceResult(null)
        setSearchError(null)
      })
      window.history.replaceState(
        null,
        "",
        exploreUrl(trimmed, feelingAllowed || kind === "semantic" ? "semantic" : kind),
      )
      finishSearch(trimmed)
      return
    }

    const resolvedKind: ExploreSearchKind =
      feelingAllowed || kind === "semantic"
        ? exploreSearchKind(trimmed, "semantic", effectiveAuth)
        : kind

    const instant = instantExploreSongs(trimmed, resolvedKind, effectiveAuth)
    if (instant !== null) {
      searchCache.current.set(key, instant)
      beginSearchState(() => {
        setSearching(false)
        setActiveQuery(trimmed)
        setActiveKind(resolvedKind)
        setCompletedQuery("")
        setSongs(instant)
        setVoiceResult(null)
        setSearchError(null)
      })
      window.history.replaceState(null, "", exploreUrl(trimmed, resolvedKind))
      finishSearch(trimmed)
      return
    }

    const plan = planSearch(trimmed, effectiveAuth)
    const keepSongs = isCollectionSearchQuery(trimmed)
    const sargam = isCompleteSargamQuery(trimmed)
    const useSemantic = resolvedKind === "semantic" || plan.layer === "semantic"
    const localHits =
      !sargam && !useSemantic && shouldSearchCatalogLyrics(trimmed, resolvedKind)
        ? searchCatalogLyrics(trimmed, 5, { interpret: true })
        : []
    const networkMode = useSemantic ? ("semantic" as const) : ("catalog" as const)
    const needsNetwork =
      !sargam &&
      localHits.length === 0 &&
      (useSemantic || plan.layer === "collection" || plan.layer === "catalog")
    beginSearchState(() => {
      // Feeling search must show loading until the semantic API finishes — never flash
      // "no songs matched" mid-request.
      setSearching(needsNetwork || useSemantic)
      setActiveQuery(trimmed)
      setActiveKind(useSemantic ? "semantic" : resolvedKind)
      setCompletedQuery("")
      if (!keepSongs) setSongs([])
      setVoiceResult(null)
      setSearchError(null)
    })
    window.history.replaceState(null, "", exploreUrl(trimmed, useSemantic ? "semantic" : resolvedKind))

    try {
      const results = sargam
        ? completeSargamSongs()
        : localHits.length
          ? lyricHitsToSongs(localHits)
          : needsNetwork
            ? await searchSongs(trimmed, { mode: networkMode })
            : []
      searchCache.current.set(cacheKey(trimmed, useSemantic ? "semantic" : resolvedKind), results)
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

  // Typing must not update activeQuery — SearchForm uses that as initialQuery and
  // would reset the input on every keystroke. Suggestions stay in the dropdown;
  // results update on submit / theme / collection only.
  const handleQueryInput = useCallback((query: string) => {
    if (query.trim()) return
    setSearching(false)
    setSongs([])
    setSearchError(null)
  }, [])

  const tryFeelingSearch = useCallback(() => {
    if (!searchAuth.signedIn) {
      router.push(signInHref(pathname))
      return
    }
    // Feeling stays off by default — enable it in Account / Profile.
    router.push("/account#feeling-search")
  }, [pathname, router, searchAuth.signedIn])

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

  const feelingOn = Boolean(searchAuth.signedIn && searchAuth.feelingSearchEnabled)
  const loadingLabel = activeKind === "semantic" || feelingOn
    ? "Searching meanings and themes across the catalog"
    : "Finding the verified songs in this collection"

  const queryLabel = collectionSearchDisplayLabel(activeQuery)
  const collectionSearch = isCollectionSearchQuery(activeQuery)
  const collectionTotal = collectionSearchCount(activeQuery)
  const completeSargamSearch = isCompleteSargamQuery(activeQuery)
  const isCollectionResult = collectionTotal !== null && collectionSearch
  const catalogEmpty =
    Boolean(activeQuery.trim()) &&
    !searching &&
    songs.length === 0 &&
    !collectionSearch &&
    !completeSargamSearch &&
    !searchError
  // Feeling search on: only declare no matches after a finished semantic attempt.
  const showSemanticNoMatch = catalogEmpty && feelingOn && activeKind === "semantic"
  // Feeling search off: prompt to enable deep search (sign-in required for guests).
  const showFeelingEnablePrompt = catalogEmpty && !feelingOn
  const showEmptyState = showSemanticNoMatch || showFeelingEnablePrompt

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

      <div ref={resultsRef} id="results" className="scroll-mt-28">
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
      ) : searchError ? (
        <div role="status" className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-50 p-8 text-center">
          <h3 className="font-serif text-2xl text-navy-950">Search could not finish</h3>
          <p className="mt-2 text-sm text-stone-700">{searchError}</p>
          <p className="mt-3 text-sm text-stone-600">Try again in a moment, or search by song number or opening words.</p>
        </div>
      ) : showEmptyState ? (
        <div className="mt-6 space-y-6">
          <div role="status" className="rounded-2xl border border-dashed border-gold-500/40 bg-white p-8 text-center">
            {showFeelingEnablePrompt ? (
              <>
                <h3 className="font-serif text-2xl text-navy-950">{FEELING_SEARCH_EMPTY_TITLE}</h3>
                <p className="mt-2 text-sm text-stone-600">
                  {searchAuth.signedIn
                    ? FEELING_SEARCH_EMPTY_BODY_SIGNED_IN
                    : FEELING_SEARCH_EMPTY_BODY_GUEST}
                </p>
                <div className="mx-auto mt-5 max-w-md space-y-3 rounded-2xl border border-gold-500/30 bg-gold-50 px-5 py-4 text-left">
                  <p className="text-sm font-semibold text-navy-950">Feeling search</p>
                  <p className="text-sm text-stone-700">
                    {searchAuth.signedIn
                      ? "Open your Profile to turn on Feeling search, then search again by mood or meaning (for example “peaceful devotion”)."
                      : "Sign in, then enable Feeling search in Profile for mood and meaning search across the catalog."}
                  </p>
                  <button
                    type="button"
                    onClick={tryFeelingSearch}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gold-700 sm:w-auto"
                  >
                    {searchAuth.signedIn ? "Open Profile to enable" : "Sign in for Feeling search"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-serif text-2xl text-navy-950">No songs matched your search criteria</h3>
                <p className="mt-2 text-sm text-stone-600">{FEELING_SEARCH_EMPTY_NO_MATCH}</p>
              </>
            )}
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
      ) : null}
      </div>

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
