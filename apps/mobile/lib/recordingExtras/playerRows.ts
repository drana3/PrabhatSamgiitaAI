import type { ActionRow } from "@/lib/playerV2/playerActions"
import { t } from "@/lib/i18n"

/**
 * The two rows a recording adds to the full player's More sheet: its chords (a sheet over the player) and its page
 * (comments, chords, videos). They go in front of "Report", the last row. The song rows (`buildActionRows`) are not
 * touched: a song has its own page and comments.
 */
export function recordingExtraRows(): ActionRow[] {
  return [
    { id: "recordingChords", label: t("recPlayer.chords"), meta: t("recPlayer.chords.meta"), icon: "music" },
    { id: "recordingPage", label: t("recPage.openPage"), meta: t("recPage.openPage.meta"), icon: "library" },
  ]
}

export function withRecordingExtras(rows: readonly ActionRow[]): ActionRow[] {
  const at = rows.findIndex((r) => r.id === "report")
  const extra = recordingExtraRows()
  return at < 0 ? [...rows, ...extra] : [...rows.slice(0, at), ...extra, ...rows.slice(at)]
}
