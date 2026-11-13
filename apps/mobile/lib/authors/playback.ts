import { playArtist } from "@/lib/kirtan/mixPlayback"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { fromRemote } from "@/lib/kirtan/submissions"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Play the recordings of an author page in the one player. The server rows are put into the Kiirtan catalog first (the
 * queue turns an id back into a track from there), then they play as one queue named after the author. Nothing here
 * has its own player.
 */
export function playAuthor(
  author: { slug: string; name: string },
  items: readonly RemoteRecording[],
  opts: { startId?: string | null; shuffle?: boolean } = {},
): string | null {
  useKirtanStore.getState().addToCatalog(items)
  const list = items.map((r) => fromRemote(r))
  const start = opts.startId ? list.find((k) => k.serverId === opts.startId)?.id ?? null : null
  return playArtist({ id: `author-${author.slug}`, name: author.name }, list, { startId: start, shuffle: opts.shuffle })
}
