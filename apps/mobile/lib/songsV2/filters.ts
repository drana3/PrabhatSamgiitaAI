import type { CatalogEntry } from "./entry"

/**
 * Filters of the funnel icon (spec SCR-11 item 6): language, script, has
 * audio, duration. Applied filters show as removable text tokens.
 *
 * Rule: a value the catalog does not know yet is never a reason to hide a
 * song. A filter narrows only rows whose value is known.
 */
export type ScriptId = "roman" | "devanagari"
export type DurationBucket = "short" | "medium" | "long"

export type FilterState = {
  languages: string[]
  scripts: ScriptId[]
  hasAudio: boolean
  durations: DurationBucket[]
}

export const EMPTY_FILTERS: FilterState = { languages: [], scripts: [], hasAudio: false, durations: [] }

/** Under 3:00, 3:00 to 6:00, over 6:00. */
export const DURATION_BUCKETS: readonly { id: DurationBucket; label: string; minSeconds: number; maxSeconds: number }[] = [
  { id: "short", label: "Under 3 min", minSeconds: 0, maxSeconds: 180 },
  { id: "medium", label: "3 to 6 min", minSeconds: 180, maxSeconds: 360 },
  { id: "long", label: "Over 6 min", minSeconds: 360, maxSeconds: Number.POSITIVE_INFINITY },
]

export const SCRIPT_LABEL: Record<ScriptId, string> = { roman: "Roman", devanagari: "Devanagari" }

export function bucketFor(seconds: number): DurationBucket {
  const hit = DURATION_BUCKETS.find((b) => seconds >= b.minSeconds && seconds < b.maxSeconds)
  return hit ? hit.id : "long"
}

/** Distinct languages in the catalog, most common first. */
export function languageOptions(entries: readonly CatalogEntry[]): { language: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const e of entries) {
    if (e.language) counts.set(e.language, (counts.get(e.language) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count || a.language.localeCompare(b.language))
}

export function activeFilterCount(state: FilterState): number {
  return state.languages.length + state.scripts.length + (state.hasAudio ? 1 : 0) + state.durations.length
}

function matches(entry: CatalogEntry, state: FilterState): boolean {
  if (state.languages.length && entry.language && !state.languages.includes(entry.language)) return false
  if (state.scripts.length && entry.hasDevanagari != null) {
    const scripts: ScriptId[] = entry.hasDevanagari ? ["roman", "devanagari"] : ["roman"]
    // an AND over the selected scripts: Devanagari selected means the row must have it
    if (!state.scripts.every((s) => scripts.includes(s))) return false
  }
  if (state.hasAudio && entry.hasAudio === false) return false
  if (state.durations.length && entry.durationSeconds != null) {
    if (!state.durations.includes(bucketFor(entry.durationSeconds))) return false
  }
  return true
}

export function applyFilters(entries: readonly CatalogEntry[], state: FilterState): CatalogEntry[] {
  return activeFilterCount(state) === 0 ? [...entries] : entries.filter((e) => matches(e, state))
}

/** Keeps only rows whose number is in `numbers` (category and collection chips). */
export function restrictToNumbers(entries: readonly CatalogEntry[], numbers: ReadonlySet<number> | null): CatalogEntry[] {
  if (!numbers) return [...entries]
  return entries.filter((e) => numbers.has(e.number))
}

export type FilterToken = { id: string; label: string }

export function filterTokens(state: FilterState): FilterToken[] {
  const tokens: FilterToken[] = []
  for (const language of state.languages) tokens.push({ id: `lang:${language}`, label: language })
  for (const script of state.scripts) tokens.push({ id: `script:${script}`, label: SCRIPT_LABEL[script] })
  if (state.hasAudio) tokens.push({ id: "audio", label: "Has audio" })
  for (const bucket of state.durations) {
    tokens.push({ id: `dur:${bucket}`, label: DURATION_BUCKETS.find((b) => b.id === bucket)!.label })
  }
  return tokens
}

export function removeToken(state: FilterState, tokenId: string): FilterState {
  if (tokenId === "audio") return { ...state, hasAudio: false }
  const [kind, value] = tokenId.split(":")
  if (kind === "lang") return { ...state, languages: state.languages.filter((l) => l !== value) }
  if (kind === "script") return { ...state, scripts: state.scripts.filter((s) => s !== value) }
  if (kind === "dur") return { ...state, durations: state.durations.filter((d) => d !== value) }
  return state
}

function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function toggleLanguage(state: FilterState, language: string): FilterState {
  return { ...state, languages: toggled(state.languages, language) }
}
export function toggleScript(state: FilterState, script: ScriptId): FilterState {
  return { ...state, scripts: toggled(state.scripts, script) }
}
export function toggleDuration(state: FilterState, bucket: DurationBucket): FilterState {
  return { ...state, durations: toggled(state.durations, bucket) }
}
export function toggleHasAudio(state: FilterState): FilterState {
  return { ...state, hasAudio: !state.hasAudio }
}
