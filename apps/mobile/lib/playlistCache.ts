import AsyncStorage from "@react-native-async-storage/async-storage"
import type { MemberPlaylist } from "@prabhat/core"

import { ownerKeyOf } from "@/lib/account/owner"
import { useAuthStore } from "@/stores/authStore"

/** v3 keeps whose playlists these are; v2 had no owner and is dropped. */
const CACHE_KEY = "ps-member-playlists-v3"
const LEGACY_KEY = "ps-member-playlists-v2"

type Cached = { owner: string; playlists: MemberPlaylist[] }

/** `undefined` = not read from disk yet. A cache of another account is never handed out. */
let memory: Cached | undefined

function currentOwner(): string {
  return ownerKeyOf(useAuthStore.getState())
}

export function peekPlaylistCache(): MemberPlaylist[] | null {
  return memory && memory.owner === currentOwner() ? memory.playlists : null
}

export async function readPlaylistCache(): Promise<MemberPlaylist[] | null> {
  const owner = currentOwner()
  if (memory !== undefined && memory.owner === owner) return memory.playlists
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Cached>) : null
    const mine =
      parsed && parsed.owner === owner && Array.isArray(parsed.playlists) ? parsed.playlists : []
    // The account may have changed while the file was being read.
    if (currentOwner() !== owner) return []
    memory = { owner, playlists: mine }
    return mine
  } catch {
    memory = { owner, playlists: [] }
    return memory.playlists
  }
}

/** `owner` is the account the list belongs to; a write for an account that is no longer signed in is dropped. */
export async function writePlaylistCache(playlists: MemberPlaylist[], owner: string = currentOwner()): Promise<void> {
  if (owner !== currentOwner()) return
  memory = { owner, playlists }
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ owner, playlists } satisfies Cached))
  } catch {
    // cache is best-effort
  }
}

export function writePlaylistCacheSoon(playlists: MemberPlaylist[]) {
  void writePlaylistCache(playlists)
}

export async function clearPlaylistCache(): Promise<void> {
  memory = { owner: currentOwner(), playlists: [] }
  try {
    await AsyncStorage.removeItem(CACHE_KEY)
    await AsyncStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore
  }
}
