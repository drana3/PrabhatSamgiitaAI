import { Platform } from "react-native"

import { href } from "@/utils/href"

type SongRouter = {
  canDismiss: () => boolean
  dismiss: () => void
  push: (value: ReturnType<typeof href>) => void
}

/** Canonical `/song/ps-N` path. */
export function songPath(songId: string | number, extraQuery?: string) {
  const raw = String(songId).trim()
  const id = raw.toLowerCase().startsWith("ps-") ? raw : `ps-${raw}`
  const base = `/song/${id}`
  return extraQuery ? `${base}?${extraQuery}` : base
}

/**
 * Open the song screen.
 * iOS Explore is a modal — dismiss first so the player is not trapped under it.
 * Android Explore is a card — push immediately (dismiss+push was crashy and slow).
 */
export function openSongScreen(router: SongRouter, songId: string | number, extraQuery?: string) {
  const path = href(songPath(songId, extraQuery))
  if (Platform.OS === "android" || !router.canDismiss()) {
    router.push(path)
    return
  }
  router.dismiss()
  router.push(path)
}
