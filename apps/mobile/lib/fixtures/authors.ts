import type { AuthorProfilePublic } from "@/lib/authors/types"

/**
 * INVENTED author pages for the web preview (MOCKUP_DATA). Names, places and texts are made up. Every screen that
 * shows them also shows the "Demo" label (components/authors/DemoBadge.tsx). A real build never reaches this file's
 * data: lib/fixtures/authorsGate.ts returns an empty list outside the preview.
 */

export type DemoAuthor = {
  profile: AuthorProfilePublic
  /** the `author` text of the sample Kiirtans (lib/fixtures/kirtan.ts) that belong on this page */
  authorText: string
}

/** Plays per week for the sample pages: `plays` oldest first, the last week ending on `end` (the preview's "today"). */
function weeks(end: string, plays: number[]): { start: string; plays: number }[] {
  const last = Date.parse(`${end}T00:00:00Z`)
  return plays.map((n, i) => ({ start: new Date(last - (7 * (plays.length - i) - 1) * 86_400_000).toISOString().slice(0, 10), plays: n }))
}

const BASE = {
  links: [] as AuthorProfilePublic["links"],
  collections_count: 0,
  published_at: "2026-09-01T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
  indexable: true,
} as const

export const DEMO_AUTHORS: readonly DemoAuthor[] = [
  {
    authorText: "Priya Devi",
    profile: {
      ...BASE,
      slug: "priya-devi",
      display_name: "Priya Devi",
      author_type: "solo",
      bio: "Leads morning and night kiirtan in a small group. One take, a harmonium and a tabla.",
      about: "Priya sings at home, early, before the street wakes up.\n\nShe started with the Baba Nam Kevalam rounds and slowly added lila kiirtans and bhajans.",
      country: "Poland",
      city: "Warsaw",
      languages: ["english", "sanskrit"],
      links: [{ kind: "youtube", url: "https://youtube.com/@demo-priya", rel: "nofollow ugc noopener noreferrer" }],
      verified: false,
      kinds: [
        { kind: "kiirtan", count: 3 },
        { kind: "bhajan", count: 1 },
      ],
      recordings_count: 4,
      photo_url: null,
      stats: { enough_data: true, counting_since: "2026-09-01", monthly_listeners: 312, total_plays: 1840, weeks: weeks("2026-11-01", [90, 110, 140, 160, 190, 230, 270, 300, 350]) },
    },
  },
  {
    authorText: "Dharmacakra Kiirtan",
    profile: {
      ...BASE,
      slug: "dharmacakra",
      display_name: "Dharmacakra Kiirtan",
      author_type: "group",
      bio: "A group that sings Baba Nam Kevalam in long rounds at the weekly dharmacakra.",
      about: "Recordings made for meditation and sleep.",
      country: "Spain",
      city: null,
      languages: ["spanish", "sanskrit"],
      verified: true,
      kinds: [{ kind: "kiirtan", count: 2 }],
      recordings_count: 2,
      photo_url: null,
      stats: { enough_data: true, counting_since: "2026-08-12", monthly_listeners: 954, total_plays: 5210, weeks: weeks("2026-11-01", [200, 260, 310, 350, 380, 420, 450, 470, 500, 520, 560, 790]) },
    },
  },
  {
    authorText: "Arun Deva",
    profile: {
      ...BASE,
      slug: "arun-deva",
      display_name: "Arun Deva",
      author_type: "solo",
      bio: "Harmonium and short lila kiirtans, mostly recorded early in the morning.",
      about: "",
      country: "India",
      city: "Pune",
      languages: ["hindi", "bengali"],
      verified: false,
      kinds: [{ kind: "kiirtan", count: 2 }],
      recordings_count: 2,
      photo_url: null,
      stats: { enough_data: false, counting_since: "2026-10-30", monthly_listeners: null, total_plays: null },
    },
  },
  {
    authorText: "Sadhana Notes",
    profile: {
      ...BASE,
      slug: "sadhana-notes",
      display_name: "Sadhana Notes",
      author_type: "group",
      bio: "Short, quiet kiirtans to sit down with before meditation.",
      about: "",
      country: null,
      city: null,
      languages: ["english"],
      verified: false,
      kinds: [{ kind: "kiirtan", count: 2 }],
      recordings_count: 2,
      photo_url: null,
      // counting began two weeks ago: too short for a line, so the page falls back to one text line
      stats: { enough_data: true, counting_since: "2026-10-20", monthly_listeners: 128, total_plays: 604, weeks: weeks("2026-11-01", [180, 424]) },
    },
  },
]
