import { lastPickStillAllowed } from "@/lib/radio/live"
import { ensureUpcomingRadioTrack } from "@/lib/playback/radioAdvance"
import { nativeQueueLengthPastIndex, nativeRemoveUpcomingTracks } from "@/lib/playback/nativeCatalogPlayer"
import { getRadioSession } from "@/lib/playback/radioSession"
import { isTrackPlayerLinked } from "@/lib/playback/trackPlayerBridge"
import { useKirtanStore } from "@/stores/kirtanStore"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"

/**
 * A change of the choice (or of the blocked authors) while the Radio plays. The track playing now is never touched. The native player keeps one track
 * ready after it; if that one was picked from a category the person has just switched off, it is replaced by a new pick
 * under the new choice, so the change shows from the NEXT track. A track that is still allowed stays (no needless swap).
 * The web preview has no native queue: there the next pick simply reads the new choice.
 */
export async function applyRadioSelectionChange(): Promise<void> {
  if (!isTrackPlayerLinked()) return
  if (getRadioSession().kind !== "drive-random") return
  if (lastPickStillAllowed()) return
  try {
    if ((await nativeQueueLengthPastIndex()) < 1) return
    await nativeRemoveUpcomingTracks()
    await ensureUpcomingRadioTrack()
  } catch {
    /* the next track-end event picks again */
  }
}

/** Start watching the choice; returns the stop function (the Radio screen calls it from an effect). */
export function watchRadioSelection(): () => void {
  const stopSelection = useRadioSelectionStore.subscribe((state, prev) => {
    if (state.selected === prev.selected) return
    void applyRadioSelectionChange()
  })
  // blocking an author while one of their recordings is the queued next track drops it the same way
  const stopBlocks = useKirtanStore.subscribe((state, prev) => {
    if (state.blockedAuthorIds === prev.blockedAuthorIds) return
    void applyRadioSelectionChange()
  })
  return () => {
    stopSelection()
    stopBlocks()
  }
}
