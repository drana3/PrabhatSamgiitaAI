import { allKirtans } from "@/lib/kirtan/catalog"
import { normalizeKind } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"

/**
 * Which recordings take a chord CHART over pasted text, like a Prabhat Samgiita song: a Bhajan and a Spiritual song. Never a
 * Kiirtan (its chords stay plain text; its words are mantra repeats), and not a Prabhat Samgiita recording (the song page has
 * its own charts). A Dance music and a Baba's Audio Discourse have no chords at all (`kindHasChords`). The API refuses a chart
 * for any other kind.
 */
export function kindHasCharts(kind: RecordingKind | string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k === "bhajan" || k === "spiritual_song"
}

/** The chart rule for a recording named by the id the API knows it by (the preview's in-memory server asks this). */
export function recordingHasCharts(recordingId: string): boolean {
  const found = allKirtans().find((k) => k.serverId === recordingId || k.id === recordingId)
  return kindHasCharts(found?.kind)
}
