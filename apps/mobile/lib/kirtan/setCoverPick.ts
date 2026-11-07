import * as ImageManipulator from "expo-image-manipulator"

import { pickProfileImage } from "@/lib/profile/photo"
import { shrinkCover, type CoverMade } from "@/lib/kirtan/setCover"

/**
 * Choose a picture from the library and make it a small JPEG for a playlist cover. The expo calls are here so
 * lib/kirtan/setCover.ts stays plain code that tests can run.
 */

export type CoverPick = { status: "ok"; uri: string } | { status: "cancelled" } | { status: "denied"; canAskAgain: boolean } | { status: "tooBig" } | { status: "error" }

async function sizeOf(uri: string): Promise<number> {
  const response = await fetch(uri)
  return (await response.blob()).size
}

export async function pickCover(): Promise<CoverPick> {
  const picked = await pickProfileImage("library")
  if (picked.status !== "ok") return picked.status === "error" ? { status: "error" } : picked
  const made: CoverMade = await shrinkCover(async (step) => {
    const width = Math.min(step.width, picked.image.width)
    const result = await ImageManipulator.manipulateAsync(picked.image.uri, [{ resize: { width } }], { compress: step.quality, format: ImageManipulator.SaveFormat.JPEG })
    return result.uri
  }, sizeOf)
  return made.status === "ok" ? { status: "ok", uri: made.uri } : { status: made.status }
}

/** The bytes of a chosen cover, ready to send. */
export async function coverBlob(uri: string): Promise<{ blob: Blob; type: string }> {
  const blob = await (await fetch(uri)).blob()
  return { blob, type: blob.type || "image/jpeg" }
}
