import { PART_SUFFIX } from "@/lib/offline/downloadVerify"
import type { PendingDownload } from "@/lib/offline/pendingDownloads"

/**
 * Audio files on the phone that the app has no record of: left by an update that lost the index, a save
 * that finished while the index was being rewritten, a half file nobody can continue. They take space the
 * downloaded list does not show, so Storage lists them and offers to remove them.
 */
export type DirEntry = { name: string; bytes: number; modifiedMs: number }
export type Orphan = DirEntry & { uri: string }

/** A file this young may be a save that is just finishing: never counted as an orphan. */
export const FRESH_FILE_MS = 2 * 60 * 1000
/** A half file this young may belong to a transfer that is running or has just stopped. */
export const FRESH_PART_MS = 60 * 60 * 1000

export function baseName(uri: string): string {
  const clean = uri.split("?")[0] ?? uri
  const last = clean.slice(clean.lastIndexOf("/") + 1)
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

/** Which of the files in the folder have no record. Pure. */
export function pickOrphans(
  entries: readonly DirEntry[],
  input: { indexedNames: ReadonlySet<string>; pending: readonly Pick<PendingDownload, "songNumber">[]; now: number },
): DirEntry[] {
  const waiting = new Set(input.pending.map((p) => p.songNumber))
  return entries.filter((entry) => {
    const age = input.now - entry.modifiedMs
    if (entry.name.endsWith(PART_SUFFIX)) {
      if (age < FRESH_PART_MS) return false
      // a half file of a download that is waiting to be continued is not lost
      const song = Number(entry.name.split("-")[0])
      if (Number.isFinite(song) && waiting.has(song)) return false
      return true
    }
    if (!entry.name.toLowerCase().endsWith(".mp3") && !/\.(m4a|aac|wav|ogg|flac|mp4)$/i.test(entry.name)) return false
    if (age < FRESH_FILE_MS) return false
    return !input.indexedNames.has(entry.name)
  })
}

export function orphanBytes(orphans: readonly Pick<Orphan, "bytes">[]): number {
  return orphans.reduce((sum, o) => sum + (o.bytes > 0 ? o.bytes : 0), 0)
}
