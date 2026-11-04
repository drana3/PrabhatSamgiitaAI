import { create } from "zustand"

/**
 * TODO(api): demo-only Download state for the web preview (EXPO_PUBLIC_MOCKUP_DATA=1). The design
 * opens with PS 1 / PS 3 / PS 6 versions already on the phone ({'0-0','2-0','2-1','5-2'} in the
 * prototype, by row index) and simulates a download as a short progress run. Real downloads go
 * through the offline store and never touch this.
 */
type DemoDownloads = {
  done: Record<string, true>
  progress: Record<string, number>
  /** Start a download, or remove one that is on the phone. Returns what happened. */
  toggle: (key: string) => "removed" | "started" | "busy"
}

const STEP_MS = 200
const STEP = 0.09

let timer: ReturnType<typeof setInterval> | null = null

export const demoDownloadKey = (songNumber: number, versionIndex: number) => `${songNumber}-${versionIndex}`

export const useDemoDownloads = create<DemoDownloads>((set, get) => ({
  done: { "1-0": true, "3-0": true, "3-1": true, "6-2": true },
  progress: {},
  toggle: (key) => {
    const state = get()
    if (state.done[key]) {
      const done = { ...state.done }
      delete done[key]
      set({ done })
      return "removed"
    }
    if (state.progress[key] !== undefined) return "busy"
    set({ progress: { ...state.progress, [key]: 0 } })
    if (!timer) {
      timer = setInterval(() => {
        const { progress, done } = get()
        const nextProgress: Record<string, number> = {}
        const nextDone = { ...done }
        for (const [k, p] of Object.entries(progress)) {
          if (p + STEP >= 1) nextDone[k] = true
          else nextProgress[k] = p + STEP
        }
        set({ progress: nextProgress, done: nextDone })
        if (Object.keys(nextProgress).length === 0 && timer) {
          clearInterval(timer)
          timer = null
        }
      }, STEP_MS)
    }
    return "started"
  },
}))

/** The prototype's size estimate: 0.0156 MB per second. */
export function demoDownloadSize(seconds: number): string {
  const mb = seconds * 0.0156
  return mb >= 1000 ? `${(mb / 1024).toFixed(2)} GB` : mb < 0.05 ? "0 MB" : `${mb.toFixed(1)} MB`
}
