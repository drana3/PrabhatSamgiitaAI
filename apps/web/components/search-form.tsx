"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"

import { searchSongs, searchSongsByVoice } from "@/lib/api"
import type { VoiceSearchResult } from "@/lib/api"
import { LoadingIndicator } from "@/components/loading-indicator"
import { VoiceSearchButton } from "@/components/voice-search-button"
import { queryIsUseful } from "@/lib/query-guard"
import { extractSongSearchIntent, songIntentPath } from "@/lib/search-intent"

const schema = z.object({
  query: z.string().min(1, "Enter a song number, first line, or theme"),
})

type FormValues = z.infer<typeof schema>

export function SearchForm({
  onResults,
  onSearching,
  onVoiceResult,
  onQueryChange,
  onSemanticSearch,
  onVoiceSearch,
  searchError = null,
  initialQuery = "",
  inputMode = "text",
  spokenLanguage,
  isSearching = false,
}: {
  onResults: (results: Awaited<ReturnType<typeof searchSongs>>) => void
  onSearching?: (searching: boolean) => void
  onVoiceResult?: (result: VoiceSearchResult | null) => void
  onQueryChange?: (query: string) => void
  onSemanticSearch?: (query: string) => void
  onVoiceSearch?: (query: string, language?: string) => void
  searchError?: string | null
  initialQuery?: string
  inputMode?: "text" | "voice"
  spokenLanguage?: string
  isSearching?: boolean
}) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { query: initialQuery },
  })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (inputMode === "voice") {
        const voiceResult = await searchSongsByVoice(values.query, spokenLanguage)
        return { songs: voiceResult.matches.map((match) => match.song), voiceResult }
      }
      return { songs: await searchSongs(values.query, { mode: "semantic" }), voiceResult: null }
    },
    onMutate: () => onSearching?.(true),
    onSuccess: ({ songs, voiceResult }) => {
      onResults(songs)
      onVoiceResult?.(voiceResult)
    },
    onSettled: () => onSearching?.(false),
  })

  function submit(values: FormValues) {
    const songIntent = extractSongSearchIntent(values.query)
    if (songIntent) {
      router.push(songIntentPath(songIntent))
      return
    }
    const trimmed = values.query.trim()
    const nextUrl = `/explore?q=${encodeURIComponent(trimmed)}&kind=semantic`
    if (!queryIsUseful(trimmed, 200)) {
      mutation.mutate({ query: trimmed })
      return
    }
    if (onSemanticSearch) {
      onSemanticSearch(trimmed)
      return
    }
    if (trimmed !== initialQuery.trim()) {
      router.push(nextUrl)
      return
    }
    mutation.mutate({ query: trimmed })
  }

  useEffect(() => {
    form.reset({ query: initialQuery })
    onQueryChange?.(initialQuery)
  }, [initialQuery, form, onQueryChange])

  return (
    <form
      id="catalog-search"
      className="scroll-mt-28 rounded-2xl border border-navy-900/10 bg-white p-3 shadow-sm"
      onSubmit={form.handleSubmit(submit)}
    >
      <label className="mb-2 block text-xs font-bold text-navy-950" htmlFor="query">
        Search by number, lyrics, meaning, or moment
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          id="query"
          {...form.register("query")}
          placeholder="Try 1, bandhu he, or devotional dawn"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-navy-950 outline-none transition placeholder:text-stone-400 focus:border-gold-500"
        />
        <VoiceSearchButton onTranscript={({ transcript, language }) => {
          form.setValue("query", transcript, { shouldValidate: true })
          if (onVoiceSearch) {
            onVoiceSearch(transcript, language)
            return
          }
          router.push(`/explore?q=${encodeURIComponent(transcript)}&kind=semantic&mode=voice&lang=${encodeURIComponent(language)}`)
        }} />
        <button
          type="submit"
          data-feature="catalog_search"
          className="flex min-h-12 items-center justify-center rounded-xl bg-navy-950 px-7 py-3 font-semibold text-white transition hover:bg-gold-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={mutation.isPending || isSearching}
        >
          {mutation.isPending || isSearching ? <LoadingIndicator label="Searching" compact /> : "Search"}
        </button>
      </div>
      <div className="min-h-5 pt-1">
        {form.formState.errors.query ? (
          <p className="text-sm text-red-700">{form.formState.errors.query.message}</p>
        ) : null}
        {searchError ? <p role="alert" className="text-sm text-amber-800">{searchError}</p> : null}
        {mutation.isError ? <p role="alert" className="text-sm text-amber-800">{mutation.error.message}</p> : null}
      </div>
    </form>
  )
}
