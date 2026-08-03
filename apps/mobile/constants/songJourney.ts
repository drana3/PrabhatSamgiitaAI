/**
 * UX model for song experiences
 * ----------------------------
 * A Prabhat Samgiita is never “just a play icon.”
 * Playback always sits on dawn / nature scenery.
 *
 * User jobs (clubbed):
 * 1. Listen → Lyrics & Meaning → Notation → Watch
 * 2. Ask AI — AI Companion always visible beside the song title
 * 3. Discover — Today, Festivals, Collections, Search
 * 4. Belong — Saved, Quiz, Feedback, Profile
 */

export const songJourneyTabs = [
  { id: "listen", label: "Listen", hint: "Audio" },
  { id: "understand", label: "Lyrics & Meaning", hint: "Words" },
  { id: "notation", label: "Notation", hint: "Harmonium" },
  { id: "watch", label: "Watch", hint: "Video" },
] as const

export type SongJourneyTab = (typeof songJourneyTabs)[number]["id"]

/** Watch / Notation chips only appear when the song actually has that media. */
export function visibleSongJourneyTabs(options: { hasVideo: boolean; hasNotation: boolean }) {
  return songJourneyTabs.filter((tab) => {
    if (tab.id === "watch") return options.hasVideo
    if (tab.id === "notation") return options.hasNotation
    return true
  })
}
