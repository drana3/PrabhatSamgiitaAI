import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { RECORDING_KINDS } from "@/lib/kirtan/types"
import { hashSeed } from "@/lib/photos/pick"
import { STOCK_PHOTO_META } from "@/lib/photos/photoData"
import { KIND_MOOD, pickRecordingPhoto, recordingMood, recordingSeed } from "@/lib/photos/recordingPhoto"

/** Dada, 10 Nov 2026: nobody uploads a photo; the system gives every uploaded recording one from our library, by its id and its kind or mood. */

const IDS = Array.from({ length: 400 }, (_, i) => `recording-${i}-${hashSeed(`x${i}`).toString(16)}`)
const photoOf = (id: string, kind: string, title = "A recording", durationSec: number | null = 600) => pickRecordingPhoto(STOCK_PHOTO_META, { id, kind, title, durationSec })

describe("the photo of a recording", () => {
  it.each(RECORDING_KINDS)("is the same every time for the same id (%s)", (kind) => {
    for (const id of IDS.slice(0, 40)) expect(photoOf(id, kind)?.id).toBe(photoOf(id, kind)?.id)
  })

  it.each(RECORDING_KINDS)("varies across ids (%s): the library is used, not one placeholder", (kind) => {
    const used = new Set(IDS.map((id) => photoOf(id, kind)?.id))
    expect(used.has(undefined)).toBe(false)
    expect(used.size).toBeGreaterThanOrEqual(5)
    // no single photo takes more than a third of the recordings
    const counts = new Map<string | undefined, number>()
    for (const id of IDS) counts.set(photoOf(id, kind)?.id, (counts.get(photoOf(id, kind)?.id) ?? 0) + 1)
    expect(Math.max(...counts.values())).toBeLessThan(IDS.length / 3)
  })

  it("gives every kind a photo, never one with a face close up, a child, a low-resolution picture or Baba", () => {
    for (const kind of RECORDING_KINDS) {
      for (const id of IDS.slice(0, 60)) {
        const photo = photoOf(id, kind)
        expect(photo).toBeDefined()
        expect(["close", "children"]).not.toContain(photo?.people)
        expect(photo?.lowRes).not.toBe(true)
        expect(photo?.subject).not.toBe("baba")
      }
    }
  })

  it("is chosen by the id, not by the title or the kind: the same id keeps its photo when the kind is read as an old name", () => {
    expect(photoOf("abc", "devotional_song")?.id).toBe(photoOf("abc", "bhajan")?.id)
    expect(photoOf("abc", null as unknown as string)?.id).toBe(photoOf("abc", "kiirtan")?.id)
  })

  it("follows the mood of the kind: Dance music festival, a talk calm, a Kiirtan any warm photo", () => {
    expect(KIND_MOOD.dance_song).toBe("festival")
    expect(KIND_MOOD.baba_audio).toBe("calm")
    expect(KIND_MOOD.spiritual_song).toBe("calm")
    expect(KIND_MOOD.kiirtan).toBeUndefined()
    for (const id of IDS.slice(0, 60)) expect(photoOf(id, "dance_song")?.moods).toContain("festival")
    for (const id of IDS.slice(0, 60)) expect(photoOf(id, "baba_audio")?.moods).toContain("calm")
  })

  it("lets the title and the length decide the mood before the kind does", () => {
    expect(recordingMood("dance_song", "Night kiirtan", 300)).toBe("night")
    expect(recordingMood("baba_audio", "Talk", 2 * 3600)).toBe("long")
    expect(recordingMood("dance_song", "Plain title", 300)).toBe("festival")
    expect(recordingMood("kiirtan", "Plain title", 300)).toBeUndefined()
    expect(recordingMood("kiirtan", undefined, null)).toBeUndefined()
  })

  it("every kind has a pool of at least six photos, so ids do spread", () => {
    for (const kind of RECORDING_KINDS) {
      const pool = new Set(IDS.map((id) => photoOf(id, kind)?.id))
      expect(pool.size).toBeGreaterThanOrEqual(6)
    }
  })
})

describe("the seed: one photo for a recording on every phone", () => {
  it("is the server id once the recording is up, else the phone's own id", () => {
    expect(recordingSeed({ id: "k-local-1", serverId: "9f3c" })).toBe("9f3c")
    expect(recordingSeed({ id: "k-local-1" })).toBe("k-local-1")
    expect(recordingSeed({ id: "k-local-1", serverId: "" })).toBe("k-local-1")
  })
})

describe("every place that shows a recording asks the system for its photo", () => {
  const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8")
  it("row, recording page, Kiirtan tab cards, player, mini player and share card all go through KiirtanCover with a seed", () => {
    for (const file of ["components/kirtan/KirtanParts.tsx", "components/kirtan/RecordingHero.tsx", "app/kiirtan.tsx"]) expect(read(file)).toContain("photoSeed={recordingSeed(")
    expect(read("app/player-v2.tsx")).toContain("photoSeed={song.kiirtan?.photoSeed ?? song.kiirtan?.id ?? String(song.id)}")
    expect(read("components/nav-v2/MiniPlayerPill.tsx")).toContain("photoSeed={currentSong.kiirtan?.photoSeed")
    expect(read("components/share/SharePosterCard.tsx")).toContain("photoSeed={cardPhotoSeed(subject)}")
    expect(read("components/kirtan/KirtanMenus.tsx")).toContain("id: cardFor.serverId ?? cardFor.id")
    expect(read("lib/kirtan/track.ts")).toContain("photoSeed: recordingSeed(k)")
  })
  it("the cover and the share sheet pick the mood the same way, with the kind", () => {
    expect(read("components/kirtan/KiirtanCover.tsx")).toContain("recordingMood(kind, title, durationSec)")
    expect(read("app/player-v2.tsx")).toContain("recordingMood(recKind, song.title, song.durationSeconds || null)")
  })
  it("the upload form asks for no picture", () => {
    expect(read("app/add-kirtan.tsx")).not.toMatch(/ImagePicker|pickImage|launchImageLibrary/)
  })
})
