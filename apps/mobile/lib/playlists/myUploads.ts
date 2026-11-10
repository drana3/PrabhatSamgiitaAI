import type { Kirtan, RecordingKind } from "@/lib/kirtan/types"
import { defaultCoverFor } from "@/lib/playlists/playlistCover"

/**
 * The automatic playlist "My uploads" (pure). It is not a row of the playlists table: it is built from the person's own
 * uploads that the Kiirtan tab already keeps (stores/kirtanStore `submissions`, the data behind components/kirtan/MyUploads),
 * every kind of recording, newest first. It cannot be renamed, deleted or edited by hand (the list IS the uploads), and it
 * exists only while at least one upload is live. Opening it goes to the Kiirtan tab's My uploads list, so nothing is duplicated.
 */
export const MY_UPLOADS_ID = "system:my-uploads"

/** Where a tap on the row goes: the existing My uploads shelf of the Kiirtan tab. */
export const MY_UPLOADS_ROUTE = "/v2/kiirtan?filter=mine"

type UploadLike = Pick<Kirtan, "id" | "title" | "addedAt" | "status"> & { kind?: RecordingKind }

export type MyUploadsItem = { id: string; title: string; kind: RecordingKind; addedAt: number }

export type MyUploadsPlaylist = {
  id: typeof MY_UPLOADS_ID
  /** live recordings, newest first */
  items: MyUploadsItem[]
  count: number
  /** stock photo number for the tile (stable) */
  cover: number
  editable: false
}

/**
 * The live uploads (status "published": the server has them) as a playlist, or null when there are none. Uploads still
 * running, failed or taken down are not in the list (the shelf shows those, with their reasons).
 */
export function buildMyUploads(submissions: readonly UploadLike[]): MyUploadsPlaylist | null {
  const items = submissions
    .map((k, index) => ({ k, index }))
    .filter(({ k }) => k.status === "published")
    .sort((a, b) => b.k.addedAt - a.k.addedAt || b.index - a.index)
    .map(({ k }): MyUploadsItem => ({ id: k.id, title: k.title, kind: k.kind ?? "kiirtan", addedAt: k.addedAt }))
  if (!items.length) return null
  return { id: MY_UPLOADS_ID, items, count: items.length, cover: defaultCoverFor(MY_UPLOADS_ID), editable: false }
}

/** The system list is not a stored playlist: rename, delete and song edits are refused for it. */
export function isSystemPlaylistId(id: string): boolean {
  return id.startsWith("system:")
}
