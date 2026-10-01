import { api } from "@/lib/client"
import type { MemberPlaylist } from "@prabhat/core"
import { songDetailToMockSong } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"

export async function playPlaylist(playlist: MemberPlaylist): Promise<string | null> {
  const numbers = [...playlist.songs]
    .sort((left, right) => left.position - right.position)
    .map((song) => song.song_number)
  if (!numbers.length) return "This playlist has no songs yet."
  const detail = await api.fetchSong(numbers[0])
  if (!detail) return "Could not start the first song."
  usePlayerStore.getState().loadSong(songDetailToMockSong(detail), numbers, "playlist")
  return null
}
