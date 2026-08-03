"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { fetchTestimonials } from "@/lib/api"
import type { CommunityTestimonial } from "@/lib/api"
import { mergeCommunityVoices } from "@/lib/community-voices"

function TickerItem({ item }: { item: CommunityTestimonial }) {
  return (
    <span className="community-feedback-ticker__item">
      <span aria-hidden="true" className="text-gold-400">
        ✦
      </span>
      <span className="font-semibold text-gold-100">{item.display_name}</span>
      {item.display_location ? (
        <span className="text-gold-200/80"> · {item.display_location}</span>
      ) : null}
      <span className="text-ivory-100/95"> — “{item.quote_text}”</span>
    </span>
  )
}

export function CommunityFeedbackTicker() {
  const [items, setItems] = useState<CommunityTestimonial[]>([])

  const reload = useCallback(() => {
    void fetchTestimonials(20).then((fromApi) => setItems(mergeCommunityVoices(fromApi)))
  }, [])

  useEffect(() => {
    reload()
    const onFocus = () => reload()
    const onVisibility = () => {
      if (document.visibilityState === "visible") reload()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [reload])

  const track = useMemo(() => (items.length ? [...items, ...items] : []), [items])

  if (!track.length) return null

  return (
    <div
      className="community-feedback-ticker border-b border-gold-500/20 bg-gradient-to-r from-navy-950 via-[#0c3564] to-navy-950"
      aria-label="Community feedback about Prabhat Samgiita"
    >
      <p className="sr-only">
        Approved messages from devotees sharing how Prabhat Samgiita and this AI companion support
        their spiritual journey.
      </p>
      <div className="community-feedback-ticker__viewport">
        <div className="community-feedback-ticker__track">
          {track.map((item, index) => (
            <TickerItem key={`${item.display_name}-${item.quote_text}-${index}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
