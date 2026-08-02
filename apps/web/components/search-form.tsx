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
import { extractSongSearchIntent, songIntentPath } from "@/lib/search-intent"

const schema = z.object({
  query: z.string().min(1, "Enter a song number, first line, or theme"),
})

type FormValues = z.infer<typeof schema>

export function SearchForm({ onResults, onSearching, onVoiceResult, initialQuery = "", inputMode = "text", spokenLanguage }: { onResults: (results: Awaited<ReturnType<typeof searchSongs>>) => void; onSearching?: (searching: boolean) => void; onVoiceResult?: (result: VoiceSearchResult | null) => void; initialQuery?: string; inputMode?: "text" | "voice"; spokenLanguage?: string }) {
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
      return { songs: await searchSongs(values.query), voiceResult: null }
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
    const nextUrl = `/explore?q=${encodeURIComponent(values.query.trim())}`
    if (values.query.trim() !== initialQuery.trim()) {
      router.push(nextUrl)
      return
    }
    mutation.mutate({ query: values.query.trim() })
  }

  useEffect(() => {
    form.reset({ query: initialQuery })
    if (initialQuery) mutation.mutate({ query: initialQuery })
    // The URL query is intentionally executed once when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  return (
    <form
      id="catalog-search"
      className="flex scroll-mt-28 flex-col gap-3 rounded-2xl border border-navy-900/10 bg-white p-3 shadow-sm md:flex-row md:items-end"
      onSubmit={form.handleSubmit(submit)}
    >
      <div className="flex-1">
        <label className="mb-2 block text-xs font-bold text-navy-950" htmlFor="query">
          Search by number, lyrics, meaning, or moment
        </label>
        <div className="flex gap-2">
          <input
            id="query"
            {...form.register("query")}
            placeholder="Try 1, bandhu he, or devotional dawn"
            className="min-w-0 flex-1 rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-navy-950 outline-none transition placeholder:text-stone-400 focus:border-gold-500"
          />
          <VoiceSearchButton onTranscript={({ transcript, language }) => {
            form.setValue("query", transcript, { shouldValidate: true })
            router.push(`/explore?q=${encodeURIComponent(transcript)}&mode=voice&lang=${encodeURIComponent(language)}`)
          }} />
        </div>
        <div className="min-h-5 pt-1">
          {form.formState.errors.query ? (
            <p className="text-sm text-red-700">{form.formState.errors.query.message}</p>
          ) : null}
          {mutation.isError ? <p role="alert" className="text-sm text-amber-800">{mutation.error.message}</p> : null}
        </div>
      </div>
      <button
        type="submit"
        data-feature="catalog_search"
        className="rounded-xl bg-navy-950 px-7 py-3 font-semibold text-white transition hover:bg-gold-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <LoadingIndicator label="Searching" compact /> : "Search"}
      </button>
    </form>
  )
}
