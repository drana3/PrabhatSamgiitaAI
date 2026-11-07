import type { MemberPlaylist } from "@prabhat/core"

import { api } from "@/lib/client"
import { writePlaylistCache } from "@/lib/playlistCache"

export type PlaylistSyncOp =
  | { type: "create"; tempId: string; name: string }
  | { type: "rename"; id: string; name: string }
  | { type: "delete"; id: string }
  | { type: "add"; id: string; songNumber: number }
  | { type: "remove"; id: string; songNumber: number }

/** Debounce rapid edits; creates flush immediately so follow-up adds can use the server id. */
const FLUSH_DEBOUNCE_MS = 450

let queue: PlaylistSyncOp[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let idMap = new Map<string, string>()
/** Bumped on reset (sign-out, another account): work that started before it must not touch anything after it. */
let epoch = 0

type SyncListeners = {
  onSyncing: (active: boolean) => void
  onPlaylists: (playlists: MemberPlaylist[]) => void
  onError: (message: string) => void
  readPlaylists: () => MemberPlaylist[]
}

let listeners: SyncListeners | null = null

export function bindPlaylistSyncHandlers(next: SyncListeners) {
  listeners = next
}

function resolveId(id: string) {
  return idMap.get(id) ?? id
}

function isLocalId(id: string) {
  return id.startsWith("local-")
}

export function enqueuePlaylistSync(op: PlaylistSyncOp) {
  queue.push(op)
  if (op.type !== "create") listeners?.onSyncing(true)
  if (flushTimer) clearTimeout(flushTimer)
  const delay = op.type === "create" ? 0 : FLUSH_DEBOUNCE_MS
  flushTimer = setTimeout(() => {
    void flushPlaylistSyncQueue()
  }, delay)
}

export function flushPlaylistSyncNow() {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  return flushPlaylistSyncQueue()
}

async function flushPlaylistSyncQueue() {
  if (flushing || !listeners || !queue.length) {
    if (!queue.length) listeners?.onSyncing(false)
    return
  }
  flushing = true
  const startedIn = epoch
  listeners.onSyncing(true)
  while (queue.length > 0 && epoch === startedIn) {
    const op = queue[0]
    try {
      await runOp(op, startedIn)
      if (epoch !== startedIn) break
      queue.shift()
    } catch (error) {
      if (epoch !== startedIn) break
      const message = error instanceof Error ? error.message : "Playlist sync failed."
      listeners.onError(message)
      break
    }
  }
  // A reset while this ran already cleared everything, including the flag: leave it to the new run.
  if (epoch !== startedIn) return
  flushing = false
  listeners.onSyncing(queue.length > 0)
  if (queue.length > 0) {
    flushTimer = setTimeout(() => void flushPlaylistSyncQueue(), FLUSH_DEBOUNCE_MS)
  }
}

async function runOp(op: PlaylistSyncOp, startedIn: number) {
  if (!listeners) return
  let playlists = listeners.readPlaylists()

  if (op.type === "create") {
    const created = await api.createMemberPlaylist(op.name)
    // The account changed while the server answered: the answer belongs to the old account.
    if (epoch !== startedIn) return
    idMap.set(op.tempId, created.id)
    playlists = listeners.readPlaylists().map((item) => (item.id === op.tempId ? created : item))
    listeners.onPlaylists(playlists)
    await writePlaylistCache(playlists)
    return
  }

  const id = resolveId(op.id)
  if (isLocalId(id)) {
    throw new Error("Playlist is still being created. Try again in a moment.")
  }

  if (op.type === "rename") {
    const updated = await api.renameMemberPlaylist(id, op.name)
    if (epoch !== startedIn) return
    playlists = replacePlaylist(listeners.readPlaylists(), updated)
  } else if (op.type === "delete") {
    await api.deleteMemberPlaylist(id)
    if (epoch !== startedIn) return
    playlists = listeners.readPlaylists().filter((item) => item.id !== op.id && item.id !== id)
  } else if (op.type === "add") {
    const updated = await api.addMemberPlaylistSong(id, op.songNumber)
    if (epoch !== startedIn) return
    playlists = replacePlaylist(listeners.readPlaylists(), updated)
  } else if (op.type === "remove") {
    const updated = await api.removeMemberPlaylistSong(id, op.songNumber)
    if (epoch !== startedIn) return
    playlists = replacePlaylist(listeners.readPlaylists(), updated)
  }

  listeners.onPlaylists(playlists)
  await writePlaylistCache(playlists)
}

function replacePlaylist(list: MemberPlaylist[], next: MemberPlaylist) {
  const index = list.findIndex((item) => item.id === next.id)
  if (index < 0) return [...list, next]
  const copy = list.slice()
  copy[index] = next
  return copy
}

export function resetPlaylistSyncQueue() {
  epoch += 1
  queue = []
  idMap = new Map()
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  flushing = false
}
