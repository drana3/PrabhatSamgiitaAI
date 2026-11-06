export { orphanBytes, type DirEntry, type Orphan } from "@/lib/offline/orphanRules"

import * as FileSystem from "expo-file-system/legacy"

import { offlineAudioScopeKey, offlineDir, useOfflineAudioStore } from "@/lib/offlineAudio"
import { baseName, pickOrphans, type DirEntry, type Orphan } from "@/lib/offline/orphanRules"
import { readPending } from "@/lib/offline/pendingDownloads"
import { useAuthStore } from "@/stores/authStore"

function currentScope(): string {
  const { mode, memberId, identityProvider, email } = useAuthStore.getState()
  return offlineAudioScopeKey({ mode, memberId, identityProvider, email })
}

/** Looks in the current account's download folder. Empty when there is none or the file system cannot say. */
export async function scanOrphans(now: number = Date.now()): Promise<Orphan[]> {
  try {
    if (typeof FileSystem.readDirectoryAsync !== "function") return []
    const scope = currentScope()
    const dir = offlineDir(scope)
    let names: string[]
    try {
      names = await FileSystem.readDirectoryAsync(dir)
    } catch {
      return []
    }
    const entries: DirEntry[] = []
    for (const name of names) {
      try {
        const info = await FileSystem.getInfoAsync(`${dir}${name}`)
        if (!info.exists || info.isDirectory) continue
        entries.push({
          name,
          bytes: "size" in info && typeof info.size === "number" ? info.size : 0,
          modifiedMs: info.modificationTime ? Math.round(info.modificationTime * 1000) : 0,
        })
      } catch {
        /* a file that vanished while we looked */
      }
    }
    const files = useOfflineAudioStore.getState().files
    const indexedNames = new Set(Object.values(files).map((entry) => baseName(entry.fileUri)))
    const pending = await readPending(scope)
    return pickOrphans(entries, { indexedNames, pending, now }).map((entry) => ({ ...entry, uri: `${dir}${entry.name}` }))
  } catch {
    return []
  }
}

/** Deletes the given orphans. Returns how many bytes were really freed. */
export async function removeOrphans(orphans: readonly Orphan[]): Promise<number> {
  let freed = 0
  for (const orphan of orphans) {
    try {
      await FileSystem.deleteAsync(orphan.uri, { idempotent: true })
      const left = await FileSystem.getInfoAsync(orphan.uri)
      if (!left.exists) freed += orphan.bytes > 0 ? orphan.bytes : 0
    } catch {
      /* it stays; the next look shows it again */
    }
  }
  return freed
}
