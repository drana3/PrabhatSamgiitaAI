import { create } from "zustand"

import type { SaveItem } from "@/lib/save/saveToSheet"

/**
 * Which item the "Save to" sheet is open for, and the one-line toast that follows a tick.
 * One sheet for the whole app: every circle-plus button calls `open(item)`. The sheet is drawn by
 * the host that mounted last (the root layout, or the full player, which is a native modal on iOS
 * and so needs its own), see components/save/SaveHost.tsx.
 */
const TOAST_MS = 1800

type SaveSheetState = {
  item: SaveItem | null
  toast: { id: number; message: string } | null
  hosts: string[]
  open: (item: SaveItem) => void
  close: () => void
  showToast: (message: string) => void
  /** Returns the function that takes the host out again. */
  registerHost: (id: string) => () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
let toastSeq = 0

export const useSaveSheetStore = create<SaveSheetState>((set, get) => ({
  item: null,
  toast: null,
  hosts: [],
  open: (item) => set({ item }),
  close: () => set({ item: null }),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer)
    toastSeq += 1
    set({ toast: { id: toastSeq, message } })
    toastTimer = setTimeout(() => set({ toast: null }), TOAST_MS)
  },
  registerHost: (id) => {
    set({ hosts: [...get().hosts.filter((h) => h !== id), id] })
    return () => set({ hosts: get().hosts.filter((h) => h !== id) })
  },
}))

/** For code outside React (menus that used to toggle a heart). */
export function openSaveSheet(item: SaveItem): void {
  useSaveSheetStore.getState().open(item)
}
