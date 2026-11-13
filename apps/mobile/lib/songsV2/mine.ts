import { t } from "@/lib/i18n"
import { placeholderEntry, rowEyebrow, type CatalogEntry } from "./entry"

/** Copy fixed by spec SCR-11 item 7. */
export const MINE_COPY = {
  get savedEmpty() { return t("songs.mine.savedEmpty") },
  get playlistCaption() { return t("songs.mine.playlistCaption") },
  get newPlaylist() { return t("songs.mine.newPlaylist") },
  get quickStartTitle() { return t("songs.mine.quickTitle") },
  get quickStartHint() { return t("songs.mine.quickHint") },
  get playlistsEmpty() { return t("songs.mine.playlistsEmpty") },
}

/** `9 songs · made by you` (one song: `1 song`). */
export function playlistEyebrow(songCount: number): string {
  return t("songs.playlistEyebrow", { count: songCount })
}

/**
 * One state per section. A section never shows a spinner and an empty
 * message together: while loading with nothing to show it is `loading`,
 * and `empty` appears only once loading has finished.
 */
export type SectionState = "loading" | "empty" | "ready"

export function sectionState(input: { loading: boolean; count: number }): SectionState {
  if (input.count > 0) return "ready"
  return input.loading ? "loading" : "empty"
}

export type SavedRow = { number: number; title: string; eyebrow: string; offline: boolean; entry: CatalogEntry }

/**
 * Saved songs in the order the user hearted them, newest first.
 * A saved number the catalog does not know yet still gets a row.
 */
export function buildSavedRows(input: {
  savedNumbers: readonly number[]
  entries: ReadonlyMap<number, CatalogEntry>
  offlineNumbers?: ReadonlySet<number>
}): SavedRow[] {
  const seen = new Set<number>()
  const rows: SavedRow[] = []
  for (const number of [...input.savedNumbers].reverse()) {
    if (seen.has(number)) continue
    seen.add(number)
    const entry = input.entries.get(number)
    const offline = input.offlineNumbers?.has(number) ?? false
    rows.push({
      number,
      title: entry?.title ?? `Prabhat Samgiita ${number}`,
      entry: entry ?? placeholderEntry(number),
      eyebrow: rowEyebrow({ number, durationSeconds: entry?.durationSeconds ?? null }, offline),
      offline,
    })
  }
  return rows
}

/** `3 recordings` for the Downloads row. Total size is shown by SCR-20, which owns it. */
export function downloadsSummary(recordingCount: number): string {
  if (recordingCount <= 0) return t("songs.downloads.none")
  return t("songs.downloads.count", { count: recordingCount })
}
