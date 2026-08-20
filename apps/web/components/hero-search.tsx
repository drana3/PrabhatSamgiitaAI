"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  FEELING_ENABLE_IN_PROFILE_BODY,
  FEELING_ENABLE_IN_PROFILE_TITLE,
  HOME_SEARCH_EXAMPLES,
  SEARCH_PLACEHOLDER,
} from "@prabhat/core"

import { InstantSearchSuggestions } from "@/components/instant-search-suggestions"
import { VoiceSearchButton } from "@/components/voice-search-button"
import { useSearchAuth } from "@/lib/feeling-search"
import { queryGuidanceFor, queryIsUseful } from "@/lib/query-guard"
import { extractSongSearchIntent, songIntentPath } from "@/lib/search-intent"
import { signInHref } from "@/lib/sign-in"

export function HeroSearch() {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const searchAuth = useSearchAuth()
  const signedIn = searchAuth.signedIn
  const feelingOn = searchAuth.feelingSearchEnabled
  const [guidance, setGuidance] = useState("")
  const [feelingPrompt, setFeelingPrompt] = useState(false)

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
      if (!signedIn) {
        router.push(signInHref("/account"))
        return
      }
      // Feeling stays off by default — ask the member to enable it in Account / Profile.
      if (!feelingOn) {
        setFeelingPrompt(true)
        return
      }
      router.push(`/explore?q=${encodeURIComponent(normalized)}&kind=semantic`)
      return
    }

    setFeelingPrompt(false)
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
        {HOME_SEARCH_EXAMPLES.map((example) => {
          const feelingGuest = example.mode === "feeling" && !signedIn
          const feelingNeedsEnable = example.mode === "feeling" && signedIn && !feelingOn
          return (
            <button
              key={example.label}
              type="button"
              data-feature={`hero_search_${example.label.toLowerCase().replace(/\s+/g, "_")}`}
              aria-label={
                feelingGuest
                  ? `${example.label}: Sign in to use Feeling search`
                  : feelingNeedsEnable
                    ? `${example.label}: Enable Feeling search in Profile`
                    : `${example.label}: ${example.description}`
              }
              onClick={() => {
                setQuery(example.query)
                search(example.query, example.mode)
              }}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                feelingGuest || feelingNeedsEnable
                  ? "border-navy-900/10 bg-white/70 text-navy-900/70 hover:border-gold-500 hover:bg-gold-50"
                  : "border-navy-900/10 bg-white/90 text-navy-900 hover:border-gold-500 hover:bg-gold-50"
              }`}
            >
              {example.label}
              <span className="ml-1.5 font-normal text-stone-600">· {example.query}</span>
              {feelingGuest ? (
                <span className="ml-1.5 font-semibold text-gold-700">· Sign in</span>
              ) : null}
              {feelingNeedsEnable ? (
                <span className="ml-1.5 font-semibold text-gold-700">· Enable in Profile</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {feelingPrompt ? (
        <div
          role="status"
          className="rounded-2xl border border-gold-500/35 bg-gold-50 px-4 py-3 text-left"
        >
          <p className="text-sm font-semibold text-navy-950">{FEELING_ENABLE_IN_PROFILE_TITLE}</p>
          <p className="mt-1 text-xs leading-5 text-stone-700">{FEELING_ENABLE_IN_PROFILE_BODY}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-navy-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-gold-700"
              onClick={() => router.push("/account#feeling-search")}
            >
              Open Profile
            </button>
            <button
              type="button"
              className="rounded-xl border border-navy-900/15 bg-white px-4 py-2 text-xs font-semibold text-navy-950"
              onClick={() => setFeelingPrompt(false)}
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
