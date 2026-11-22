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
/** Server-confirmed or in-flight deletes — keeps refresh from resurrecting a removed playlist. */
const suppressedRemoteIds = new Set<string>()
const inFlightDeletes = new Set<string>()

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

function playlistIdsForOp(op: PlaylistSyncOp): string[] {
  if (op.type === "create") return [op.tempId, resolveId(op.tempId)]
  return [op.id, resolveId(op.id)]
}

function opTargetsPlaylist(op: PlaylistSyncOp, playlistId: string): boolean {
  const serverId = resolveId(playlistId)
  return playlistIdsForOp(op).some((id) => id === playlistId || id === serverId)
}

export function mergePlaylistsFromServer(remote: MemberPlaylist[]): MemberPlaylist[] {
  const hidden = suppressedPlaylistIds()
  const filtered = remote.filter((playlist) => !hidden.has(playlist.id))
  for (const id of [...suppressedRemoteIds]) {
    if (!remote.some((playlist) => playlist.id === id)) suppressedRemoteIds.delete(id)
  }
  return filtered
}

export function mergeCachedPlaylists(cached: MemberPlaylist[]): MemberPlaylist[] {
  const hidden = suppressedPlaylistIds()
  return cached.filter((playlist) => !hidden.has(playlist.id))
}

export function suppressedPlaylistIds(): Set<string> {
  const pending = new Set<string>(suppressedRemoteIds)
  for (const op of queue) {
    if (op.type === "delete") {
      pending.add(op.id)
      pending.add(resolveId(op.id))
    }
  }
  for (const id of inFlightDeletes) pending.add(id)
  return pending
}

export function purgePlaylistFromQueue(playlistId: string) {
  const serverId = resolveId(playlistId)
  queue = queue.filter((op) => !opTargetsPlaylist(op, playlistId))
  for (const [local, server] of [...idMap.entries()]) {
    if (local === playlistId || server === serverId || local === serverId) {
      idMap.delete(local)
    }
  }
}

export function cancelLocalPlaylist(playlistId: string) {
  purgePlaylistFromQueue(playlistId)
  suppressedRemoteIds.add(playlistId)
  suppressedRemoteIds.add(resolveId(playlistId))
}

function markPlaylistSuppressedAfterDelete(playlistId: string) {
  const serverId = resolveId(playlistId)
  suppressedRemoteIds.add(playlistId)
  suppressedRemoteIds.add(serverId)
}

export async function deletePlaylistOnServer(playlistId: string): Promise<void> {
  if (isLocalId(playlistId)) {
    cancelLocalPlaylist(playlistId)
    return
  }

  const serverId = resolveId(playlistId)
  inFlightDeletes.add(playlistId)
  inFlightDeletes.add(serverId)
  listeners?.onSyncing(true)
  try {
    await flushPlaylistSyncQueue()
    purgePlaylistFromQueue(playlistId)
    await api.deleteMemberPlaylist(serverId)
    markPlaylistSuppressedAfterDelete(playlistId)
  } finally {
    inFlightDeletes.delete(playlistId)
    inFlightDeletes.delete(serverId)
    listeners?.onSyncing(queue.length > 0 || flushing)
  }
}

export function enqueuePlaylistSync(op: PlaylistSyncOp) {
  if (op.type === "delete") {
    throw new Error("Use deletePlaylistOnServer for playlist deletion.")
  }
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
  listeners.onSyncing(true)
  while (queue.length > 0) {
    const op = queue[0]
    try {
      await runOp(op)
      queue.shift()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Playlist sync failed."
      listeners.onError(message)
      break
    }
  }
  flushing = false
  listeners.onSyncing(queue.length > 0)
  if (queue.length > 0) {
    flushTimer = setTimeout(() => void flushPlaylistSyncQueue(), FLUSH_DEBOUNCE_MS)
  }
}

async function runOp(op: PlaylistSyncOp) {
  if (!listeners) return
  let playlists = listeners.readPlaylists()

  if (op.type === "create") {
    const created = await api.createMemberPlaylist(op.name)
    idMap.set(op.tempId, created.id)
    playlists = playlists.map((item) => (item.id === op.tempId ? created : item))
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
    playlists = replacePlaylist(playlists, updated)
  } else if (op.type === "delete") {
    await api.deleteMemberPlaylist(id)
    markPlaylistSuppressedAfterDelete(op.id)
    playlists = playlists.filter((item) => item.id !== op.id && item.id !== id)
  } else if (op.type === "add") {
    const updated = await api.addMemberPlaylistSong(id, op.songNumber)
    playlists = replacePlaylist(playlists, updated)
  } else if (op.type === "remove") {
    const updated = await api.removeMemberPlaylistSong(id, op.songNumber)
    playlists = replacePlaylist(playlists, updated)
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
  queue = []
  idMap = new Map()
  suppressedRemoteIds.clear()
  inFlightDeletes.clear()
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  flushing = false
}