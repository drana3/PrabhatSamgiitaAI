import { describe, expect, it } from "vitest"

import {
  HIDE_FOOTER,
  HIDE_ROW_LABEL,
  REMOVE_ROW_LABEL,
  UNDO_MS,
  hiddenLine,
  hiddenToast,
  playlistListId,
  removeFooter,
  removeRowLabel,
  removedToast,
  rowRemoval,
} from "@/lib/songsV2/rowMenu"

describe("row menu by list kind", () => {
  it("catalogue and system lists hide", () => {
    for (const id of ["all", "collection:Spring Songs", "collection:morning", "mine", "saved"]) {
      expect(rowRemoval(id)).toEqual({ kind: "hide" })
    }
  })
  it("an own playlist removes, and keeps its id", () => {
    expect(rowRemoval(playlistListId("pl-7"))).toEqual({ kind: "playlist", playlistId: "pl-7" })
    expect(rowRemoval("playlist:")).toEqual({ kind: "hide" })
  })
  it("labels and footer follow the kind", () => {
    expect(removeRowLabel(rowRemoval("all"))).toBe(HIDE_ROW_LABEL)
    expect(removeRowLabel(rowRemoval("playlist:x"))).toBe(REMOVE_ROW_LABEL)
    expect(removeFooter(rowRemoval("all"))).toBe(HIDE_FOOTER)
    expect(removeFooter(rowRemoval("playlist:x"))).toBeNull()
    expect(HIDE_FOOTER).toBe("Only you see this. You can bring hidden songs back from the list menu.")
  })
  it("toasts", () => {
    expect(hiddenToast("All songs")).toBe("Hidden from All songs")
    expect(removedToast("Evening kiirtan")).toBe("Removed from Evening kiirtan")
    expect(UNDO_MS).toBe(5000)
  })
  it("hidden line", () => {
    expect(hiddenLine(0)).toBeNull()
    expect(hiddenLine(1)).toBe("1 hidden")
    expect(hiddenLine(1200)).toBe("1,200 hidden")
  })
})
