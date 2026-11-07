import type { Mix } from "@/lib/kirtan/mix"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Sample Kiirtans, Bhajans and mixes (one list, `kind` tells them apart).
 * TODO(api): the Kiirtan catalog, the mixes and the review queue come from the backend, which does
 * not exist yet. The samples have no audio file (`audioUrl: null`): in the web preview the demo engine
 * simulates playback, on a device they show "no audio yet" until the authors' uploads exist. Names of
 * people and groups are made up.
 */

const DAY = 86_400_000
/** A fixed "now" so the sample list always sorts the same way. */
const T0 = Date.UTC(2026, 10, 1)
/** Who added the sample Bhajans (uploaded by the team). */
const BHAJAN_TEAM = "Ananda Marga team"

export const KIRTAN_FIXTURES: readonly Kirtan[] = [
  { id: "k-bnk-morning", kind: "kiirtan", audioUrl: null, title: "Baba Nam Kevalam, morning round", author: "Priya Devi", durationSec: 12 * 60 + 40, type: "bnk", thumbnailUrl: null, addedBy: "Priya", status: "published", addedAt: T0 - 1 * DAY, plays: 920 },
  { id: "k-bnk-evening", kind: "kiirtan", audioUrl: null, title: "Baba Nam Kevalam, evening dharmacakra", author: "Dharmacakra Kiirtan", durationSec: 24 * 60 + 5, type: "bnk", thumbnailUrl: null, addedBy: "Arun", status: "published", addedAt: T0 - 3 * DAY, plays: 1480 },
  { id: "k-bnk-short", kind: "kiirtan", audioUrl: null, title: "Baba Nam Kevalam, five minutes before meditation", author: "Sadhana Notes", durationSec: 5 * 60 + 12, type: "bnk", thumbnailUrl: null, addedBy: "Meera", status: "published", addedAt: T0 - 5 * DAY, plays: 2210 },
  { id: "k-bnk-night", kind: "kiirtan", audioUrl: null, title: "Baba Nam Kevalam, slow and soft", author: "Priya Devi", durationSec: 18 * 60 + 30, type: "bnk", thumbnailUrl: null, addedBy: "Tomas", status: "published", addedAt: T0 - 8 * DAY, plays: 640 },
  { id: "k-lila-krishna", kind: "kiirtan", audioUrl: null, title: "Lila kiirtan, Krishna and the flute", author: "Lila Kiirtan Group", durationSec: 9 * 60 + 15, type: "lila", thumbnailUrl: null, addedBy: "Priya", status: "published", addedAt: T0 - 2 * DAY, plays: 770 },
  { id: "k-lila-shiva", kind: "kiirtan", audioUrl: null, title: "Lila kiirtan, Shiva in the mountains", author: "Lila Kiirtan Group", durationSec: 11 * 60 + 2, type: "lila", thumbnailUrl: null, addedBy: "Arun", status: "published", addedAt: T0 - 10 * DAY, plays: 510 },
  { id: "k-lila-radha", kind: "kiirtan", audioUrl: null, title: "Lila kiirtan, Radha waits by the river", author: "Arun Deva", durationSec: 13 * 60 + 40, type: "lila", thumbnailUrl: null, addedBy: "Arun", status: "published", addedAt: T0 - 6 * DAY, plays: 380 },
  { id: "k-dipavali", kind: "kiirtan", audioUrl: null, title: "Dipavali kiirtan, a night of lamps", author: "Festival Voices", durationSec: 31 * 60 + 48, type: "festival", thumbnailUrl: null, addedBy: "Meera", status: "published", addedAt: T0 - 4 * DAY, plays: 1150 },
  { id: "k-purnima", kind: "kiirtan", audioUrl: null, title: "Buddha Purnima kiirtan", author: "Festival Voices", durationSec: 22 * 60 + 10, type: "festival", thumbnailUrl: null, addedBy: "Tomas", status: "published", addedAt: T0 - 14 * DAY, plays: 430 },
  { id: "k-other-bhajan", kind: "kiirtan", audioUrl: null, title: "Evening kiirtan with harmonium and tabla", author: "Sadhana Notes", durationSec: 14 * 60 + 20, type: "other", thumbnailUrl: null, addedBy: "Priya", status: "published", addedAt: T0 - 20 * DAY, plays: 290 },
  { id: "k-other-morning-raga", kind: "kiirtan", audioUrl: null, title: "Morning kiirtan on the harmonium alone", author: "Arun Deva", durationSec: 8 * 60 + 5, type: "other", thumbnailUrl: null, addedBy: "Arun", status: "published", addedAt: T0 - 7 * DAY, plays: 205 },
  { id: "k-bnk-sleep", kind: "kiirtan", audioUrl: null, title: "Baba Nam Kevalam, one hour for sleep", author: "Dharmacakra Kiirtan", durationSec: 62 * 60, type: "bnk", thumbnailUrl: null, addedBy: "Tomas", status: "published", addedAt: T0 - 9 * DAY, plays: 1760 },
  { id: "k-night-meditation", kind: "kiirtan", audioUrl: null, title: "Night kiirtan for long meditation", author: "Priya Devi", durationSec: 72 * 60 + 30, type: "other", thumbnailUrl: null, addedBy: "Priya", status: "published", addedAt: T0 - 11 * DAY, plays: 980 },
  { id: "k-akhanda", kind: "kiirtan", audioUrl: null, title: "Akhanda kiirtan, an evening in full", author: "Festival Voices", durationSec: 95 * 60, type: "festival", thumbnailUrl: null, addedBy: "Meera", status: "published", addedAt: T0 - 16 * DAY, plays: 560 },

  // Bhajans. TODO(api): the four below are real recordings from the team's folder (/Users/dada/Downloads,
  // lengths read from the files). Their author is not known, so `author` is empty and the rows say "added by
  // Ananda Marga team"; the type is a preview guess. No audio file is wired: the preview's demo engine only
  // simulates playback (see docs/bhajans.md), so `audioUrl` stays null until the upload API serves the files.
  { id: "b-sweetest-word", kind: "bhajan", audioUrl: null, title: "The sweetest word", author: "", durationSec: 282.55, type: "devotional", thumbnailUrl: null, addedBy: BHAJAN_TEAM, status: "published", addedAt: T0 - 1 * DAY },
  { id: "b-day-will-dawn", kind: "bhajan", audioUrl: null, title: "Soon the day will dawn", author: "", durationSec: 192.3, type: "morning", thumbnailUrl: null, addedBy: BHAJAN_TEAM, status: "published", addedAt: T0 - 2 * DAY },
  { id: "b-once-there-was", kind: "bhajan", audioUrl: null, title: "Once there was a day", author: "", durationSec: 259.72, type: "devotional", thumbnailUrl: null, addedBy: BHAJAN_TEAM, status: "published", addedAt: T0 - 3 * DAY },
  { id: "b-many-thousand-years", kind: "bhajan", audioUrl: null, title: "Many Thousand Years Ago", author: "", durationSec: 592.05, type: "other", thumbnailUrl: null, addedBy: BHAJAN_TEAM, status: "published", addedAt: T0 - 4 * DAY },

  // TODO(api): made-up sample Bhajans by the sample artists, so the shelves, the type cards and the artist page show both kinds.
  { id: "b-morning-harmonium", kind: "bhajan", audioUrl: null, title: "Morning bhajan on the harmonium", author: "Priya Devi", durationSec: 6 * 60 + 10, type: "morning", thumbnailUrl: null, addedBy: "Priya", status: "published", addedAt: T0 - 5 * DAY, plays: 640 },
  { id: "b-evening-request", kind: "bhajan", audioUrl: null, title: "Evening bhajan, a quiet request", author: "Sadhana Notes", durationSec: 7 * 60 + 45, type: "evening", thumbnailUrl: null, addedBy: "Meera", status: "published", addedAt: T0 - 6 * DAY, plays: 410 },
  { id: "b-festival-lamps", kind: "bhajan", audioUrl: null, title: "A bhajan for the festival of lamps", author: "Festival Voices", durationSec: 5 * 60 + 30, type: "devotional", thumbnailUrl: null, addedBy: "Tomas", status: "published", addedAt: T0 - 7 * DAY, plays: 530 },

  // TODO(api): made-up samples of the newer kind, so the preview's chips and rows show them (preview only).
  { id: "d-evening-prayer", kind: "bhajan", audioUrl: null, title: "An evening prayer in song", author: "Sadhana Notes", durationSec: 5 * 60 + 5, type: "other", thumbnailUrl: null, addedBy: "Meera", status: "published", addedAt: T0 - 4 * DAY, plays: 220, language: "english", credits: "Words and music by the group" },
  { id: "p-ps-1-harmonium", kind: "prabhat_samgiita", audioUrl: null, title: "Prabhat Samgiita 1, soft harmonium", author: "Priya Devi", durationSec: 4 * 60 + 40, type: "other", thumbnailUrl: null, addedBy: "Priya", status: "published", addedAt: T0 - 2 * DAY, plays: 90, language: "bengali", psSong: 1 },
]

