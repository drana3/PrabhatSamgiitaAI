import type { TranslateFn } from "@/lib/i18n"

import type { VideoFailure } from "./types"

/** The sentence a person is told for each failure of a video link (locales/recordingExtras.ts, `recVideos.failure.*`). */
export function videoFailureText(tr: TranslateFn, failure: VideoFailure): string {
  return tr(`recVideos.failure.${failure}`)
}
