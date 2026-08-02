"use client"

import { useEffect, useState } from "react"

import { fetchTodayReflection } from "@/lib/api"
import type { ReflectionQuote } from "@/lib/api"

const fallback: ReflectionQuote = {
  quote_text: "As one thinks, so one becomes.",
  attribution: "Shrii Shrii Anandamurti ji",
  source_title: "Meditation",
  source_url: "https://www.anandamarga.org/articles/meditation/",
  context_label: "Daily spiritual reflection",
  verification_status: "source_verified",
}

export function DailyReflection() {
  const [reflection, setReflection] = useState(fallback)
  useEffect(() => { void fetchTodayReflection().then((value) => { if (value) setReflection(value) }) }, [])
  return (
    <article className="glass-card text-center">
      <p className="eyebrow">Today&apos;s reflection</p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800">{reflection.context_label}</p>
      <blockquote className="mt-4 font-serif text-xl italic leading-8 text-navy-950">“{reflection.quote_text}”</blockquote>
      <p className="mt-3 text-xs font-semibold text-navy-950">{reflection.attribution}</p>
      <a href={reflection.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[11px] text-stone-600 underline decoration-gold-400 underline-offset-4">Source: {reflection.source_title}{reflection.source_date ? `, ${reflection.source_date}` : ""}</a>
      <div className="mx-auto mt-4 h-px w-24 bg-gold-400" />
    </article>
  )
}
