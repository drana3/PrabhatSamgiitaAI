import type { Mix } from "@/lib/kirtan/mix"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Sample kirtans and mixes.
 * TODO(api): the kirtan catalog, the mixes and the review queue come from the backend, which does
 * not exist yet. The video ids below are PLACEHOLDERS (not real videos), so in the YouTube player
 * they show YouTube's "video unavailable" until real ids replace them. Names of people and
 * channels are made up.
 */

const DAY = 86_400_000
/** A fixed "now" so the sample list always sorts the same way. */
const T0 = Date.UTC(2026, 10, 1)

export const KIRTAN_FIXTURES: readonly Kirtan[] = [
  { id: "k-bnk-morning", videoId: "bnkMorn0001", title: "Baba Nam Kevalam, morning round", author: "Dharmacakra Kiirtan", durationSec: 12 * 60 + 40, type: "bnk", thumbnailUrl: null, addedBy: "Priya", status: "approved", addedAt: T0 - 1 * DAY },
  { id: "k-bnk-evening", videoId: "bnkEven0002", title: "Baba Nam Kevalam, evening dharmacakra", author: "Dharmacakra Kiirtan", durationSec: 24 * 60 + 5, type: "bnk", thumbnailUrl: null, addedBy: "Arun", status: "approved", addedAt: T0 - 3 * DAY },
  { id: "k-bnk-short", videoId: "bnkShrt0003", title: "Baba Nam Kevalam, five minutes before meditation", author: "Sadhana Notes", durationSec: 5 * 60 + 12, type: "bnk", thumbnailUrl: null, addedBy: "Meera", status: "approved", addedAt: T0 - 5 * DAY },
  { id: "k-bnk-night", videoId: "bnkNght0004", title: "Baba Nam Kevalam, slow and soft", author: "Dharmacakra Kiirtan", durationSec: 18 * 60 + 30, type: "bnk", thumbnailUrl: null, addedBy: "Tomas", status: "approved", addedAt: T0 - 8 * DAY },
  { id: "k-lila-krishna", videoId: "lilaKrsh005", title: "Lila kiirtan, Krishna and the flute", author: "Lila Kiirtan Group", durationSec: 9 * 60 + 15, type: "lila", thumbnailUrl: null, addedBy: "Priya", status: "approved", addedAt: T0 - 2 * DAY },
  { id: "k-lila-shiva", videoId: "lilaShiv006", title: "Lila kiirtan, Shiva in the mountains", author: "Lila Kiirtan Group", durationSec: 11 * 60 + 2, type: "lila", thumbnailUrl: null, addedBy: "Arun", status: "approved", addedAt: T0 - 10 * DAY },
  { id: "k-dipavali", videoId: "festDipa007", title: "Dipavali kiirtan, a night of lamps", author: "Festival Voices", durationSec: 31 * 60 + 48, type: "festival", thumbnailUrl: null, addedBy: "Meera", status: "approved", addedAt: T0 - 4 * DAY },
  { id: "k-purnima", videoId: "festPurn008", title: "Buddha Purnima kiirtan", author: "Festival Voices", durationSec: 22 * 60 + 10, type: "festival", thumbnailUrl: null, addedBy: "Tomas", status: "approved", addedAt: T0 - 14 * DAY },
  { id: "k-other-bhajan", videoId: "othrBhjn009", title: "Evening kiirtan with harmonium and tabla", author: "Sadhana Notes", durationSec: 14 * 60 + 20, type: "other", thumbnailUrl: null, addedBy: "Priya", status: "approved", addedAt: T0 - 20 * DAY },
]

/** In the preview one submission of "you" is already waiting for review. */
export const KIRTAN_PENDING_FIXTURE: Kirtan = {
  id: "sub-pendFix0010-1",
  videoId: "pendFix0010",
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
