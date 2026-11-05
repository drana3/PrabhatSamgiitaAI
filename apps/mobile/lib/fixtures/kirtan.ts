import type { Mix } from "@/lib/kirtan/mix"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Sample Kiirtans and mixes.
 * TODO(api): the Kiirtan catalog, the mixes and the review queue come from the backend, which does
 * not exist yet. The samples have no audio file (`audioUrl: null`): in the web preview the demo engine
 * simulates playback, on a device they show "no audio yet" until the authors' uploads exist. Names of
 * people and groups are made up.
 */

const DAY = 86_400_000
/** A fixed "now" so the sample list always sorts the same way. */
const T0 = Date.UTC(2026, 10, 1)

export const KIRTAN_FIXTURES: readonly Kirtan[] = [
  { id: "k-bnk-morning", audioUrl: null, title: "Baba Nam Kevalam, morning round", author: "Priya Devi", durationSec: 12 * 60 + 40, type: "bnk", thumbnailUrl: null, addedBy: "Priya", status: "approved", addedAt: T0 - 1 * DAY, plays: 920 },
  { id: "k-bnk-evening", audioUrl: null, title: "Baba Nam Kevalam, evening dharmacakra", author: "Dharmacakra Kiirtan", durationSec: 24 * 60 + 5, type: "bnk", thumbnailUrl: null, addedBy: "Arun", status: "approved", addedAt: T0 - 3 * DAY, plays: 1480 },
  { id: "k-bnk-short", audioUrl: null, title: "Baba Nam Kevalam, five minutes before meditation", author: "Sadhana Notes", durationSec: 5 * 60 + 12, type: "bnk", thumbnailUrl: null, addedBy: "Meera", status: "approved", addedAt: T0 - 5 * DAY, plays: 2210 },
  { id: "k-bnk-night", audioUrl: null, title: "Baba Nam Kevalam, slow and soft", author: "Priya Devi", durationSec: 18 * 60 + 30, type: "bnk", thumbnailUrl: null, addedBy: "Tomas", status: "approved", addedAt: T0 - 8 * DAY, plays: 640 },
  { id: "k-lila-krishna", audioUrl: null, title: "Lila kiirtan, Krishna and the flute", author: "Lila Kiirtan Group", durationSec: 9 * 60 + 15, type: "lila", thumbnailUrl: null, addedBy: "Priya", status: "approved", addedAt: T0 - 2 * DAY, plays: 770 },
  { id: "k-lila-shiva", audioUrl: null, title: "Lila kiirtan, Shiva in the mountains", author: "Lila Kiirtan Group", durationSec: 11 * 60 + 2, type: "lila", thumbnailUrl: null, addedBy: "Arun", status: "approved", addedAt: T0 - 10 * DAY, plays: 510 },
  { id: "k-lila-radha", audioUrl: null, title: "Lila kiirtan, Radha waits by the river", author: "Arun Deva", durationSec: 13 * 60 + 40, type: "lila", thumbnailUrl: null, addedBy: "Arun", status: "approved", addedAt: T0 - 6 * DAY, plays: 380 },
  { id: "k-dipavali", audioUrl: null, title: "Dipavali kiirtan, a night of lamps", author: "Festival Voices", durationSec: 31 * 60 + 48, type: "festival", thumbnailUrl: null, addedBy: "Meera", status: "approved", addedAt: T0 - 4 * DAY, plays: 1150 },
  { id: "k-purnima", audioUrl: null, title: "Buddha Purnima kiirtan", author: "Festival Voices", durationSec: 22 * 60 + 10, type: "festival", thumbnailUrl: null, addedBy: "Tomas", status: "approved", addedAt: T0 - 14 * DAY, plays: 430 },
  { id: "k-other-bhajan", audioUrl: null, title: "Evening kiirtan with harmonium and tabla", author: "Sadhana Notes", durationSec: 14 * 60 + 20, type: "other", thumbnailUrl: null, addedBy: "Priya", status: "approved", addedAt: T0 - 20 * DAY, plays: 290 },
  { id: "k-other-morning-raga", audioUrl: null, title: "Morning kiirtan on the harmonium alone", author: "Arun Deva", durationSec: 8 * 60 + 5, type: "other", thumbnailUrl: null, addedBy: "Arun", status: "approved", addedAt: T0 - 7 * DAY, plays: 205 },
  { id: "k-bnk-sleep", audioUrl: null, title: "Baba Nam Kevalam, one hour for sleep", author: "Dharmacakra Kiirtan", durationSec: 62 * 60, type: "bnk", thumbnailUrl: null, addedBy: "Tomas", status: "approved", addedAt: T0 - 9 * DAY, plays: 1760 },
  { id: "k-night-meditation", audioUrl: null, title: "Night kiirtan for long meditation", author: "Priya Devi", durationSec: 72 * 60 + 30, type: "other", thumbnailUrl: null, addedBy: "Priya", status: "approved", addedAt: T0 - 11 * DAY, plays: 980 },
  { id: "k-akhanda", audioUrl: null, title: "Akhanda kiirtan, an evening in full", author: "Festival Voices", durationSec: 95 * 60, type: "festival", thumbnailUrl: null, addedBy: "Meera", status: "approved", addedAt: T0 - 16 * DAY, plays: 560 },
]

/**
 * Where the person stopped in a few Kiirtans (seconds). TODO(api): resume positions come from the
 * listening history on the server; this is the preview's sample.
 */
export const KIIRTAN_RESUME_FIXTURES: readonly { id: string; positionSec: number }[] = [
  { id: "k-bnk-morning", positionSec: 4 * 60 + 18 },
  { id: "k-lila-krishna", positionSec: 3 * 60 + 5 },
]

/** In the preview one submission of "you" is already waiting for review. */
export const KIRTAN_PENDING_FIXTURE: Kirtan = {
  id: "sub-pendFix0010-1",
  audioUrl: null,
  title: "Baba Nam Kevalam at the summer retreat",
  author: "Retreat Recordings",
  durationSec: null,
  type: "bnk",
  thumbnailUrl: null,
  addedBy: "You",
  status: "pending",
  addedAt: T0,
}

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
