import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  addKindTime,
  migrateSettings,
  removeKindTime,
  setKindOn,
  setKindTime,
  type NotificationSettings,
  type TimedKind,
  type ToggleKind,
} from "@/lib/notifications/settings"

/** The state of the system permission, as far as the app knows. */
export type PermissionState = "unknown" | "undetermined" | "granted" | "denied"

type SettingsState = NotificationSettings & {
  /** not saved: asked from the OS each time the app comes to the front */
  permission: PermissionState
  setPermission: (permission: PermissionState) => void
  setMaster: (on: boolean) => void
  setKind: (kind: ToggleKind, on: boolean) => void
  /** change the time at `index` (ignored when it equals another time of the kind) */
  setTime: (kind: TimedKind, index: number, minutes: number) => void
  /** add a time (ignored at the limit or for a time already there) */
  addTime: (kind: TimedKind, minutes: number) => void
  /** remove the time at `index` (the last one stays) */
  removeTime: (kind: TimedKind, index: number) => void
  reset: () => void
}

function pick(s: SettingsState): NotificationSettings {
  return { master: s.master, song: s.song, festival: s.festival, words: s.words, streak: s.streak }
}

/** What the person chose to be reminded about. Defaults: song of the day 8:00, festivals, words 18:00; streak off. Each timed kind holds a list of times. */
export const useNotificationSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      permission: "unknown",
      setPermission: (permission) => set({ permission }),
      setMaster: (master) => set({ master }),
      setKind: (kind, on) => set((s) => setKindOn(pick(s), kind, on)),
      setTime: (kind, index, minutes) => set((s) => setKindTime(pick(s), kind, index, minutes)),
      addTime: (kind, minutes) => set((s) => addKindTime(pick(s), kind, minutes)),
      removeTime: (kind, index) => set((s) => removeKindTime(pick(s), kind, index)),
      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: "prabhat-notification-settings",
      storage: createJSONStorage(() => AsyncStorage),
      version: SETTINGS_VERSION,
      migrate: (saved, version) => ({ ...migrateSettings(saved, version) }) as SettingsState,
      partialize: (s) => pick(s),
      merge: (saved, current) => ({ ...current, ...migrateSettings(saved) }),
    },
  ),
)
