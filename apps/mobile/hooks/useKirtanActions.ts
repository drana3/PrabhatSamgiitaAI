import { useCallback, useState } from "react"
import { useRouter } from "expo-router"

import { ensureKirtansRegistered } from "@/lib/kirtan/catalog"
import { t } from "@/lib/i18n"
import { playArtist, playKiirtans } from "@/lib/kirtan/mixPlayback"
import { realQueueActions } from "@/lib/playerV2/services"
import { kiirtanNumber } from "@/lib/kirtan/track"
import type { Kirtan } from "@/lib/kirtan/types"
import { usePlayerStore } from "@/stores/playerStore"
import { openSaveSheet } from "@/stores/saveSheetStore"
import { href } from "@/utils/href"

/** What a tap on a recording that is not live says. */
function notLiveToast(status: Kirtan["status"]): string {
  return status === "removed" ? t("ugc.toast.removed") : status === "failed" ? t("ugc.toast.failed") : t("ugc.toast.uploading")
}

/** Actions shared by the Kiirtan lists, the artist page and the mix screen: play, queue, save. (Report and Block live in the row menu, see components/kirtan/KirtanMenus.) */
export function useKirtanActions() {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => {
    if (!message) return
    setToast(message)
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2200)
  }, [])

  /**
   * Plays `context` (the list shown) in the one player, starting at `k`, so previous and next follow
   * the list. The pill appears by itself; the full player opens from the pill.
   */
  const open = useCallback(
    (k: Kirtan, context: readonly Kirtan[], label?: string | null) => {
      if (k.status !== "published") {
        flash(notLiveToast(k.status))
        return
      }
      const message = playKiirtans(context, k.id, label)
      if (message) flash(message)
    },
    [flash],
  )

  /** Play from an artist page: the queue is the artist's list and "Playing from" shows the artist's name. */
  const openIn = useCallback(
    (k: Kirtan, context: readonly Kirtan[], artist: { id: string; name: string }) => {
      if (k.status !== "published") {
        flash(notLiveToast(k.status))
        return
      }
      const message = playArtist(artist, context, { startId: k.id })
      if (message) flash(message)
    },
    [flash],
  )

  /** Open the artist page. */
  const openArtist = useCallback((artistId: string) => router.push(href(`/kirtan-artist?id=${encodeURIComponent(artistId)}`)), [router])

  const playNext = useCallback(
    (k: Kirtan) => {
      ensureKirtansRegistered()
      if (!usePlayerStore.getState().currentSong) {
        flash(playKiirtans([k], k.id) ?? "")
        return
      }
      realQueueActions().playNext(kiirtanNumber(k.id))
      flash(t("kt.toast.playsNext"))
    },
    [flash],
  )

  // TODO(api): Kiirtans in playlists need the backend; playlists hold songs only today.
  const addToPlaylist = useCallback((k?: Kirtan) => flash(t(k?.kind === "bhajan" ? "kt.toast.playlistsSoon.bhajan" : "kt.toast.playlistsSoon.kiirtan")), [flash])

  /** Opens the "Save to" sheet for the Kiirtan (Mine only); the sheet says what happened. */
  const toggleSaved = useCallback((k: Kirtan) => openSaveSheet({ kind: "kiirtan", id: k.id }), [])

  return { toast, flash, open, openIn, openArtist, playNext, addToPlaylist, toggleSaved }
}
