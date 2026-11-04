import { useCallback, useState } from "react"
import { Linking } from "react-native"
import { useRouter } from "expo-router"

import { youtubeWatchUrl } from "@/lib/kirtan/youtube"
import type { Kirtan } from "@/lib/kirtan/types"
import { useKirtanPlayerStore } from "@/stores/kirtanPlayerStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

/** Actions shared by the kirtan lists and the mix screen: open the player, queue, save, report. */
export function useKirtanActions() {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2200)
  }, [])

  /** `context` is the list shown, so previous and next in the player follow it. */
  const open = useCallback(
    (k: Kirtan, context: readonly string[]) => {
      if (k.status !== "approved") {
        flash(k.status === "pending" ? "Waiting for review. It plays once it is approved." : "This one was not accepted.")
        return
      }
      useKirtanPlayerStore.getState().start(k.id, context)
      router.push(href(`/kirtan-player?id=${encodeURIComponent(k.id)}`))
    },
    [flash, router],
  )

  const playNext = useCallback(
    (k: Kirtan) => {
      useKirtanPlayerStore.getState().playNext(k.id)
      flash("Plays next in the kirtan player")
    },
    [flash],
  )

  // TODO(api): kirtans in playlists need the backend; playlists hold songs only today.
  const addToPlaylist = useCallback(() => flash("Kirtans in playlists are coming soon"), [flash])

  const toggleSaved = useCallback(
    (k: Kirtan) => {
      const nowSaved = useKirtanStore.getState().toggleSaved(k.id)
      flash(nowSaved ? "Saved" : "Removed from saved")
    },
    [flash],
  )

  const openOnYouTube = useCallback(
    (k: Kirtan) => {
      void Linking.openURL(youtubeWatchUrl(k.videoId)).catch(() => flash("Could not open YouTube"))
    },
    [flash],
  )

  // TODO(api): send the report to the moderators.
  const report = useCallback(
    (k: Kirtan) => {
      useKirtanStore.getState().report(k.id)
      flash("Thank you. We will take a look.")
    },
    [flash],
  )

  return { toast, flash, open, playNext, addToPlaylist, toggleSaved, openOnYouTube, report }
}
