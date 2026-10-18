import type { CommunityTestimonial } from "@/lib/api"

export function mergeCommunityVoices(fromApi: CommunityTestimonial[]): CommunityTestimonial[] {
  const seen = new Set<string>()
  const merged: CommunityTestimonial[] = []

  for (const item of fromApi) {
    const quote = item.quote_text.trim()
    if (quote.length < 8) continue
    const key = quote.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push({
      ...item,
      quote_text: quote,
      display_name: item.display_name.trim() || "Community member",
    })
  }

  return merged
}
