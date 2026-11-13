import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * A random id made on first use and kept on the phone (`prabhat-install-id`). It is not tied to an
 * account, a device serial or an advertising id. It places the phone in a feature-flag group, and
 * goes to analytics only when the person chose "Share usage".
 */
const KEY = "prabhat-install-id"
let cached: string | null = null

export function newInstallId(random: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join("")
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(random() * 4)).toString(16)}${hex(3)}-${hex(12)}`
}

export async function getInstallId(): Promise<string> {
  if (cached) return cached
  try {
    const stored = await AsyncStorage.getItem(KEY)
    if (stored && stored.length >= 8) {
      cached = stored
      return stored
    }
  } catch {
    // fall through and make one for this run
  }
  const made = newInstallId()
  cached = made
  try {
    await AsyncStorage.setItem(KEY, made)
  } catch {
    // not saved: the next launch gets another id, which only moves the phone to another group
  }
  return made
}

/** Forget the id (used by "Delete my data"-style actions). */
export async function resetInstallId(): Promise<void> {
  cached = null
  try {
    await AsyncStorage.removeItem(KEY)
  } catch {
    // nothing to remove
  }
}
