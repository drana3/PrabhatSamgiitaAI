import { useEffect, useRef } from "react"

import { videoFailure, videosBackend } from "@/lib/recordingVideos/backend"
import type { VideoFailure } from "@/lib/recordingVideos/types"
import { linkTarget, videoLinkToSend, type LinkRow } from "@/lib/recordingVideos/uploadLink"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Sends the link typed on the Kiirtan upload form once the recording is up (lib/recordingVideos/uploadLink.ts). One try per
 * recording. `onSent` when it was added; `onFailed` with the reason when it could not be, so the screen can say where to add it by hand.
 */
export function useSendVideoLink({ rows, link, onSent, onFailed }: { rows: readonly LinkRow[]; link: string; onSent: () => void; onFailed: (failure: VideoFailure) => void }): void {
  const submissions = useKirtanStore((s) => s.submissions)
  const target = linkTarget(rows, submissions)
  const address = videoLinkToSend(link)
  const tried = useRef<string | null>(null)
  useEffect(() => {
    if (!target || !address || tried.current === target) return
    tried.current = target
    videosBackend()
      .add({ kind: "recording", id: target }, { url: address, title: null, isAnonymous: false })
      .then(onSent, (error) => onFailed(videoFailure(error)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, address])
}
