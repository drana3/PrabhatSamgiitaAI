import AsyncStorage from "@react-native-async-storage/async-storage"
import type { MemberPlaylist } from "@prabhat/core"

const CACHE_KEY = "ps-member-playlists-v2"

/** `undefined` = not read from disk yet; `null` would mean corrupt — we use [] for empty. */
let memory: MemberPlaylist[] | undefined

export function peekPlaylistCache(): MemberPlaylist[] | null {
  return memory ?? null
}

export async function readPlaylistCache(): Promise<MemberPlaylist[] | null> {
  if (memory !== undefined) return memory
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    if (!raw) {
      memory = []
      return memory
    }
    const parsed = JSON.parse(raw) as MemberPlaylist[]
    memory = Array.isArray(parsed) ? parsed : []
    return memory
  } catch {
    memory = []
    return memory
  }
}

export async function writePlaylistCache(playlists: MemberPlaylist[]): Promise<void> {
  memory = playlists
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(playlists))
  } catch {
    // cache is best-effort
  }
}

export function writePlaylistCacheSoon(playlists: MemberPlaylist[]) {
  memory = playlists
  void writePlaylistCache(playlists)
}

export async function clearPlaylistCache(): Promise<void> {
  memory = []
  try {
    await AsyncStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
