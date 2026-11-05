import type { MemberPlaylist } from "@prabhat/core"

/** Epoch ms for sorting / labels — local optimistic ids embed Date.now(). */
export function playlistCreatedMs(playlist: MemberPlaylist): number {
  if (playlist.created_at) {
    const parsed = Date.parse(playlist.created_at)
    if (!Number.isNaN(parsed)) return parsed
  }
  const local = /^local-(\d+)-/.exec(playlist.id)
  if (local) {
    const ms = Number(local[1])
    if (Number.isFinite(ms)) return ms
  }
  return 0
}

export function formatPlaylistCreatedLabel(playlist: MemberPlaylist): string {
  const ms = playlistCreatedMs(playlist)
  if (!ms) return ""
  return `Created ${new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`
}

export function sortPlaylistsNewestFirst(playlists: MemberPlaylist[]): MemberPlaylist[] {
  return [...playlists].sort((a, b) => playlistCreatedMs(b) - playlistCreatedMs(a))
}
