"use client"

import { useEffect, useMemo, useState } from "react"

import { fetchTestimonials } from "@/lib/api"
import type { CommunityTestimonial } from "@/lib/api"
import {
  COMMUNITY_FEEDBACK_EVENT,
  mergeCommunityVoices,
  type CommunityFeedbackSubmission,
} from "@/lib/community-voices"

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
  const [apiItems, setApiItems] = useState<CommunityTestimonial[]>([])
  const [liveItems, setLiveItems] = useState<CommunityTestimonial[]>([])

  useEffect(() => {
    void fetchTestimonials().then(setApiItems)
  }, [])

  useEffect(() => {
    function onFeedback(event: Event) {
      const detail = (event as CustomEvent<CommunityFeedbackSubmission>).detail
      if (!detail?.quote_text?.trim()) return
      setLiveItems((current) => [
        {
          display_name: detail.display_name,
          display_location: detail.display_location ?? null,
          quote_text: detail.quote_text.trim(),
        },
        ...current,
      ])
    }

    window.addEventListener(COMMUNITY_FEEDBACK_EVENT, onFeedback)
    return () => window.removeEventListener(COMMUNITY_FEEDBACK_EVENT, onFeedback)
  }, [])

  const items = useMemo(
    () => mergeCommunityVoices([...liveItems, ...apiItems]),
    [apiItems, liveItems],
  )

  if (!items.length) return null

  const track = [...items, ...items]

  return (
    <div
      className="community-feedback-ticker border-b border-gold-500/20 bg-gradient-to-r from-navy-950 via-[#0c3564] to-navy-950"
      aria-label="Community feedback about Prabhat Samgiita"
    >
      <p className="sr-only">
        Scrolling messages from devotees sharing how Prabhat Samgiita and this AI companion support
        their spiritual journey.
      </p>
      <div className="community-feedback-ticker__viewport">
        <div className="community-feedback-ticker__track">
          {track.map((item, index) => (
            <TickerItem key={`${item.display_name}-${index}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
