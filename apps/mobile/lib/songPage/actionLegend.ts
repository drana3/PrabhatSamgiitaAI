/**
 * The legend of the icons in the row of the song page (the row under the title): what each one is called, what a tap on
 * it does, which one is which. One list feeds the captions under the icons and the spoken labels, so a word can not
 * drift between them. Pure, no React.
 *
 * Why this list exists. Before it, the row was a check (Save), an arrow in a square (Download), a list with a plus
 * (Add to playlist), Share and More, with no words. Save and Add to playlist opened the SAME "Save to" sheet, and a
 * check meant three things on one page (Saved, "In your Learn list", Downloaded). Now:
 *
 *   saved     one tap puts the song in Mine (a toast says so); once it is saved a tap opens the Save to sheet to change it
 *   download  one arrow in a square; a ring shows the progress; a green square says it is on this phone
 *   playlist  a list with a plus; opens the Save to sheet, to pick a playlist or make a new one
 *   share     opens the share sheet
 *   more      the menu: queue, collection, report
 */

export const ACTION_IDS = ["saved", "download", "playlist", "share", "more"] as const
export type ActionId = (typeof ACTION_IDS)[number]

/** The strings of the legend as keys of locales/songTabs.ts, in the order of the row: the word under the icon (first showing) and what a tap does in one plain line (the screen reader's hint). */
export const ACTION_LEGEND_KEYS: ReadonlyArray<{ id: ActionId; caption: string; help: string }> = [
  { id: "saved", caption: "songAct.saved.caption", help: "songAct.saved.help" },
  { id: "download", caption: "songAct.download.caption", help: "songAct.download.help" },
  { id: "playlist", caption: "songAct.playlist.caption", help: "songAct.playlist.help" },
  { id: "share", caption: "songAct.share.caption", help: "songAct.share.help" },
  { id: "more", caption: "songAct.more.caption", help: "songAct.more.help" },
]

/** What a tap on the Saved icon does: an unsaved song goes straight into Mine; a saved one opens the sheet to change it. */
export type SaveTap = "save-to-mine" | "open-sheet"

export function saveTapPlan(saved: boolean): SaveTap {
  return saved ? "open-sheet" : "save-to-mine"
}

/** The word under the Download icon by its state: Download, 40%, Downloaded. */
export function downloadCaptionKey(status: "idle" | "downloading" | "done"): "songAct.download.caption" | "songAct.download.caption.done" | "songAct.download.caption.busy" {
  return status === "done" ? "songAct.download.caption.done" : status === "downloading" ? "songAct.download.caption.busy" : "songAct.download.caption"
}

/** The word under the Saved icon by its state. */
export function savedCaptionKey(saved: boolean): "songAct.saved.caption" | "songAct.save.caption" {
  return saved ? "songAct.saved.caption" : "songAct.save.caption"
}
