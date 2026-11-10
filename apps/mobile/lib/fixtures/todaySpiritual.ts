import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * Made-up sample spiritual songs, ONLY for the web preview, so Today's spiritual shelves can be looked at before the
 * library holds real ones (the Kiirtan samples have none). Outside the preview (MOCKUP_DATA) the list is empty: a real build
 * never shows an invented recording. Names of people and groups are made up. No audio file: the demo engine simulates play.
 */
const DAY = 86_400_000
const T0 = Date.UTC(2026, 10, 1)
const sample = (id: string, title: string, author: string, minutes: number, daysAgo: number, language: string): Kirtan => ({
  id,
  kind: "spiritual_song",
  audioUrl: null,
  title,
  author,
  durationSec: minutes * 60,
  type: "other",
  thumbnailUrl: null,
  addedBy: author,
  status: "published",
  addedAt: T0 - daysAgo * DAY,
  language,
})

const SAMPLES: readonly Kirtan[] = [
  sample("sp-sample-1", "Light in the quiet hour", "Priya Devi", 4.5, 1, "english"),
  sample("sp-sample-2", "Walking toward the Beloved", "Sadhana Notes", 5.2, 2, "english"),
  sample("sp-sample-3", "A prayer before sleep", "Meera Group", 3.8, 3, "english"),
  sample("sp-sample-4", "Gratitude at the river", "Arun Deva", 6.1, 5, "english"),
  sample("sp-sample-5", "Open the window of the mind", "Sadhana Notes", 4.2, 7, "english"),
  sample("sp-sample-6", "Every morning the same song", "Festival Voices", 5.5, 9, "english"),
]

export function sampleSpiritualSongs(demo: boolean = MOCKUP_DATA): readonly Kirtan[] {
  return demo ? SAMPLES : []
}
