import type { MemberPlaylist } from "@prabhat/core"

import { hasPlayableAudio, nextPlayableInQueue } from "@/lib/playableAudio"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { peekSongDetail } from "@/lib/songCache"
import { songDetailToMockSong, songSummaryToMockSong } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"

export function starterSongForNumber(number: number) {
  const cached = peekSongDetail(number)
  if (cached) return songDetailToMockSong(cached)
  const hit = catalogSongsByNumbers([number], 1)[0]
  return songSummaryToMockSong({
    number,
    title: hit?.firstLine || hit?.title || `Prabhat Samgiita ${number}`,
    first_line: hit?.snippet || hit?.firstLine,
    is_verified: Boolean(hit),
  })
}

export function playlistSongNumbers(playlist: MemberPlaylist): number[] {
  return [...playlist.songs]
    .sort((left, right) => left.position - right.position)
    .map((song) => song.song_number)
}

export async function playPlaylist(
  playlist: MemberPlaylist,
  startAt?: number,
): Promise<string | null> {
  const numbers = playlistSongNumbers(playlist)
  if (!numbers.length) return "This playlist has no songs yet."

  const requested =
    startAt != null && numbers.includes(startAt) ? startAt : numbers[0]
  const start = hasPlayableAudio(requested)
    ? requested
    : nextPlayableInQueue(numbers, requested, 1) ??
      numbers.find((n) => hasPlayableAudio(n)) ??
      requested
  usePlayerStore.setState({
    activePlaylist: { id: playlist.id, name: playlist.name },
  })

  const song = starterSongForNumber(start)
  // Always start a fresh playlist session (replaces casual Explore playback).
  usePlayerStore.getState().loadSong(song, numbers, "playlist")

  return null
}
