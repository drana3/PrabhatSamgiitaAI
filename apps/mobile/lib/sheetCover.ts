import { useEffect } from "react"
import { create } from "zustand"

/**
 * THE rule for floating bars and bottom sheets: while ANY sheet is open the mini-player and the tab pill slide
 * away, so a sheet never has something floating over its last button (the prototype's sheet layer sits above
 * both). Every sheet registers while it is on screen, with useCoverWhile(open) or coverSheet(); the bars
 * read useSheetCover. Sheets may nest (a sheet opening another), so this counts.
 */
export const useSheetCover = create<{ count: number }>(() => ({ count: 0 }))

/** Registers one open sheet. The returned release is safe to call twice. */
export function coverSheet(): () => void {
  useSheetCover.setState((s) => ({ count: s.count + 1 }))
  let released = false
  return () => {
    if (released) return
    released = true
    useSheetCover.setState((s) => ({ count: Math.max(0, s.count - 1) }))
  }
}

/** True while at least one sheet is open. */
export function sheetIsOpen(): boolean {
  return useSheetCover.getState().count > 0
}

/** Call from a sheet with "is it on screen" (mounted, including its exit animation). */
export function useCoverWhile(open: boolean): void {
  useEffect(() => (open ? coverSheet() : undefined), [open])
}
