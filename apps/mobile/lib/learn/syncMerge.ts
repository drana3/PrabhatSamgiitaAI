import { isSongNumber } from "@/lib/learn/learnSongs"
import { EMPTY_PATH, type LearningSong, type PathState } from "@/lib/learn/progress"

/**
 * The rules of Learn progress sync, with no React, no storage and no network, so they are tested
 * (docs/learn-sync.md). The server keeps one entry per song and the newest `updatedAt` wins, song by song.
 *
 * Nothing in the Learn store carries a change time, so this file keeps its own bookkeeping next to it:
 * `SyncMeta` holds, per song, what was last known to be in step with the server plus a `dirty` flag for what
 * still has to be sent. `captureLocal` notices what changed in the store since then and stamps it;
 * `applyRemote` folds the server's entries in. A server copy never replaces a newer local one.
 */

/** One song as it travels: the list entry and its path in one record. */
export type SyncEntry = {
  songId: string
  number: number
  title: string
  startedAt: number
  /** taken off the list (a marker, so the other phones take it off too) */
  removed: boolean
  path: PathState
  /** when it last changed, ms since 1970, on the phone that changed it */
  updatedAt: number
}

export type MetaEntry = SyncEntry & {
  /** changed here and not yet confirmed by the server */
  dirty: boolean
  /**
   * First seen on this phone before it ever talked to the server. If the server turns out to hold a newer
   * copy, the two paths are combined once instead of the older progress being dropped.
   */
  adopted: boolean
}

export type SyncMeta = Record<string, MetaEntry>

export type LearnLists = {
  songs: LearningSong[]
  paths: Record<string, PathState>
}

export function pathsEqual(a: PathState, b: PathState): boolean {
  return a.listen === b.listen && a.words === b.words && a.meaning === b.meaning && a.chords === b.chords
}

export function sameContent(a: SyncEntry, b: SyncEntry): boolean {
  return (
    a.number === b.number &&
    a.title === b.title &&
    a.startedAt === b.startedAt &&
    a.removed === b.removed &&
    pathsEqual(a.path, b.path)
  )
}

function mergePaths(a: PathState, b: PathState): PathState {
  return {
    listen: a.listen || b.listen,
    words: a.words || b.words,
    meaning: a.meaning || b.meaning,
    chords: a.chords || b.chords,
  }
}

function toEntry(meta: MetaEntry): SyncEntry {
  const { dirty: _dirty, adopted: _adopted, ...entry } = meta
  return entry
}

/** The entries that still have to be sent. */
export function dirtyEntries(meta: SyncMeta): SyncEntry[] {
  return Object.values(meta)
    .filter((entry) => entry.dirty)
    .map(toEntry)
}

export function hasDirty(meta: SyncMeta): boolean {
  return Object.values(meta).some((entry) => entry.dirty)
}

/**
 * Notice what changed in the Learn store since the last time and stamp it with `now`.
 * - a song on the list that the bookkeeping has not seen: first sight, stamped with its own start time;
 * - a song whose title, start time or path differs: stamped `now`;
 * - a song the bookkeeping knows as listed that is no longer on the list: marked removed, stamped `now`.
 * Returns the same object when nothing changed.
 */
export function captureLocal(meta: SyncMeta, lists: LearnLists, now: number): SyncMeta {
  let next: SyncMeta | null = null
  const set = (entry: MetaEntry) => {
    next = { ...(next ?? meta), [entry.songId]: entry }
  }
  const listed = new Set<string>()
  for (const song of lists.songs) {
    if (!isSongNumber(song.number)) continue
    listed.add(song.songId)
    const current: SyncEntry = {
      songId: song.songId,
      number: song.number,
      title: song.title,
      startedAt: song.startedAt,
      removed: false,
      path: lists.paths[song.songId] ?? EMPTY_PATH,
      updatedAt: 0,
    }
    const previous = meta[song.songId]
    if (!previous) {
      set({ ...current, updatedAt: Math.min(Math.max(song.startedAt, 1), now), dirty: true, adopted: true })
    } else if (!sameContent(previous, current)) {
      set({ ...current, updatedAt: Math.max(now, previous.updatedAt + 1), dirty: true, adopted: false })
    }
  }
  for (const previous of Object.values(meta)) {
    if (previous.removed || listed.has(previous.songId)) continue
    set({
      ...previous,
      removed: true,
      path: lists.paths[previous.songId] ?? previous.path,
      updatedAt: Math.max(now, previous.updatedAt + 1),
      dirty: true,
      adopted: false,
    })
  }
  return next ?? meta
}

