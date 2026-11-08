import { Audio } from "expo-av"
import { useSyncExternalStore } from "react"

import { registerExtraAudioCleanup, yieldSongPlayback } from "@/lib/audioFocus"
import { createPreviewCore } from "@/lib/kirtan/previewCore"

/**
 * The small preview player of the duplicate card (docs/duplicate-check.md, "What the phone shows"). It is its OWN player: it
 * does not use the app's player or its queue, so the radio, the queue and the mini-player are not rebuilt by a listen. A song
 * that is playing is paused first (the same call the pronunciation clips use), and the preview is let go when a song or
 * another extra audio takes the session back. The card stops it when it closes or when the person answers.
 * Logic and its rules: lib/kirtan/previewCore.ts.
 */
const core = createPreviewCore({
  yieldOthers: async () => {
    await yieldSongPlayback()
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false, staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false })
  },
  load: async (url, onEnd) => {
    const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true, volume: 1 })
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) onEnd()
    })
    return {
      stop: async () => {
        await sound.stopAsync().catch(() => undefined)
        await sound.unloadAsync().catch(() => undefined)
      },
    }
  },
})

registerExtraAudioCleanup(() => core.stop())

/** Plays (or, for the one that plays, stops) the preview of a recording's file. */
export const playPreview = core.play
export const stopPreview = core.stop

/** The id that plays now (null when none): re-renders the rows of the card. */
export function usePreviewing(): string | null {
  return useSyncExternalStore(core.subscribe, core.playing, () => null)
}
