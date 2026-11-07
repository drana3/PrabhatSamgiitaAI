import type { PlaylistSyncOp } from "@/lib/playlistSyncQueue"

/**
 * Collapse a pending playlist sync queue before it is sent, so a quick
 * add-then-remove never hits the server and ten renames become one.
 * Pure: takes the queue, returns a new queue in the same order of intent.
 *
 * Rules:
 *  - add(id, n) followed by remove(id, n) cancel out; so do remove then add.
 *  - a repeated add or remove of the same song keeps one.
 *  - only the last rename of a playlist is kept; a rename of a playlist whose
 *    create is still pending changes the create's name instead.
 *  - delete drops every earlier op on that playlist; if the playlist was only
 *    created locally (create op pending), the create is dropped too and no
 *    delete is sent.
 */
export function coalescePlaylistOps(ops: readonly PlaylistSyncOp[]): PlaylistSyncOp[] {
  let out: PlaylistSyncOp[] = []

  for (const op of ops) {
    if (op.type === "create") {
      out.push(op)
      continue
    }

    if (op.type === "rename") {
      const pendingCreate = out.findIndex((prev) => prev.type === "create" && prev.tempId === op.id)
      if (pendingCreate >= 0) {
        // the playlist does not exist on the server yet: create it with the final name
        const created = out[pendingCreate] as Extract<PlaylistSyncOp, { type: "create" }>
        out[pendingCreate] = { ...created, name: op.name }
        continue
      }
      out = out.filter((prev) => !(prev.type === "rename" && prev.id === op.id))
      out.push(op)
      continue
    }

    if (op.type === "delete") {
      const created = out.some((prev) => prev.type === "create" && prev.tempId === op.id)
      out = out.filter((prev) => {
        if (prev.type === "create") return prev.tempId !== op.id
        return prev.id !== op.id
      })
      if (!created) out.push(op)
      continue
    }

    // add / remove of one song in one playlist
    const sameSong = (prev: PlaylistSyncOp) =>
      (prev.type === "add" || prev.type === "remove") &&
      prev.id === op.id &&
      prev.songNumber === op.songNumber
    let lastIndex = -1
    for (let i = out.length - 1; i >= 0; i -= 1) {
      if (sameSong(out[i])) {
        lastIndex = i
        break
      }
    }
    if (lastIndex < 0) {
      out.push(op)
      continue
    }
    const last = out[lastIndex]
    if (last.type === op.type) continue
    out.splice(lastIndex, 1)
  }

  return out
}

/** Number of requests that would be sent for this queue. */
export function pendingRequestCount(ops: readonly PlaylistSyncOp[]): number {
  return coalescePlaylistOps(ops).length
}
