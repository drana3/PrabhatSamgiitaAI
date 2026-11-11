import { buildPickerIndex, entryFromIndexRow, type PickerIndexRow } from "@/lib/learn/songPicker"
import { catalogLyricRows } from "@/lib/lyricSearch"
import { hasPlayableAudio } from "@/lib/playableAudio"

export type PickerIndex = { status: "loading" } | { status: "error" } | { status: "ready"; rows: PickerIndexRow[] }

/** The 5,018 songs from the song index that ships with the app: no network, so it opens at once and works offline. */
export function buildIndex(): PickerIndex {
  const rows = catalogLyricRows()
  if (!rows.length) return { status: "error" }
  return { status: "ready", rows: buildPickerIndex(rows.map((row) => entryFromIndexRow(row, hasPlayableAudio))) }
}
