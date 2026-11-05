import { describe, expect, it } from "vitest"

import {
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
    expect(removeRowLabel(rowRemoval("all"))).toBe("Hide from this list")
    expect(removeRowLabel(rowRemoval("playlist:x"))).toBe("Remove from this playlist")
    expect(removeFooter(rowRemoval("all"))).toBe("Only you see this. You can bring hidden songs back from the list menu.")
    expect(removeFooter(rowRemoval("playlist:x"))).toBeNull()
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
