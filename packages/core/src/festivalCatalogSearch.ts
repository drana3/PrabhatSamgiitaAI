import { normalizeLyricText } from "./lyric-search"
import {
  allFestivalObservances,
  type FestivalObservance,
} from "./festivalObservances"

export const COLLECTION_SEARCH_PREFIX = "search prabhat samgiita for "

export function collectionSearchPrompt(label: string) {
  const trimmed = label.trim()
  return `Search Prabhat Samgiita for ${trimmed}`
}

export function observanceCollectionLabel(obs: FestivalObservance): string {
  return (obs.collectionLabel ?? obs.relatedCollectionLabel ?? "").trim()
}

export function festivalObservanceExploreQuery(obs: FestivalObservance): string {
  const label = observanceCollectionLabel(obs)
  if (!label) {
    return collectionSearchPrompt(obs.title)
  }
  return collectionSearchPrompt(label)
}

const OBSERVANCE_EXTRA_ALIASES: Record<string, string[]> = {
  "new-year-2027": ["new year's day", "new years day", "civil new year"],
  "navavarsa-2026": ["navavarsa", "navavarsh", "ananda marga new year"],
  "navavarsa-2027": ["navavarsa", "navavarsh", "ananda marga new year"],
  "diipavalii-2026": ["diwali", "deepavali", "dipavali"],
  "diipavalii-2027": ["diwali", "deepavali", "dipavali"],
  "ananda-purnima-2026": ["ananda purnima", "baba birthday", "bábá birthday"],
  "ananda-purnima-2027": ["ananda purnima", "ananda purrima", "baba birthday", "bábá birthday"],
  "ps-divasa-2026": [
    "prabhat samgiita divasa",
    "prabhata samgiita divasa",
    "prabhat samgiita day",
    "ps divasa",
  ],
  "shravanii-2026": ["shravanii purnima", "shravani purnima"],
  "shravanii-2027": ["shravanii purnima", "shravani purnima"],
  "vijayotsava-2026": ["vijayotsava", "victory day"],
  "vijayotsava-2027": ["vijayotsava", "victory day"],
  "sharadotsava-2026": ["sharadotsava", "children's day", "childrens day"],
  "sharadotsava-2027": ["sharadotsava", "children's day", "childrens day"],
  "kiirtana-2026": ["kiirtana divas", "kiirtan divas"],
  "prout-day-2026": ["prout day"],
  "vasantotsava-2026": ["vasantotsava"],
  "vasantotsava-2027": ["vasantotsava"],
  "ru-day-2026": ["ru day", "ru"],
  "niilakantha-2026": ["niilakantha", "nilakantha"],
  "dadhicii-2026": ["dadhicii", "dadicii"],
  "dadhicii-2027": ["dadhicii", "dadicii"],
  "kaoshiki-2026": ["kaoshiki"],
  "navanna-2026": ["navanna"],
  "navanna-2027": ["navanna"],
  "bhratrdvitiya-2026": ["bhratrdvitiya", "bhratr dvitiya", "brothers day"],
  "bhratrdvitiya-2027": ["bhratrdvitiya", "bhratr dvitiya", "brothers day"],
  "public-day-2026": ["public day", "national day"],
  "public-day-2027": ["public day", "national day"],
  "fine-arts-2026": ["fine arts day"],
  "fine-arts-2027": ["fine arts day"],
  "music-day-2026": ["music day"],
  "music-day-2027": ["music day"],
}

type ObservanceIndexEntry = {
  obs: FestivalObservance
  keys: string[]
}

function buildObservanceIndex(): ObservanceIndexEntry[] {
  return allFestivalObservances.map((obs) => {
    const keys = new Set<string>()
    const add = (value: string | undefined) => {
      const normalized = normalizeLyricText(value)
      if (normalized.length >= 3) keys.add(normalized)
    }
    add(obs.title)
    add(obs.festival)
    add(obs.meditation_context)
    add(observanceCollectionLabel(obs))
    for (const alias of OBSERVANCE_EXTRA_ALIASES[obs.id] ?? []) {
      add(alias)
    }
    return { obs, keys: [...keys] }
  })
}

const observanceIndex = buildObservanceIndex()

function stripCollectionFraming(query: string): string {
  const trimmed = query.trim()
  const lowered = trimmed.toLocaleLowerCase()
  if (lowered.startsWith(COLLECTION_SEARCH_PREFIX)) {
    return trimmed.slice(COLLECTION_SEARCH_PREFIX.length).trim()
  }
  return trimmed
}

function queryObservanceKeys(query: string): string[] {
  const core = stripCollectionFraming(query)
  const normalized = normalizeLyricText(core)
  if (!normalized) return []
  return normalized.split(" ").filter((token) => token.length >= 2)
}

export function findObservanceForSearchQuery(query: string): FestivalObservance | null {
  const normalized = normalizeLyricText(stripCollectionFraming(query))
  if (!normalized) return null

  let best: { obs: FestivalObservance; score: number } | null = null
  for (const entry of observanceIndex) {
    for (const key of entry.keys) {
      if (key === normalized) {
        const score = 100 + key.length
        if (!best || score > best.score) best = { obs: entry.obs, score }
        continue
      }
      if (normalized.includes(key) && key.length >= 4) {
        const score = 50 + key.length
        if (!best || score > best.score) best = { obs: entry.obs, score }
        continue
      }
      if (key.includes(normalized) && normalized.length >= 4) {
        const score = 40 + normalized.length
        if (!best || score > best.score) best = { obs: entry.obs, score }
      }
    }
  }

  if (best) return best.obs

  const tokens = queryObservanceKeys(query)
  if (tokens.length < 2) return null
  for (const entry of observanceIndex) {
    const joined = entry.keys.join(" ")
    if (tokens.every((token) => joined.includes(token))) {
      return entry.obs
    }
  }
  return null
}

export function observanceCollectionLabelForQuery(query: string): string | null {
  const byLabel = stripCollectionFraming(query)
  const exactObs = allFestivalObservances.find(
    (item) => normalizeLyricText(observanceCollectionLabel(item)) === normalizeLyricText(byLabel),
  )
  if (exactObs) return observanceCollectionLabel(exactObs)

  const obs = findObservanceForSearchQuery(query)
  if (!obs) return null
  const label = observanceCollectionLabel(obs)
  return label || null
}

export function observanceCatalogSongNumbers(obs: FestivalObservance): number[] | null {
  if (obs.catalogSongNumbers?.length) return [...obs.catalogSongNumbers]
  return null
}