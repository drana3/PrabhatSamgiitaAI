import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Downloads that were started and not finished (the app was closed, the connection dropped). The half-written
 * `.part` file has no name that says which recording it is, so the start of every download is written here
 * and the end of it (done, cancelled, failed for good) takes it out. What is left at the next start is what
 * can be continued.
 */
export type PendingDownload = {
  /** the recording's remote link; empty when the catalog's default recording was asked for */
  url: string
  songNumber: number
  startedAt: number
}

const MAX_PENDING = 100
/** A download not finished for this long is given up on (the partial file is dropped by the stale rule too). */
export const PENDING_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

const keyFor = (scope: string) => `ps.offline.pending.v1.${scope}`

function sameRecording(a: { url: string; songNumber: number }, b: { url: string; songNumber: number }): boolean {
  return a.songNumber === b.songNumber && a.url === b.url
}

export function parsePending(raw: string | null): PendingDownload[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (p): p is PendingDownload =>
          !!p && typeof p === "object" && typeof (p as PendingDownload).songNumber === "number" && typeof (p as PendingDownload).startedAt === "number",
      )
      .map((p) => ({ url: typeof p.url === "string" ? p.url : "", songNumber: p.songNumber, startedAt: p.startedAt }))
  } catch {
    return []
  }
}

/** The list with this download added (or its time refreshed), newest last, capped. */
export function withPending(list: readonly PendingDownload[], next: PendingDownload): PendingDownload[] {
  const rest = list.filter((p) => !sameRecording(p, next))
  return [...rest, next].slice(-MAX_PENDING)
}

/** The list without this download. With an empty `url` every recording of the song goes (a cancel by song). */
export function withoutPending(list: readonly PendingDownload[], gone: { url: string; songNumber: number }): PendingDownload[] {
  return list.filter((p) => !(p.songNumber === gone.songNumber && (gone.url === "" || p.url === gone.url || p.url === "")))
}

export function freshPending(list: readonly PendingDownload[], now: number): PendingDownload[] {
  return list.filter((p) => now - p.startedAt <= PENDING_MAX_AGE_MS)
}

let chain: Promise<void> = Promise.resolve()

function update(scope: string, change: (list: PendingDownload[]) => PendingDownload[]): Promise<void> {
  chain = chain
    .catch(() => undefined)
    .then(async () => {
      const list = parsePending(await AsyncStorage.getItem(keyFor(scope)))
      await AsyncStorage.setItem(keyFor(scope), JSON.stringify(change(list)))
    })
    .catch(() => undefined)
  return chain
}

export const readPending = async (scope: string): Promise<PendingDownload[]> => {
  await chain.catch(() => undefined)
  try {
    return parsePending(await AsyncStorage.getItem(keyFor(scope)))
  } catch {
    return []
  }
}
export const markPending = (scope: string, item: PendingDownload) => update(scope, (list) => withPending(list, item))
export const clearPending = (scope: string, gone: { url: string; songNumber: number }) => update(scope, (list) => withoutPending(list, gone))
export const replacePending = (scope: string, list: readonly PendingDownload[]) => update(scope, () => [...list])
