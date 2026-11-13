import type { ActionRow } from "@/lib/playerV2/playerActions"
import { t } from "@/lib/i18n"

/**
 * The two rows a recording adds to the full player's More sheet: its chords (a sheet over the player) and its page
 * (comments, chords, videos). They go in front of "Report", the last row. The song rows (`buildActionRows`) are not
 * touched: a song has its own page and comments.
 */
export function recordingExtraRows(withChords = true): ActionRow[] {
  return [
    // Dance music and Baba's Audio Discourses take no chords, so they get no Chords row
    ...(withChords ? [{ id: "recordingChords", label: t("recPlayer.chords"), meta: t("recPlayer.chords.meta"), icon: "music" } as ActionRow] : []),
    { id: "recordingPage", label: t("recPage.openPage"), meta: t("recPage.openPage.meta"), icon: "library" },
  ]
}

export function withRecordingExtras(rows: readonly ActionRow[], withChords = true): ActionRow[] {
  const at = rows.findIndex((r) => r.id === "report")
  const extra = recordingExtraRows(withChords)
  return at < 0 ? [...rows, ...extra] : [...rows.slice(0, at), ...extra, ...rows.slice(at)]
}
