import { Image } from "expo-image"

import { scenicArtList } from "@/data/mock"

let started = false

/** Warm expo-image disk cache for scenic hero backgrounds. */
export function prefetchScenicArt() {
  if (started) return
  started = true
  for (const uri of scenicArtList) {
    void Image.prefetch(uri, { cachePolicy: "memory-disk" })
  }
}
