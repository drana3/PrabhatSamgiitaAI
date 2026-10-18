import { songToTrack, trackIdToSongNumber } from "@/lib/playback/catalogTrack"
import * as rntp from "@/lib/playback/rntpCatalogPlayer"

export { songToTrack, trackIdToSongNumber }
export type { CatalogTrack } from "@/lib/playback/catalogTrack"

/** RNTP v5 (New Architecture) powers catalog playback on both iOS and Android. */
function impl() {
  return rntp
}

export const registerNativePlayerListeners = (...args: Parameters<typeof rntp.registerNativePlayerListeners>) =>
  impl().registerNativePlayerListeners(...args)
export const setupNativeCatalogPlayer = () => impl().setupNativeCatalogPlayer()
export const resetNativeCatalog = () => impl().resetNativeCatalog()
export const playTrackNow = (...args: Parameters<typeof rntp.playTrackNow>) => impl().playTrackNow(...args)
export const enqueueTrack = (...args: Parameters<typeof rntp.enqueueTrack>) => impl().enqueueTrack(...args)
export const nativePlay = () => impl().nativePlay()
export const nativePause = () => impl().nativePause()
export const nativeStop = () => impl().nativeStop()
export const nativeSeek = (...args: Parameters<typeof rntp.nativeSeek>) => impl().nativeSeek(...args)
export const nativeSetVolume = (...args: Parameters<typeof rntp.nativeSetVolume>) =>
  impl().nativeSetVolume(...args)
export const nativeSkipToNext = () => impl().nativeSkipToNext()
export const nativeSkipToPrevious = () => impl().nativeSkipToPrevious()
export const nativeSetRepeatTrack = (...args: Parameters<typeof rntp.nativeSetRepeatTrack>) =>
  impl().nativeSetRepeatTrack(...args)
export const nativeQueueLengthPastIndex = () => impl().nativeQueueLengthPastIndex()
export const nativeRemoveUpcomingTracks = () => impl().nativeRemoveUpcomingTracks()
export const getActiveCatalogTrackNumber = () => impl().getActiveCatalogTrackNumber()
