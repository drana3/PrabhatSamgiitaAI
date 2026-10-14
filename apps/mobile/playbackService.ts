import TrackPlayer, { Event } from "react-native-track-player"

import { ensureUpcomingRadioTrack } from "@/lib/playback/radioAdvance"
import { getRadioSession } from "@/lib/playback/radioSession"

/** Headless service — lock screen / overnight. Must not depend on React UI. */
export async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    void TrackPlayer.play()
  })
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    void TrackPlayer.pause()
  })
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    void TrackPlayer.stop()
  })
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    void (async () => {
      await ensureUpcomingRadioTrack()
      try {
        await TrackPlayer.skipToNext()
      } catch {
        /* last track */
      }
    })()
  })
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    if (getRadioSession().kind === "drive-random") {
      void TrackPlayer.seekTo(0)
      return
    }
    void TrackPlayer.skipToPrevious()
  })
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    if (typeof event.position === "number") void TrackPlayer.seekTo(event.position)
  })
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
    void ensureUpcomingRadioTrack()
  })
}
