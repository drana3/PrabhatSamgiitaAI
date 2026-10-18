import AsyncStorage from "@react-native-async-storage/async-storage"

const STORAGE_KEY = "ps.audio-repeat"

// Cached synchronously so the store can seed its initial value without awaiting.
let cachedRepeat = false

/** Current cached repeat preference (may be stale until hydrateAudioRepeat runs). */
export function readAudioRepeat(): boolean {
  return cachedRepeat
}

/** Persist the repeat preference; updates the sync cache immediately. */
export function writeAudioRepeat(enabled: boolean): void {
  cachedRepeat = enabled
  void AsyncStorage.setItem(STORAGE_KEY, enabled ? "1" : "0").catch(() => undefined)
}

/** Load the persisted repeat preference once at app boot. */
export async function hydrateAudioRepeat(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    cachedRepeat = raw === "1"
  } catch {
    cachedRepeat = false
  }
  return cachedRepeat
}
