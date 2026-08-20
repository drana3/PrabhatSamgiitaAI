"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { SEARCH_PLACEHOLDER } from "@prabhat/core"

import { InstantSearchSuggestions } from "@/components/instant-search-suggestions"
import { useMember } from "@/components/member-provider"
import { VoiceSearchButton } from "@/components/voice-search-button"
import { writeFeelingSearchEnabled } from "@/lib/feeling-search"
import { queryGuidanceFor, queryIsUseful } from "@/lib/query-guard"
import { extractSongSearchIntent, songIntentPath } from "@/lib/search-intent"
import { signInHref } from "@/lib/sign-in"

const FEELING_EXAMPLE_QUERY = "peaceful devotion"

const searchExamples = [
  { label: "By number", query: "111", description: "Open a song directly", mode: "catalog" as const },
  {
    label: "By words",
    query: "bandhu he niye calo",
    description: "Search remembered lyrics",
    mode: "catalog" as const,
  },
  {
    label: "By feeling",
    query: FEELING_EXAMPLE_QUERY,
    description: "Find songs by mood with Feeling search",
    mode: "feeling" as const,
  },
] as const

export function HeroSearch() {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const { session } = useMember()
  const signedIn = session.authenticated
  const [guidance, setGuidance] = useState("")

  function search(value: string, mode: "catalog" | "feeling" = "catalog") {
    const normalized = value.trim()
    if (!queryIsUseful(normalized, 200)) {
      setGuidance(queryGuidanceFor(value))
      return
    }
    setGuidance("")
    const songIntent = extractSongSearchIntent(normalized)
    if (songIntent) {
      router.push(songIntentPath(songIntent))
      return
    }

    if (mode === "feeling") {
      const exploreFeeling = `/explore?q=${encodeURIComponent(normalized)}&kind=semantic`
      if (!signedIn) {
        router.push(signInHref(exploreFeeling))
        return
      }
      writeFeelingSearchEnabled(true)
      router.push(exploreFeeling)
      return
    }

    router.push(`/explore?q=${encodeURIComponent(normalized)}`)
  }

  return (
    <div className="space-y-3">
      <form
        className="hero-search relative z-20"
        onSubmit={(event) => {
          event.preventDefault()
          search(query)
        }}
      >
        <span aria-hidden="true" className="text-xl text-navy-700">⌕</span>
        <label htmlFor="hero-query" className="sr-only">
          Search by song number, remembered words, or feeling
        </label>
        <input
          id="hero-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          className="min-w-0 flex-1 bg-transparent text-sm text-navy-950 outline-none placeholder:text-stone-500"
          aria-autocomplete="list"
          aria-controls="hero-search-suggestions"
        />
        <VoiceSearchButton compact onTranscript={({ transcript, language }) => {
          setQuery(transcript)
          if (!queryIsUseful(transcript, 200)) {
            setGuidance(queryGuidanceFor(transcript))
            return
          }
          setGuidance("")
          const songIntent = extractSongSearchIntent(transcript)
          if (songIntent) {
            router.push(songIntentPath(songIntent))
            return
          }
          router.push(`/explore?q=${encodeURIComponent(transcript)}&mode=voice&lang=${encodeURIComponent(language)}`)
        }} />
        <button type="submit" aria-label="Search" data-feature="hero_search" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-600 text-lg text-white shadow-md transition hover:bg-gold-700">
          →
        </button>
        {guidance ? <span className="sr-only" role="alert">{guidance}</span> : null}
      </form>
      <div className="relative z-20">
        <InstantSearchSuggestions query={query} id="hero-search-suggestions" />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Search examples">
        {searchExamples.map((example) => {
          const feelingLocked = example.mode === "feeling" && !signedIn
          return (
            <button
              key={example.label}
              type="button"
              data-feature={`hero_search_${example.label.toLowerCase().replace(/\s+/g, "_")}`}
              aria-label={
                feelingLocked
                  ? `${example.label}: Sign in to use Feeling search`
                  : `${example.label}: ${example.description}`
              }
              onClick={() => {
                setQuery(example.query)
                search(example.query, example.mode)
              }}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                feelingLocked
                  ? "border-navy-900/10 bg-white/70 text-navy-900/70 hover:border-gold-500 hover:bg-gold-50"
                  : "border-navy-900/10 bg-white/90 text-navy-900 hover:border-gold-500 hover:bg-gold-50"
              }`}
            >
              {example.label}
              <span className="ml-1.5 font-normal text-stone-600">· {example.query}</span>
              {feelingLocked ? (
                <span className="ml-1.5 font-semibold text-gold-700">· Sign in</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