/**
 * Where the person stopped in a few Kiirtans (seconds). TODO(api): resume positions come from the
 * listening history on the server; this is the preview's sample.
 */
export const KIIRTAN_RESUME_FIXTURES: readonly { id: string; positionSec: number }[] = [
  { id: "k-bnk-morning", positionSec: 4 * 60 + 18 },
  { id: "k-lila-krishna", positionSec: 3 * 60 + 5 },
]

/**
 * In the preview "You" has already uploaded two recordings: one is live (published at once, as every upload is)
 * and one was removed by the team after it was looked at, with the reason, so "My uploads" shows both states.
 */
export const KIRTAN_DEMO_UPLOADS: readonly Kirtan[] = [
  {
    id: "sub-retreat-kevalam-1",
    kind: "kiirtan",
    audioUrl: null,
    title: "Baba Nam Kevalam at the summer retreat",
    author: "Retreat Recordings",
    durationSec: 16 * 60 + 20,
    type: "other",
    byAuthor: true,
    thumbnailUrl: null,
    addedBy: "You",
    status: "published",
    addedAt: T0 - 2 * DAY,
    plays: 14,
  },
  {
    id: "sub-studio-track-1",
    kind: "bhajan",
    audioUrl: null,
    title: "Studio track, mixed",
    author: "Dada",
    durationSec: 4 * 60 + 5,
    type: "other",
    byAuthor: false,
    thumbnailUrl: null,
    addedBy: "You",
    status: "removed",
    removedReason: "It is a commercial recording, and we cannot share it without the owner's permission.",
    removedAt: T0 - 1 * DAY,
    addedAt: T0 - 3 * DAY,
  },
  {
    id: "sub-morning-copy-1",
    kind: "kiirtan",
    audioUrl: null,
    title: "Baba Nam Kevalam, morning (my copy)",
    author: "Priya Devi",
    durationSec: 12 * 60 + 40,
    type: "other",
    byAuthor: false,
    thumbnailUrl: null,
    addedBy: "You",
    status: "removed",
    removedReason: "This is the same recording as one already in the app. Please listen to the original.",
    removedAt: T0 - 1 * DAY,
    addedAt: T0 - 4 * DAY,
    duplicateOf: { id: "k-bnk-morning", title: "Baba Nam Kevalam, morning round", author: "Priya Devi" },
  },
]

