"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import { fetchTestimonials } from "@/lib/api"
import type { CommunityTestimonial } from "@/lib/api"

export function CommunityVoices() {
  const [items, setItems] = useState<CommunityTestimonial[]>([])
  const [active, setActive] = useState(0)
  useEffect(() => { void fetchTestimonials().then(setItems) }, [])
  useEffect(() => {
    if (items.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(() => setActive((value) => (value + 1) % items.length), 8000)
    return () => window.clearInterval(timer)
  }, [items.length])
  if (!items.length) return null
  const item = items[active]
  return (
    <section aria-labelledby="community-voices-title" className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6 lg:px-10">
      <div className="rounded-[2rem] border border-gold-500/20 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Voices from the community</p><h2 id="community-voices-title" className="mt-2 font-serif text-3xl text-navy-950">Prabhat Samgiita across the world</h2></div>{items.length > 1 ? <div className="flex gap-2"><button type="button" aria-label="Previous community voice" onClick={() => setActive((active - 1 + items.length) % items.length)} className="outline-button h-10 w-10 justify-center p-0">←</button><button type="button" aria-label="Next community voice" onClick={() => setActive((active + 1) % items.length)} className="outline-button h-10 w-10 justify-center p-0">→</button></div> : null}</div>
        <div className="mt-6 flex items-center gap-5">
          {item.avatar_url ? <Image src={item.avatar_url} alt="" width={72} height={72} className="h-16 w-16 rounded-full object-cover" /> : <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold-100 font-serif text-2xl text-gold-800">{item.display_name.slice(0, 1)}</span>}
          <div><blockquote className="font-serif text-xl leading-8 text-navy-950">“{item.quote_text}”</blockquote><p className="mt-3 text-sm font-semibold text-navy-950">{item.display_name}{item.display_location ? <span className="font-normal text-stone-600"> · {item.display_location}</span> : null}</p></div>
        </div>
      </div>
    </section>
  )
}
