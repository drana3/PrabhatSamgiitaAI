"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { recommendSongs } from "@/lib/api"

const schema = z.object({
  date: z.string().optional(),
  day: z.string().optional(),
  occasion: z.string().optional(),
  festival: z.string().optional(),
  season: z.string().optional(),
  mood: z.string().optional(),
  language: z.string().optional(),
  difficulty: z.string().optional(),
  meditation_context: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function RecommendationForm({
  onResults,
}: {
  onResults: (results: Awaited<ReturnType<typeof recommendSongs>>) => void
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mood: "peaceful" },
  })
  const mutation = useMutation({
    mutationFn: (values: FormValues) => recommendSongs(values),
    onSuccess: onResults,
  })

  return (
    <form
      className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      {["date", "day", "occasion", "festival", "season", "mood", "language", "difficulty", "meditation_context"].map(
        (field) => (
          <label key={field} className="flex flex-col gap-2 text-sm text-ink-100">
            <span className="text-[11px] uppercase tracking-[0.25em] text-ink-300">
              {field.replaceAll("_", " ")}
            </span>
            <input
              {...form.register(field as keyof FormValues)}
              placeholder={field === "mood" ? "peaceful" : "Optional"}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-ink-300 focus:border-ember-300"
            />
          </label>
        ),
      )}
      <button
        type="submit"
        className="col-span-full rounded-2xl bg-gradient-to-r from-ember-500 to-amber-400 px-5 py-3 font-semibold text-white transition hover:from-ember-600 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Finding songs..." : "Recommend songs"}
      </button>
    </form>
  )
}