/** The four system mixes, in the order the Mixes segment shows them. PS ids are catalog numbers. */
export const MIX_FIXTURES: readonly Mix[] = [
  {
    id: "morning",
    title: "Morning",
    blurb: "Three songs and two kiirtans to begin the day",
    tone: "orange",
    cover: "lake",
    items: [
      { kind: "ps", number: 2 },
      { kind: "ps", number: 3 },
      { kind: "kirtan", id: "k-bnk-morning" },
      { kind: "ps", number: 1 },
      { kind: "kirtan", id: "k-lila-krishna" },
    ],
  },
  {
    id: "dipavali",
    title: "Dipavali",
    blurb: "Songs and a long kiirtan for the festival of light",
    tone: "gold",
    cover: "garland",
    items: [
      { kind: "ps", number: 4 },
      { kind: "kirtan", id: "k-dipavali" },
      { kind: "ps", number: 6 },
      { kind: "kirtan", id: "k-bnk-evening" },
    ],
  },
  {
    id: "evening",
    title: "Evening meditation",
    blurb: "Slow songs, then a quiet kiirtan",
    tone: "sage",
    cover: "lotus",
    items: [
      { kind: "ps", number: 7 },
      { kind: "ps", number: 5 },
      { kind: "kirtan", id: "k-bnk-short" },
      { kind: "ps", number: 6 },
    ],
  },
  {
    id: "bnk",
    title: "Kiirtan only: Baba Nam Kevalam",
    blurb: "Four rounds of the mantra, nothing else",
    tone: "forest",
    cover: "seated",
    items: [
      { kind: "kirtan", id: "k-bnk-short" },
      { kind: "kirtan", id: "k-bnk-morning" },
      { kind: "kirtan", id: "k-bnk-night" },
      { kind: "kirtan", id: "k-bnk-evening" },
    ],
  },
]
