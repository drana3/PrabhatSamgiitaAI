import { communityVoices } from "@/data/homeContent"

export type CommunityVoice = { id: string; quote: string; name: string }

export function mergeLiveVoices(
  rows: { quote_text: string; display_name: string; display_location?: string | null }[],
): CommunityVoice[] {
  const live: CommunityVoice[] = []
  const seen = new Set<string>()

  for (const [index, row] of rows.entries()) {
    const quote = row.quote_text.trim()
    if (quote.length < 8) continue
    const key = quote.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    live.push({
      id: `live-${index}-${key.slice(0, 24)}`,
      quote,
      name: row.display_location
        ? `${row.display_name} · ${row.display_location}`
        : row.display_name.trim() || "Community member",
    })
  }

  return live
}

export function voicesFingerprint(voices: CommunityVoice[]): string {
  return voices.map((voice) => `${voice.id}\0${voice.quote}\0${voice.name}`).join("\n")
}

export function nextVoiceIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return (index + 1) % count
}

export function clampVoiceIndex(index: number, count: number): number {
  if (count <= 0) return 0
  if (index >= 0 && index < count) return index
  return 0
}

export function isVoiceList(value: unknown): value is CommunityVoice[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item != null &&
        typeof item === "object" &&
        typeof (item as CommunityVoice).quote === "string" &&
        typeof (item as CommunityVoice).name === "string" &&
        (item as CommunityVoice).quote.trim().length >= 8,
    )
  )
}

export const FALLBACK_COMMUNITY_VOICES = communityVoices
