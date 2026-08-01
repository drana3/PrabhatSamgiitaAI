"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"

import { searchSongs } from "@/lib/api"
import { LoadingIndicator } from "@/components/loading-indicator"
import { extractSongSearchIntent, songIntentPath } from "@/lib/search-intent"

const schema = z.object({
  query: z.string().min(1, "Enter a song number, first line, or theme"),
})

type FormValues = z.infer<typeof schema>

export function SearchForm({ onResults, initialQuery = "" }: { onResults: (results: Awaited<ReturnType<typeof searchSongs>>) => void; initialQuery?: string }) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { query: initialQuery },
  })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => searchSongs(values.query),
    onSuccess: onResults,
  })

  function submit(values: FormValues) {
    const songIntent = extractSongSearchIntent(values.query)
    if (songIntent) {
      router.push(songIntentPath(songIntent))
      return
    }
    mutation.mutate(values)
  }

  useEffect(() => {
    if (initialQuery) submit({ query: initialQuery })
    // The URL query is intentionally executed once when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-navy-900/10 bg-white p-3 shadow-sm md:flex-row md:items-end"
      onSubmit={form.handleSubmit(submit)}
    >
      <div className="flex-1">
        <label className="mb-2 block text-xs font-bold text-navy-950" htmlFor="query">
          Search by number, lyrics, meaning, or moment
        </label>
        <input
          id="query"
          {...form.register("query")}
          placeholder="Try 1, bandhu he, or devotional dawn"
          className="w-full rounded-xl border border-navy-900/10 bg-ivory-50 px-4 py-3 text-navy-950 outline-none transition placeholder:text-stone-400 focus:border-gold-500"
        />
        {form.formState.errors.query ? (
          <p className="mt-2 text-sm text-red-700">{form.formState.errors.query.message}</p>
        ) : null}
        {mutation.isError ? <p role="alert" className="mt-2 text-sm text-amber-800">{mutation.error.message}</p> : null}
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
