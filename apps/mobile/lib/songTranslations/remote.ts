import type { SongTranslation, SongTranslations, TranslationAlignment, TranslationKind, TranslationLabel } from "./types"
import { TRANSLATION_KINDS } from "./types"

/**
 * The phone's side of the public translations API (apps/api `GET /api/v1/song-translations/songs/{n}`). Plain `fetch`,
 * no React: the base URL and `fetch` are passed in, so tests run it against a fake server. The server decides what a
 * reader may see; nothing here filters or invents.
 */

export type WireSegment = { from: number; to: number | null; text: string }

/** `TranslationOut` of the API. */
export type WireTranslation = {
  id: string
  song_id: number
  kind: string
  language: string
  position: number
  alignment: string
  segments: WireSegment[]
  text: string
  label: string
  checked: boolean
  credit_line: string | null
  commentary: string | null
}

/** `TranslationList` of the API. */
export type WireList = { song_id: number; language: string; kinds: string[]; items: WireTranslation[] }

export type TranslationsConfig = { baseUrl: string; fetch?: typeof fetch }

const ALIGNMENTS: readonly TranslationAlignment[] = ["whole", "stanza", "line"]
const LABELS: readonly TranslationLabel[] = ["official", "checked", "reviewed"]

function isKind(value: string): value is TranslationKind {
  return (TRANSLATION_KINDS as readonly string[]).includes(value)
}

/** One text from the wire; null when it is not one this app knows how to show (an unknown kind, an empty text). */
export function translationFromWire(w: WireTranslation): SongTranslation | null {
  if (!isKind(w.kind)) return null
  const segments = (w.segments ?? []).filter((s) => typeof s?.text === "string" && s.text.trim()).map((s) => ({ from: s.from, to: s.to ?? null, text: s.text }))
  const text = (w.text ?? "").trim() || segments.map((s) => s.text.trim()).join("\n")
  if (!text) return null
  const alignment = (ALIGNMENTS as readonly string[]).includes(w.alignment) ? (w.alignment as TranslationAlignment) : "whole"
  const label = (LABELS as readonly string[]).includes(w.label) ? (w.label as TranslationLabel) : "reviewed"
  return {
    id: w.id,
    kind: w.kind,
    language: w.language,
    position: w.position,
    alignment,
    segments,
    text,
    // the "Checked" mark is true only when the server says the team checked it
    label,
    checked: w.checked === true && label === "checked",
    creditLine: w.credit_line?.trim() || null,
    commentary: w.commentary?.trim() || null,
    derived: false,
  }
}

export function listFromWire(w: WireList): SongTranslations {
  const items = (w.items ?? []).map(translationFromWire).filter((item): item is SongTranslation => item !== null)
  const kinds = TRANSLATION_KINDS.filter((kind) => items.some((item) => item.kind === kind))
  return { songId: w.song_id, language: w.language, kinds, items }
}

/** The translations of one song, or null when the server cannot be reached or does not have the endpoint yet. */
export async function fetchSongTranslations(config: TranslationsConfig, songNumber: number, language = "en"): Promise<SongTranslations | null> {
  const doFetch = config.fetch ?? fetch
  try {
    const response = await doFetch(`${config.baseUrl.replace(/\/+$/, "")}/api/v1/song-translations/songs/${songNumber}?language=${encodeURIComponent(language)}`, {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return null
    return listFromWire((await response.json()) as WireList)
  } catch {
    return null
  }
}
