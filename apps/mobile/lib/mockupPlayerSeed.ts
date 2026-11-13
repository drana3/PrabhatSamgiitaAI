import { useEffect } from "react"

import { TODAY_FIXTURE_SONGS } from "@/lib/fixtures/today"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { songSummaryToMockSong } from "@/lib/songMap"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * TODO(api): preview only (MOCKUP_DATA). The prototype's boards show the mini-player with PS 3 paused at
 * 1:12 of 4:31 on every tab. This puts that song into the player store when nothing is loaded, so the
 * mini-player pill and the tab screens look like the boards. Does nothing in real builds.
 */
export function useMockupPlayerSeed() {
  useEffect(() => {
    if (!MOCKUP_DATA) return
    const state = usePlayerStore.getState()
    if (state.currentSong) return
    const fix = TODAY_FIXTURE_SONGS[2]
    const song = songSummaryToMockSong({ number: fix.number, title: fix.title, first_line: fix.firstLine, is_verified: true })
    usePlayerStore.setState({ currentSong: { ...song, durationSeconds: fix.seconds }, isPlaying: false, position: 72, duration: fix.seconds })
  }, [])
}
