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

const fields: Array<{
  name: keyof FormValues
  label: string
  placeholder: string
}> = [
  { name: "date", label: "Date", placeholder: "2026-09-14" },
  { name: "day", label: "Day", placeholder: "Sunday" },
  { name: "occasion", label: "Occasion", placeholder: "meditation" },
  { name: "festival", label: "Festival", placeholder: "Prabháta Saḿgiita Divasa" },
  { name: "season", label: "Season", placeholder: "autumn" },
  { name: "mood", label: "Mood", placeholder: "peaceful" },
  { name: "language", label: "Language", placeholder: "Roman" },
  { name: "difficulty", label: "Difficulty", placeholder: "easy" },
  { name: "meditation_context", label: "Meditation context", placeholder: "morning meditation" },
]

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
      className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-slate-950/30 p-5 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-2 text-sm text-slate-100">
          <span className="text-[11px] uppercase tracking-[0.25em] text-slate-300">{field.label}</span>
          <input
            {...form.register(field.name)}
            placeholder={field.placeholder}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-slate-400 focus:border-ember-300"
          />
        </label>
      ))}
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
