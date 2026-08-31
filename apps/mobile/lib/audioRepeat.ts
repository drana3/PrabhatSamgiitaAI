import AsyncStorage from "@react-native-async-storage/async-storage"

const STORAGE_KEY = "ps.audio-repeat"

let cachedRepeat = false
let hydrated = false

export function readAudioRepeat(): boolean {
  return cachedRepeat
}

export async function hydrateAudioRepeat(): Promise<boolean> {
  if (hydrated) return cachedRepeat
  hydrated = true
  try {
    cachedRepeat = (await AsyncStorage.getItem(STORAGE_KEY)) === "1"
  } catch {
    cachedRepeat = false
  }
  return cachedRepeat
}

export function writeAudioRepeat(enabled: boolean): void {
  cachedRepeat = enabled
  hydrated = true
  void AsyncStorage.setItem(STORAGE_KEY, enabled ? "1" : "0").catch(() => undefined)
}
