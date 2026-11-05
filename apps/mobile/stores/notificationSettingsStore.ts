import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  DEFAULT_SETTINGS,
  SETTINGS_VERSION,
  migrateSettings,
  setKindOn,
  setKindTime,
  setQuiet,
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
  setTime: (kind: TimedKind, at: number) => void
  setQuietHours: (patch: Partial<NotificationSettings["quiet"]>) => void
  reset: () => void
}

function pick(s: SettingsState): NotificationSettings {
  return { master: s.master, song: s.song, festival: s.festival, words: s.words, streak: s.streak, live: s.live, quiet: s.quiet }
}

/** What the person chose to be reminded about. Defaults: song of the day 8:00, festivals, words 18:00, live; streak off. */
export const useNotificationSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      permission: "unknown",
      setPermission: (permission) => set({ permission }),
      setMaster: (master) => set({ master }),
      setKind: (kind, on) => set((s) => setKindOn(pick(s), kind, on)),
      setTime: (kind, at) => set((s) => setKindTime(pick(s), kind, at)),
      setQuietHours: (patch) => set((s) => setQuiet(pick(s), patch)),
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