export type RemoteResult = {
  meta: SyncMeta
  lists: LearnLists
  /** the Learn store has to be changed */
  listsChanged: boolean
}

/** Put one entry into the lists: on the list (kept in start-time order) or taken off. Progress is kept either way. */
function writeEntry(lists: LearnLists, entry: SyncEntry): LearnLists {
  const paths = { ...lists.paths, [entry.songId]: entry.path }
  const without = lists.songs.filter((song) => song.songId !== entry.songId)
  if (entry.removed) return { songs: without, paths }
  const song: LearningSong = {
    songId: entry.songId,
    number: entry.number,
    title: entry.title,
    startedAt: entry.startedAt,
  }
  const existing = lists.songs.findIndex((item) => item.songId === entry.songId)
  if (existing >= 0) {
    const songs = [...lists.songs]
    songs[existing] = song
    return { songs, paths }
  }
  const at = without.findIndex((item) => item.startedAt > entry.startedAt)
  const songs = at < 0 ? [...without, song] : [...without.slice(0, at), song, ...without.slice(at)]
  return { songs, paths }
}

function listChanged(before: LearnLists, entry: SyncEntry): boolean {
  const listed = before.songs.find((song) => song.songId === entry.songId)
  if (entry.removed) {
    if (listed) return true
  } else if (
    !listed ||
    listed.title !== entry.title ||
    listed.startedAt !== entry.startedAt ||
    listed.number !== entry.number
  ) {
    return true
  }
  return !pathsEqual(before.paths[entry.songId] ?? EMPTY_PATH, entry.path)
}

/**
 * Fold the server's entries in. Per song, the newest `updatedAt` wins:
 * - a song the phone has never heard of: taken as it is;
 * - the server's copy is newer: taken (a never-synced local song keeps its progress by combining the paths once);
 * - the same time and same content: confirmed, no longer dirty;
 * - the local copy is newer: kept, and sent next (dirty) unless the server already holds the same content.
 * `captureLocal` should have run just before, so that changes made while the request was out are not lost.
 */
export function applyRemote(meta: SyncMeta, lists: LearnLists, remote: readonly SyncEntry[], now: number): RemoteResult {
  let nextMeta = meta
  let nextLists = lists
  let listsChanged = false
  if (remote.length === 0) {
    // The server holds nothing at all, yet songs were thought to be in step: its copy is gone (for example the
    // account was deleted and made again). Send them again. Removal markers are left: the server drops old ones.
    for (const entry of Object.values(meta)) {
      if (!entry.removed && !entry.dirty) nextMeta = { ...nextMeta, [entry.songId]: { ...entry, dirty: true } }
    }
  }
  const take = (entry: SyncEntry, extra: Partial<MetaEntry> = {}) => {
    nextMeta = { ...nextMeta, [entry.songId]: { ...entry, dirty: false, adopted: false, ...extra } }
    if (listChanged(nextLists, entry)) {
      nextLists = writeEntry(nextLists, entry)
      listsChanged = true
    }
  }
  for (const incoming of remote) {
    if (!isSongNumber(incoming.number) || incoming.songId !== `ps-${incoming.number}`) continue
    const local = nextMeta[incoming.songId]
    if (!local) {
      take(incoming)
      continue
    }
    if (incoming.updatedAt > local.updatedAt) {
      if (local.adopted && local.dirty) {
        const combined = mergePaths(local.path, incoming.path)
        if (!pathsEqual(combined, incoming.path)) {
          // the phone had progress the server's newer copy does not: keep both, and send the result
          take({ ...incoming, path: combined, updatedAt: Math.max(now, incoming.updatedAt + 1) }, { dirty: true })
          continue
        }
      }
      take(incoming)
    } else if (incoming.updatedAt === local.updatedAt) {
      if (sameContent(incoming, local)) {
        if (local.dirty || local.adopted) nextMeta = { ...nextMeta, [local.songId]: { ...local, dirty: false, adopted: false } }
      } else {
        take(incoming) // the server keeps its own on a tie: follow it so both sides agree
      }
    } else if (sameContent(incoming, local)) {
      // the server holds the same thing with an earlier stamp (it cut a clock that ran ahead): adopt its stamp
      nextMeta = { ...nextMeta, [local.songId]: { ...local, updatedAt: incoming.updatedAt, dirty: false, adopted: false } }
    } else if (!local.dirty) {
      nextMeta = { ...nextMeta, [local.songId]: { ...local, dirty: true } }
    }
  }
  return { meta: nextMeta, lists: nextLists, listsChanged }
}
