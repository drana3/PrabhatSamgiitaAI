import { create } from "zustand"

import type { ConfirmCopy } from "@/lib/offline/downloadModel"

/**
 * What the download controls show above the screen: the sign-in prompt, the "Remove download?"
 * confirm and one quiet toast (with Try again after a failure). Every download control of the app
 * calls the actions in lib/offline/downloadActions.ts, which write here; components/offline/
 * DownloadHost.tsx draws it (inside SaveHost, so the root layout and the full player both have it).
 */
export type DownloadPrompt =
  | { kind: "signin" }
  | { kind: "remove"; copy: ConfirmCopy; onConfirm: () => void }

export type DownloadToast = { id: number; message: string; actionLabel?: string; onAction?: () => void }

type DownloadUiState = {
  prompt: DownloadPrompt | null
  toast: DownloadToast | null
  openPrompt: (prompt: DownloadPrompt) => void
  closePrompt: () => void
  showToast: (message: string, action?: { label: string; onPress: () => void }) => void
  hideToast: () => void
}

const TOAST_MS = 2400
const TOAST_ACTION_MS = 5000

let timer: ReturnType<typeof setTimeout> | null = null
let seq = 0

export const useDownloadUiStore = create<DownloadUiState>((set) => ({
  prompt: null,
  toast: null,
  openPrompt: (prompt) => set({ prompt }),
  closePrompt: () => set({ prompt: null }),
  showToast: (message, action) => {
    if (timer) clearTimeout(timer)
    seq += 1
    set({ toast: { id: seq, message, actionLabel: action?.label, onAction: action?.onPress } })
    timer = setTimeout(() => set({ toast: null }), action ? TOAST_ACTION_MS : TOAST_MS)
  },
  hideToast: () => {
    if (timer) clearTimeout(timer)
    set({ toast: null })
  },
}))
