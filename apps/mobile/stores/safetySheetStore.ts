import { create } from "zustand"

import type { Kirtan } from "@/lib/kirtan/types"

/**
 * Which recording the Report sheet, or the "Block this author" confirmation, is open for. One of each for the whole
 * app: every Report and Block row (player menu, row menu, artist page) calls `openReport(k)` / `openBlock(k)`. The sheets
 * are drawn by components/kirtan/KirtanSafetyHost, which the save host mounts, so they also appear over the full player.
 */
type SafetySheetState = {
  report: Kirtan | null
  block: Kirtan | null
  openReport: (k: Kirtan) => void
  openBlock: (k: Kirtan) => void
  closeReport: () => void
  closeBlock: () => void
}

export const useSafetySheetStore = create<SafetySheetState>((set) => ({
  report: null,
  block: null,
  openReport: (k) => set({ report: k }),
  openBlock: (k) => set({ block: k }),
  closeReport: () => set({ report: null }),
  closeBlock: () => set({ block: null }),
}))

/** For code outside React (menus, the player's action rows). */
export function openReportSheet(k: Kirtan): void {
  useSafetySheetStore.getState().openReport(k)
}

export function openBlockSheet(k: Kirtan): void {
  useSafetySheetStore.getState().openBlock(k)
}
