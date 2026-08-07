"use client"

import { todayReflectionFallback, type ReflectionQuote } from "@prabhat/core"
import { useEffect, useState } from "react"

import { fetchTodayReflection } from "@/lib/api"

type DailyReflectionProps = {
  initialReflection?: ReflectionQuote
}

export function DailyReflection({ initialReflection }: DailyReflectionProps) {
  const [reflection, setReflection] = useState<ReflectionQuote>(
    initialReflection ?? todayReflectionFallback(),
  )

  useEffect(() => {
    void fetchTodayReflection().then((value) => {
      if (value) setReflection(value)
    })
  }, [])

  return (
    <article className="glass-card text-center">
      <p className="eyebrow">Today&apos;s reflection</p>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800">{reflection.context_label}</p>
      <blockquote className="mt-4 font-serif text-xl italic leading-8 text-navy-950">“{reflection.quote_text}”</blockquote>
      <p className="mt-3 text-xs font-semibold text-navy-950">— {reflection.attribution}</p>
      <a
        href={reflection.source_url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex text-[11px] font-medium text-gold-700 transition hover:text-gold-800"
      >
        {reflection.source_title}
        {reflection.source_date ? ` · ${reflection.source_date}` : ""}
      </a>
    </article>
  )
}
