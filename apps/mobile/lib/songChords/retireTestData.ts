import AsyncStorage from "@react-native-async-storage/async-storage"

import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * The preview keeps what a person makes in the browser (localStorage): drafts of chords and the notices "your chart is
 * live / not published". Charts made while testing must not outlive the test. Each time the storage format or the
 * test data changes, the store's key gets a new version (stores/chordDraftStore.ts, stores/chordNoticeStore.ts); the
 * old keys listed here are then removed, once, together with the chord notices already in the inbox.
 *
 * Retired: "prabhat-chord-draft-v1" (drafts) and "prabhat-chord-notices-v1" (what the phone last saw of the charts).
 * Demo seed charts are not stored anywhere (lib/songChords/mock.ts makes them again on every load) and are untouched.
 */
export const RETIRED_KEYS: readonly string[] = ["prabhat-chord-draft-v1", "prabhat-chord-notices-v1"]

/** Notices written for a chord chart carry this id prefix (lib/songChords/notices.ts). */
export const CHORD_NOTICE_PREFIX = "chords:"

export function withoutChordNotices<T extends { id: string }>(items: readonly T[]): T[] {
  return items.filter((item) => !item.id.startsWith(CHORD_NOTICE_PREFIX))
}

let done = false

/** Remove the retired keys; if any was there, drop the chord notices of the old tests from the inbox as well. Never throws. */
export async function retireTestData(): Promise<void> {
  if (done) return
  done = true
  try {
    const found = await Promise.all(RETIRED_KEYS.map((key) => AsyncStorage.getItem(key)))
    if (!found.some((value) => value !== null)) return
    await Promise.all(RETIRED_KEYS.map((key) => AsyncStorage.removeItem(key)))
    const purge = () => useNotificationsStore.setState((state) => ({ items: withoutChordNotices(state.items) }))
    // the inbox comes back from storage a moment after start and would overwrite an earlier change
    if (useNotificationsStore.persist.hasHydrated()) purge()
    else useNotificationsStore.persist.onFinishHydration(purge)
  } catch {
    // a failed cleanup leaves old test entries visible, nothing worse
  }
}
