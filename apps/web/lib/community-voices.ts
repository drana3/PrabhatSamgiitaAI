import type { CommunityTestimonial } from "@/lib/api"

export const FALLBACK_COMMUNITY_VOICES: CommunityTestimonial[] = [
  {
    display_name: "Ananda D.",
    display_location: "Kolkata, India",
    quote_text:
      "Prabhat Samgiita has become my morning anchor. The AI companion helps me sit with each line before meditation.",
  },
  {
    display_name: "Maria S.",
    display_location: "São Paulo, Brazil",
    quote_text:
      "I listen in Portuguese and ask questions in English — it feels like a gentle guide on my spiritual journey.",
  },
  {
    display_name: "Ravi K.",
    display_location: "Delhi, India",
    quote_text:
      "Searching lyrics and meanings in one place saves time. The grounded answers keep me close to the song's spirit.",
  },
  {
    display_name: "Elena V.",
    display_location: "Berlin, Germany",
    quote_text:
      "This AI tool helps me understand Prabhat Samgiita beyond translation — it connects the feeling to daily practice.",
  },
  {
    display_name: "Suresh M.",
    display_location: "Chennai, India",
    quote_text:
      "I save favourite songs to my playlist and return each evening. The companion explains what I could not grasp alone.",
  },
  {
    display_name: "James T.",
    display_location: "London, UK",
    quote_text:
      "As someone new to Prabhat Samgiita, the line-by-line explanations made my first month of listening deeply meaningful.",
  },
  {
    display_name: "Priya N.",
    display_location: "Mumbai, India",
    quote_text:
      "Verified audio and clear meanings — plus thoughtful AI replies — make this my trusted companion for sadhana.",
  },
  {
    display_name: "Carlos R.",
    display_location: "Mexico City, Mexico",
    quote_text:
      "The spiritual tone never feels robotic. It helps me reflect on how each song applies to my inner journey.",
  },
]

export function mergeCommunityVoices(
  fromApi: CommunityTestimonial[],
  minimum = 6,
): CommunityTestimonial[] {
  const fallbackQuoteKeys = new Set(
    FALLBACK_COMMUNITY_VOICES.map((item) => item.quote_text.trim().toLowerCase()),
  )
  const seen = new Set<string>()
  const merged: CommunityTestimonial[] = []

  for (const item of fromApi) {
    const key = item.quote_text.trim().toLowerCase()
    if (!key || seen.has(key) || fallbackQuoteKeys.has(key)) continue
    seen.add(key)
    merged.push(item)
  }

  for (const item of FALLBACK_COMMUNITY_VOICES) {
    if (merged.length >= Math.max(minimum, fromApi.length + 4)) break
    const key = item.quote_text.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }

  return merged.length ? merged : [...FALLBACK_COMMUNITY_VOICES]
}

export const COMMUNITY_FEEDBACK_EVENT = "prabhat-samgiita:community-feedback"

export type CommunityFeedbackSubmission = {
  display_name: string
  display_location?: string | null
  quote_text: string
}

export function publishCommunityFeedback(submission: CommunityFeedbackSubmission) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(COMMUNITY_FEEDBACK_EVENT, { detail: submission }),
  )
}
