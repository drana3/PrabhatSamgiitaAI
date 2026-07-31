"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { searchSongs } from "@/lib/api"

const schema = z.object({
  query: z.string().min(1, "Enter a song number, first line, or theme"),
})

type FormValues = z.infer<typeof schema>

export function SearchForm({ onResults }: { onResults: (results: Awaited<ReturnType<typeof searchSongs>>) => void }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { query: "" },
  })
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => searchSongs(values.query),
    onSuccess: onResults,
  })

  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border border-ink-200 bg-white/80 p-4 shadow-glow backdrop-blur md:flex-row"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium text-ink-700" htmlFor="query">
          Search by number, lyrics, or meaning
        </label>
        <input
          id="query"
          {...form.register("query")}
          placeholder="Try 1, bandhu he, or devotional dawn"
          className="w-full rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3 text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ember-400"
        />
        {form.formState.errors.query ? (
          <p className="mt-2 text-sm text-red-700">{form.formState.errors.query.message}</p>
        ) : null}
        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-ink-500">
          Exact number, lyrics, or meaning all work
        </p>
      </div>
      <button
        type="submit"
        className="rounded-2xl bg-ink-900 px-6 py-3 font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Searching..." : "Search"}
      </button>
    </form>
  )
}
