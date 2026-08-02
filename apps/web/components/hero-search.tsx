"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { queryGuidanceFor, queryIsUseful } from "@/lib/query-guard"
import { extractSongSearchIntent, songIntentPath } from "@/lib/search-intent"
import { VoiceSearchButton } from "@/components/voice-search-button"

export function HeroSearch() {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const [guidance, setGuidance] = useState("")

  function search(value: string) {
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
    router.push(`/explore?q=${encodeURIComponent(normalized)}`)
  }

  return (
    <form
      className="hero-search"
      onSubmit={(event) => {
        event.preventDefault()
        search(query)
      }}
    >
      <span aria-hidden="true" className="text-xl text-navy-700">⌕</span>
      <label htmlFor="hero-query" className="sr-only">Ask by song, feeling, meaning, or moment</label>
      <input
        id="hero-query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ask by song, feeling, meaning, or moment..."
        className="min-w-0 flex-1 bg-transparent text-sm text-navy-950 outline-none placeholder:text-stone-500"
      />
      <VoiceSearchButton compact onTranscript={({ transcript, language }) => {
        setQuery(transcript)
        if (!queryIsUseful(transcript, 200)) {
          setGuidance(queryGuidanceFor(transcript))
          return
        }
        router.push(`/explore?q=${encodeURIComponent(transcript)}&mode=voice&lang=${encodeURIComponent(language)}`)
      }} />
      <button type="submit" aria-label="Search" data-feature="hero_search" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-600 text-lg text-white shadow-md transition hover:bg-gold-700">
        →
      </button>
      {guidance ? <span className="sr-only" role="alert">{guidance}</span> : null}
    </form>
  )
}
