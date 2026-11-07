import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system/legacy"

import type { OfflineAudioEntry } from "@/lib/offlineAudio"
import {
  DEFAULT_CACHE_LIMIT,
  parseCacheLimitId,
  sortStorageItems,
  type CacheLimitId,
  type StorageItem,
} from "@/lib/storageCache"

const LIMIT_KEY = "ps.storage.cacheLimit.v1"

/** Real file sizes of the offline index (spec SCR-20: the sizes shown are the real file sizes). */
export async function scanOfflineStorage(
  files: Record<string, OfflineAudioEntry>,
): Promise<StorageItem[]> {
  const found = await Promise.all(
    Object.values(files).map(async (entry: OfflineAudioEntry): Promise<StorageItem | null> => {
      try {
        const info = await FileSystem.getInfoAsync(entry.fileUri)
        if (!info.exists || info.isDirectory) return null
        return {
          key: entry.remoteUrl,
          songNumber: entry.songNumber,
          bytes: info.size,
          modifiedMs: info.modificationTime ? Math.round(info.modificationTime * 1000) : 0,
        }
      } catch {
        return null
      }
    }),
  )
  return sortStorageItems(found.filter((item): item is StorageItem => item !== null))
}

export async function readCacheLimit(): Promise<CacheLimitId> {
  try {
    return parseCacheLimitId(await AsyncStorage.getItem(LIMIT_KEY))
  } catch {
    return DEFAULT_CACHE_LIMIT
  }
}

export async function writeCacheLimit(id: CacheLimitId): Promise<void> {
  try {
    await AsyncStorage.setItem(LIMIT_KEY, id)
  } catch {
    // best effort
  }
}
