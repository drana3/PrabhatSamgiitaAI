import { TRANSLATION_KINDS, type SongTranslation, type SongTranslations, type TranslationKind } from "./types"

/**
 * What the song page decides from the translations of a song. Pure rules, no React.
 */

/** The line of dashes that joins a second official version to the first on the official lyrics page. */
const VERSION_BREAK = /^[ \t]*-{3,}[ \t]*$/m

/** The versions of a raw official text, in order: both are kept, a blank one is dropped. */
export function splitOfficialVersions(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return []
  const unified = raw.replace(/\r\n?/g, "\n")
  return unified
    .split(new RegExp(VERSION_BREAK.source, "gm"))
    .map((part) =>
      part
        .split("\n")
        .map((line) => line.replace(/\s+$/, ""))
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
}

/**
 * The official translations made from the catalogue's own text, for a song the API has no rows for yet (before the
 * import ran, or when the endpoint cannot be reached). The same split the import makes; shown the same way.
 */
export function officialFromRaw(songId: number, raw: string | null | undefined): SongTranslation[] {
  return splitOfficialVersions(raw).map((text, position) => ({
    id: `derived-official-${songId}-${position}`,
    kind: "official",
    language: "en",
    position,
    alignment: "whole",
    segments: [{ from: 0, to: null, text }],
    text,
    label: "official",
    checked: false,
    creditLine: null,
    commentary: null,
    derived: true,
  }))
}

/** The translations the page works with: the API's, with the official text filled in from the catalogue when it has none. */
export function mergeTranslations(input: { songId: number; remote: SongTranslations | null; officialRaw: string | null | undefined }): SongTranslations {
  const { songId, remote, officialRaw } = input
  const items = [...(remote?.items ?? [])]
  if (!items.some((item) => item.kind === "official")) items.push(...officialFromRaw(songId, officialRaw))
  return { songId, language: remote?.language ?? "en", kinds: kindsOf(items), items: sorted(items) }
}

function sorted(items: readonly SongTranslation[]): SongTranslation[] {
  const rank = (kind: TranslationKind) => TRANSLATION_KINDS.indexOf(kind)
  return [...items].sort((a, b) => rank(a.kind) - rank(b.kind) || a.position - b.position)
}

/** The kinds that have a text, in the page's order. */
export function kindsOf(items: readonly Pick<SongTranslation, "kind">[]): TranslationKind[] {
  return TRANSLATION_KINDS.filter((kind) => items.some((item) => item.kind === kind))
}

/**
 * The kind the Translation page opens on: the reader's own choice when the song has it, otherwise Official, then
 * Literal, then Poetic. Poetic is never the default.
 */
export function pickKind(preferred: TranslationKind | null | undefined, kinds: readonly TranslationKind[]): TranslationKind | null {
  if (preferred && kinds.includes(preferred)) return preferred
  for (const kind of ["official", "literal", "poetic"] as const) if (kinds.includes(kind)) return kind
  return null
}

/** The texts of one kind: the first is the translation, the rest are "Other version". */
export function versionsOf(items: readonly SongTranslation[], kind: TranslationKind | null): SongTranslation[] {
  return kind ? sorted(items.filter((item) => item.kind === kind)) : []
}

export type LineKind = "literal" | "poetic"

/** The kinds the "translation under each line" setting can use: Literal and Poetic only (Official is a whole text), and only those the song has. */
export function lineKinds(kinds: readonly TranslationKind[]): LineKind[] {
  return (["literal", "poetic"] as const).filter((kind) => kinds.includes(kind))
}

/** The kind the reader asked for under the lines, or null: off, or a kind this song does not have. */
export function activeLineKind(setting: "off" | LineKind, kinds: readonly TranslationKind[]): LineKind | null {
  return setting !== "off" && lineKinds(kinds).includes(setting) ? setting : null
}

export type UnderLines =
  /** `under[line]` is the text drawn under lyric line `line` (0-based, as the page draws them) */
  | { kind: "lines"; under: Record<number, string> }
  /** the translation is one text for the whole song: it cannot be set under single lines */
  | { kind: "whole" }
  | { kind: "none" }

/**
 * Where the text of a translation goes under the lyrics. A segment for one line sits under that line; a segment for
 * a run of lines sits under the run's last line. A translation that was never marked line by line (`whole`) is not
 * split here: nothing is cut or guessed, the page says so instead.
 */
export function underLines(translation: SongTranslation | null | undefined, lineCount: number): UnderLines {
  if (!translation || lineCount <= 0) return { kind: "none" }
  if (translation.alignment === "whole") return { kind: "whole" }
  const under: Record<number, string> = {}
  for (const segment of translation.segments) {
    const last = segment.to === null ? lineCount - 1 : Math.min(segment.to, lineCount - 1)
    if (segment.from > last || !segment.text.trim()) continue
    under[last] = under[last] ? `${under[last]}\n${segment.text.trim()}` : segment.text.trim()
  }
  return Object.keys(under).length ? { kind: "lines", under } : { kind: "none" }
}

/** The text of a translation as a list of paragraphs (a blank line is a paragraph break, a single line break is kept as a line). */
export function paragraphsOf(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
}
