import { t } from "@/lib/i18n"

/**
 * What the last row of a song's menu does depends on the kind of list.
 * - A catalogue or system list (All songs, a collection, Mine) is not the listener's to edit, so the row
 *   only hides the song from their own view of that list: private, on this phone, nothing deleted.
 * - The listener's own playlist is theirs, so the row really removes the song from it (with Undo).
 */
export type RowRemoval = { kind: "hide" } | { kind: "playlist"; playlistId: string }

const PLAYLIST_PREFIX = "playlist:"

/** List id of an own playlist's page. */
export function playlistListId(playlistId: string): string {
  return `${PLAYLIST_PREFIX}${playlistId}`
}

export function rowRemoval(listId: string): RowRemoval {
  if (listId.startsWith(PLAYLIST_PREFIX) && listId.length > PLAYLIST_PREFIX.length) {
    return { kind: "playlist", playlistId: listId.slice(PLAYLIST_PREFIX.length) }
  }
  return { kind: "hide" }
}

/** How long the Undo of a removal stays on screen. */
export const UNDO_MS = 5000

export function removeRowLabel(removal: RowRemoval): string {
  return removal.kind === "playlist" ? t("songs.hide.remove") : t("songs.hide.row")
}

/** The footer of the sheet: only the hide row needs an explanation. */
export function removeFooter(removal: RowRemoval): string | null {
  return removal.kind === "hide" ? t("songs.hide.footer") : null
}

export function hiddenToast(listName: string): string {
  return t("songs.toast.hidden", { list: listName })
}

export function removedToast(playlistName: string): string {
  return t("songs.toast.removed", { list: playlistName })
}

/** Quiet line under a list's header: "3 hidden"; the page draws "Show" next to it. Null when nothing is hidden. */
export function hiddenLine(count: number): string | null {
  return count > 0 ? t("songs.hiddenCount", { count }) : null
}
