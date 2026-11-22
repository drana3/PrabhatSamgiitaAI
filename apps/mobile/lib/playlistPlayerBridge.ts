import { randomPlayableSongNumber } from "@/lib/playableAudio"
import { usePlayerStore } from "@/stores/playerStore"

/** Drop playlist session metadata when a playlist is removed; never stop Drive random audio. */
export function releasePlaybackForDeletedPlaylist(playlistId: string): void {
  const state = usePlayerStore.getState()
  if (state.activePlaylist?.id !== playlistId) return

  const inDrive = state.driveAutoAdvance
  const inPlaylistMode = state.playbackMode === "playlist"

  if (inDrive && inPlaylistMode) {
    const keep = state.currentSong?.number
    const fallback = keep ?? randomPlayableSongNumber(0)
    usePlayerStore.setState({
      activePlaylist: null,
      playlistBounds: null,
      playbackMode: "random",
      queue: keep != null ? [keep] : [fallback],
    })
    return
  }

  if (inPlaylistMode) {
    usePlayerStore.setState({
      activePlaylist: null,
      playlistBounds: null,
      playbackMode: "default",
    })
    return
  }

  usePlayerStore.setState({ activePlaylist: null })
}