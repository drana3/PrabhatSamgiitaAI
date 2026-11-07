import { splitLyricLines } from "@/lib/sargamDisplay"

export type ScriptId = "roman" | "devanagari" | "bengali"
export type ScriptChoice = ScriptId | "both"

export const SCRIPT_LABEL: Record<ScriptChoice, string> = {
  roman: "Roman",
  devanagari: "Devanagari",
  bengali: "Bengali",
  both: "Both",
}

export function detectScript(text: string | null | undefined): ScriptId {
  if (!text) return "roman"
  if (/[ऀ-ॿ]/.test(text)) return "devanagari"
  if (/[ঀ-৿]/.test(text)) return "bengali"
  return "roman"
}

/**
 * Catalog Roman text is sometimes stored in capitals (BUG-13). Convert a line
 * that is entirely upper case to sentence case; diacritics survive because
 * toLowerCase keeps them. A line that already has lower case is left alone.
 */
export function toSentenceCase(line: string): string {
  const letters = line.replace(/[^\p{L}]/gu, "")
  if (!letters || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return line
  const lower = line.toLowerCase()
  const index = lower.search(/\p{L}/u)
  if (index < 0) return lower
  return lower.slice(0, index) + lower.charAt(index).toUpperCase() + lower.slice(index + 1)
}

export type LyricSources = Record<ScriptId, string[]>

/** Sort the catalog texts by the script they are written in. First text of a script wins. */
export function buildLyricSources(input: {
  lyrics?: string | null
  transliteration?: string | null
  lyricsDevanagari?: string | null
}): LyricSources {
  const out: LyricSources = { roman: [], devanagari: [], bengali: [] }
  for (const text of [input.lyrics, input.transliteration, input.lyricsDevanagari]) {
    if (!text?.trim()) continue
    const script = detectScript(text)
    if (out[script].length) continue
    const lines = splitLyricLines(text)
    out[script] = script === "roman" ? lines.map(toSentenceCase) : lines
  }
  return out
}

/**
 * The stored text of each script, as the catalogue has it (blank lines and indentation kept), sorted the same way
 * as `buildLyricSources`: the first text of a script wins.
 */
export function lyricTextsByScript(input: {
  lyrics?: string | null
  transliteration?: string | null
  lyricsDevanagari?: string | null
}): Record<ScriptId, string | null> {
  const out: Record<ScriptId, string | null> = { roman: null, devanagari: null, bengali: null }
  for (const text of [input.lyrics, input.transliteration, input.lyricsDevanagari]) {
    if (!text?.trim()) continue
    const script = detectScript(text)
    if (out[script] === null) out[script] = text
  }
  return out
}

export function availableScripts(sources: LyricSources): ScriptId[] {
  return (["roman", "devanagari", "bengali"] as const).filter((id) => sources[id].length > 0)
}

/** The choice that can actually be shown: falls back to the first script the song has. */
export function resolveScript(choice: ScriptChoice, available: ScriptId[]): ScriptChoice {
  if (!available.length) return "roman"
  if (choice === "both") {
    return available.includes("roman") && available.length > 1 ? "both" : available[0]
  }
  return available.includes(choice) ? choice : available[0]
}

export type ScriptLines = {
  choice: ScriptChoice
  primaryScript: ScriptId
  primary: string[]
  /** the second script under each line, only for "both" */
  secondary: string[] | null
  secondaryScript: ScriptId | null
}

export function scriptLines(sources: LyricSources, choice: ScriptChoice): ScriptLines {
  const available = availableScripts(sources)
  const resolved = resolveScript(choice, available)
  if (resolved === "both") {
    const other = available.find((id) => id !== "roman") ?? "devanagari"
    return {
      choice: resolved,
      primaryScript: "roman",
      primary: sources.roman,
      secondary: sources[other],
      secondaryScript: other,
    }
  }
  return {
    choice: resolved,
    primaryScript: resolved,
    primary: sources[resolved] ?? [],
    secondary: null,
    secondaryScript: null,
  }
}
