import { create } from "zustand"

/**
 * What went wrong with delivery, for the centre to say out loud. Not saved: it is re-measured every time the
 * app schedules. `scheduleFailed` is true when the phone refused some of the reminders the app asked it to hold
 * (lib/notifications/native.ts `applySchedule`); the centre then offers "Try again".
 */
type HealthState = {
  scheduleFailed: boolean
  setScheduleFailed: (failed: boolean) => void
  /** counts up when the person taps "Try again"; the host schedules again whenever it changes */
  retryTick: number
  retry: () => void
}

export const useNotificationHealthStore = create<HealthState>()((set) => ({
  scheduleFailed: false,
  setScheduleFailed: (scheduleFailed) => set({ scheduleFailed }),
  retryTick: 0,
  retry: () => set((s) => ({ retryTick: s.retryTick + 1 })),
}))
