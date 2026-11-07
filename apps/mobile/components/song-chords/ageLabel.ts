import { ageOf } from "@/lib/songChords/drafts"

type Say = (key: never, params?: Record<string, string | number>) => string

/** "just now", "5 minutes ago", "2 days ago" in the app's language (plural forms come from chordOffer.age.*). */
export function ageLabel(t: unknown, updatedAt: number, now: number): string {
  const say = t as Say
  const age = ageOf(updatedAt, now)
  if (age === "now") return say("chordOffer.age.now" as never)
  return say(`chordOffer.age.${age.unit}` as never, { count: age.count })
}
