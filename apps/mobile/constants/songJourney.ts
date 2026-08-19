/**
 * UX model for song experiences
 * ----------------------------
 * A Prabhat Samgiita is never “just a play icon.”
 * Playback always sits on dawn / nature scenery.
 *
 * User jobs:
 * 1. Learn — Lyrics & Meaning, Notation
 * 2. Media — Listen (audio), Watch (video)
 * 3. Ask AI — AI Companion beside the song title
 * 4. Discover — Today, Festivals, Collections, Search
 * 5. Belong — Saved, Quiz, Feedback, Profile
 */

export const songJourneyLearnTabs = [
  { id: "understand", label: "Lyrics & Meaning", hint: "Words" },
  { id: "notation", label: "Notation", hint: "Harmonium" },
] as const

export const songJourneyMediaTabs = [
  { id: "listen", label: "Listen", hint: "Audio" },
  { id: "watch", label: "Watch", hint: "Video" },
] as const

export const songJourneyTabs = [...songJourneyLearnTabs, ...songJourneyMediaTabs] as const

export type SongJourneyTab = (typeof songJourneyTabs)[number]["id"]

const MEDIA_TAB_IDS = new Set<string>(songJourneyMediaTabs.map((tab) => tab.id))

export function isMediaSongJourneyTab(id: SongJourneyTab): boolean {
  return MEDIA_TAB_IDS.has(id)
}

/** Width of one chip set plus the same gap used between Notation and Listen, and at the loop join. */
export function journeyMarqueeCycleWidth(setWidth: number, gap: number) {
  return Math.max(0, setWidth) + Math.max(0, gap)
}

export function partitionSongJourneyTabs<T extends { id: SongJourneyTab }>(tabs: readonly T[]) {
  return {
    learn: tabs.filter((tab) => !isMediaSongJourneyTab(tab.id)),
    media: tabs.filter((tab) => isMediaSongJourneyTab(tab.id)),
  }
}

/** Watch / Notation chips only appear when the song actually has that media. */
export function visibleSongJourneyTabs(options: { hasVideo: boolean; hasNotation: boolean }) {
  return songJourneyTabs.filter((tab) => {
    if (tab.id === "watch") return options.hasVideo
    if (tab.id === "notation") return options.hasNotation
    return true
  })
}

/** Keep the video player mounted while leaving Watch, at full size off-screen. */
export function songWatchLayout(
  journey: SongJourneyTab,
  options: { hasVideo: boolean; watchPlaying: boolean },
) {
  const showPlayer = options.hasVideo && (journey === "watch" || options.watchPlaying)
  return {
    showPlayer,
    collapsePlayer: showPlayer && journey !== "watch",
    showKeepAliveBar: options.hasVideo && options.watchPlaying && journey !== "watch",
  }
}
