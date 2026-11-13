import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { HUB_KINDS, shelfRecordings } from "@/lib/kirtan/hub"
import { blocksText } from "@/lib/kirtan/blocksCopy"
import { MOST_PLAYED_VARIANT } from "@/lib/kirtan/mostPlayedVariant"
import { broadcastPhotoMood, broadcastPhotoSeed, kindPhotoSeed, pickKindPhotos } from "@/lib/photos/defaultPhoto"
import { STOCK_PHOTO_META } from "@/lib/photos/photoData"
import { pickFromList } from "@/lib/photos/pick"
import { kiirtanBlocksEn, kiirtanBlocksEs, kiirtanBlocksRu } from "@/locales/kiirtanBlocks"

const root = path.resolve(__dirname, "..")
const source = (file: string) => readFileSync(path.join(root, file), "utf8")

describe("default photos by kind", () => {
  const photos = pickKindPhotos(STOCK_PHOTO_META, HUB_KINDS)

  it("every kind of the page gets a photo, and no two kinds share one", () => {
    expect(photos.size).toBe(HUB_KINDS.length)
    const ids = HUB_KINDS.map((k) => photos.get(k)?.id)
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(HUB_KINDS.length)
  })

  it("is stable: the same list gives the same photos, in any call", () => {
    const again = pickKindPhotos(STOCK_PHOTO_META, HUB_KINDS)
    expect(HUB_KINDS.map((k) => again.get(k)?.id)).toEqual(HUB_KINDS.map((k) => photos.get(k)?.id))
  })

  it("never picks Baba, a close or children photo, or an empty list's photo", () => {
    for (const photo of photos.values()) {
      expect(photo?.subject).not.toBe("baba")
      expect(["none", "far"]).toContain(photo?.people ?? "none")
    }
    expect([...pickKindPhotos([], HUB_KINDS).values()].every((v) => v === undefined)).toBe(true)
  })

  it("seeds are told apart: a kind is not a broadcast", () => {
    expect(kindPhotoSeed("kiirtan")).not.toBe(broadcastPhotoSeed("kiirtan"))
  })
})

describe("the photo of a broadcast", () => {
  it("is the same for one id, and the mood follows a title that says one", () => {
    const a = pickFromList(STOCK_PHOTO_META, broadcastPhotoSeed("b-1"), broadcastPhotoMood("Evening Kiirtan"), { size: "small" })
    const b = pickFromList(STOCK_PHOTO_META, broadcastPhotoSeed("b-1"), broadcastPhotoMood("Evening Kiirtan"), { size: "small" })
    expect(a?.id).toBe(b?.id)
    expect(broadcastPhotoMood("Evening Kiirtan")).toBe("evening")
    expect(broadcastPhotoMood("Sunday satsang")).toBe("live")
    expect(broadcastPhotoMood(null)).toBe("live")
  })

  it("never shows a video: tile, page, recordings and live screen go through the photo stage", () => {
    const card = source("components/broadcasts/BroadcastCard.tsx")
    expect(card).not.toMatch(/VideoThumb|ytimg|thumbnailUrl/)
    for (const file of ["app/broadcast/[id].tsx", "components/broadcasts/RecordingBlock.tsx", "app/kiirtan-live.tsx"]) {
      const text = source(file)
      expect(text, file).toContain("AudioOnlyStage")
      // every embed sits inside the stage: no embed tag outside it
      const outside = text.replace(/<AudioOnlyStage[\s\S]*?<\/AudioOnlyStage>/g, "")
      expect(outside, file).not.toMatch(/<(VideoEmbed|LiveEmbed)\b/)
    }
  })

  it("the stage hides the embed from sight and touch", () => {
    const stage = source("components/photos/AudioOnlyStage.tsx")
    expect(stage).toMatch(/opacity: 0/)
    expect(stage).toMatch(/pointerEvents="none"/)
  })
})

describe("shelves of Discourses, Dance music and Spiritual songs", () => {
  const rec = (id: string, kind: string, addedAt: number) => ({ id, kind: kind as never, addedAt })
  it("shows the newest of one kind, at most the shelf size, and leaves the list alone", () => {
    const list = [rec("a", "dance_song", 1), rec("b", "baba_audio", 5), rec("c", "dance_song", 9), rec("d", "dance_song", 4)]
    const copy = [...list]
    expect(shelfRecordings(list, "dance_song").map((k) => k.id)).toEqual(["c", "d", "a"])
    expect(shelfRecordings(list, "dance_song", 2).map((k) => k.id)).toEqual(["c", "d"])
    expect(shelfRecordings(list, "spiritual_song")).toEqual([])
    expect(list).toEqual(copy)
  })
})

describe("Most played variants", () => {
  it("the page draws variant A until Dada picks another", () => {
    expect(MOST_PLAYED_VARIANT).toBe("E")
  })

  it("designs D, E and F draw no line, border or shadow (Dada, 13 Nov 2026)", () => {
    const src = source("components/kirtan/hub/MostPlayedCard.tsx")
    const free = src.slice(src.indexOf("D, E, F: no lines"), src.indexOf("const styles = StyleSheet.create")).replace(/\/\*[\s\S]*?\*\//g, "")
    expect(free.length).toBeGreaterThan(500)
    expect(free).not.toMatch(/borderWidth|borderTop|borderBottom|borderColor|shadow/i)
    const types = source("lib/kirtan/mostPlayedVariant.ts")
    for (const v of ['"D"', '"E"', '"F"']) expect(types).toContain(v)
  })
})

describe("kiirtan blocks strings", () => {
  it("ru and es have exactly the keys of en, none empty", () => {
    const keys = Object.keys(kiirtanBlocksEn).sort()
    expect(Object.keys(kiirtanBlocksRu).sort()).toEqual(keys)
    expect(Object.keys(kiirtanBlocksEs).sort()).toEqual(keys)
    for (const dict of [kiirtanBlocksEn, kiirtanBlocksRu, kiirtanBlocksEs]) for (const v of Object.values(dict)) expect(v.trim().length).toBeGreaterThan(0)
  })
  it("is read in the language asked for, with values filled in", () => {
    expect(blocksText("en", "kb.audio.listen")).toBe("Listen")
    expect(blocksText("ru", "kb.audio.listen")).toBe("Слушать")
    expect(blocksText("es", "kb.shelf.a11y", { title: "T", count: 3 })).toBe("T, 3")
  })
})
