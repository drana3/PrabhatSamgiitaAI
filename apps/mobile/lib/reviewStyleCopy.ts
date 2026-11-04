import type { ReviewStyle } from "@/lib/appearance"

/** Copy of the three word-review rhythms (prototype `SRS`, Main.dc.html around line 3180). */
export type ReviewStyleOption = {
  id: ReviewStyle
  name: string
  tag: string
  desc: string
  line: string
}

export const REVIEW_STYLE_OPTIONS: readonly ReviewStyleOption[] = [
  {
    id: "simple",
    name: "Simple steps",
    tag: "Easiest to follow",
    desc: "A fixed ladder. Every word comes back after 1, 3, 7, 14 and 30 days. Press Again and that word starts the ladder over. You always know what is coming.",
    line: "1d → 3d → 7d → 14d → 30d",
  },
  {
    id: "adaptive",
    name: "Adaptive",
    tag: "Fewest reviews",
    desc: "Like Anki. Every word gets its own gap: easy words come back later and later, hard words sooner. Less work over months, but the gaps differ from word to word.",
    line: "An easy word: 1d → 4d → 11d → 30d → 80d",
  },
  {
    id: "daily",
    name: "Daily practice",
    tag: "Best for one song",
    desc: "For a song you sing every day. Each word comes back tomorrow until you press Easy, then once a week. Short sessions, every day.",
    line: "1d → 1d → 1d → 7d",
  },
]

export const REVIEW_STYLE_TITLE = "How often do words come back?"
export const REVIEW_STYLE_INTRO = "Pick the rhythm that suits you. You can change it any time. Your progress stays."
export const REVIEW_STYLE_NOTE = "New to this? Start with Simple steps. Switch to Adaptive when you have fifty words or more."
