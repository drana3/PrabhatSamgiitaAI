/**
 * "About this song": only facts the data proves. Credits and About used to be two overlapping cards, one of
 * them with hard-coded rows. Every row here comes from the catalogue or is true of every Prabhat Samgiita
 * song. A row with no data is left out. Pure.
 */

export type AboutRow =
  | { id: "words"; value: string }
  | { id: "composed"; date: { year: number; month: number; day: number } }
  | { id: "theme"; value: string }
  | { id: "category"; value: string }
  | { id: "recording"; kind: "official" | "other"; count: number }
  | { id: "source" }

/** Every Prabhat Samgiita song is words and music by Shrii P. R. Sarkar (Shrii Shrii Anandamurti). */
export const WORDS_AND_MUSIC = "Shrii P. R. Sarkar (Shrii Shrii Anandamurti)"

/** `17/9/1982` (day/month/year) as a date, or null when it is anything else. */
export function parseCompositionDate(raw: unknown): { year: number; month: number; day: number } | null {
  if (typeof raw !== "string") return null
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(raw)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null
  return { year, month, day }
}

export type AboutInput = {
  /** the song detail's metadata_json (date, category, official_theme_label, source), when the song came from the API */
  metadata?: Record<string, unknown> | null
  /** theme label of the catalogue, when metadata has no official one */
  theme?: string | null
  recordings: ReadonlyArray<{ provider: string }>
  /** the preview's demo songs: nothing about their recordings is real, so no recording row */
  demo?: boolean
}

export function aboutRows(input: AboutInput): AboutRow[] {
  const meta = input.metadata ?? {}
  const rows: AboutRow[] = [{ id: "words", value: WORDS_AND_MUSIC }]
  const date = parseCompositionDate(meta.date)
  if (date) rows.push({ id: "composed", date })
  const theme = (typeof meta.official_theme_label === "string" ? meta.official_theme_label : input.theme ?? "").trim()
  if (theme) rows.push({ id: "theme", value: theme })
  const category = typeof meta.category === "string" ? meta.category.trim() : ""
  if (category) rows.push({ id: "category", value: category })
  if (!input.demo && input.recordings.length) {
    const official = input.recordings.some((r) => r.provider.toLowerCase() === "official")
    rows.push({ id: "recording", kind: official ? "official" : "other", count: input.recordings.length })
  }
  if (meta.source === "official-lyrics-page") rows.push({ id: "source" })
  return rows
}

/** The short line under the title (variants A and B): `Shrii P. R. Sarkar` and, when known, the date. */
export function headlineFacts(input: Pick<AboutInput, "metadata">): { composer: string; date: { year: number; month: number; day: number } | null } {
  return { composer: "Shrii P. R. Sarkar", date: parseCompositionDate(input.metadata?.date) }
}
