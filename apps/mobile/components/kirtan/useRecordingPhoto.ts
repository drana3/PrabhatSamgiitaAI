import { useEffect, useState } from "react"

import { authorsApi } from "@/lib/authors/api"
import type { Kirtan } from "@/lib/kirtan/types"

/** Remembered answers of "whose page is this recording on, and what is their photo", so reopening a page asks once. */
const authorPhotos = new Map<string, string | null>()

/**
 * The photo a recording's page shows (docs/kiirtan-cycle.md "The page"): the recording's own cover, else the photo of the
 * author page it is on, else nothing (the page then draws the Kiirtan gradient or stock picture, the same every time).
 * A recording does not know its set, so a set's photo is not a source here.
 */
export function useRecordingPhoto(k: Pick<Kirtan, "thumbnailUrl" | "serverId">): string | null {
  const id = k.serverId ?? null
  const [author, setAuthor] = useState<string | null>(id ? (authorPhotos.get(id) ?? null) : null)
  const needs = !k.thumbnailUrl && Boolean(id)
  useEffect(() => {
    if (!needs || !id) return undefined
    if (authorPhotos.has(id)) {
      setAuthor(authorPhotos.get(id) ?? null)
      return undefined
    }
    let live = true
    authorsApi()
      .byRecording(id)
      .then(
        (card) => {
          const photo = card?.photo_url ?? null
          authorPhotos.set(id, photo)
          if (live) setAuthor(photo)
        },
        () => undefined,
      )
    return () => {
      live = false
    }
  }, [needs, id])
  return k.thumbnailUrl ?? author
}
