import { Image } from "expo-image"
import { InteractionManager } from "react-native"

import { scenicHeroList, scenicThumbList } from "@/lib/scenicArt"

let started = false

/** Warm expo-image cache: small thumbs first, then hero backgrounds. */
export function prefetchScenicArt() {
  if (started) return
  started = true

  for (const uri of scenicThumbList) {
    void Image.prefetch(uri, { cachePolicy: "memory-disk" })
  }

  InteractionManager.runAfterInteractions(() => {
    for (const uri of scenicHeroList) {
      void Image.prefetch(uri, { cachePolicy: "memory-disk" })
    }
  })
}

/** Prefetch one song's scenic pair as soon as we know the song number. */
export function prefetchScenicForSong(number: number) {
  const index = Math.abs(number) % scenicHeroList.length
  const thumb = scenicThumbList[index]
  const hero = scenicHeroList[index]
  if (thumb) void Image.prefetch(thumb, { cachePolicy: "memory-disk" })
  if (hero) void Image.prefetch(hero, { cachePolicy: "memory-disk" })
}
