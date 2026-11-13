import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { listPlayableAudio } from "@/lib/mediaEmbed"
import { versionsFromSong } from "@/lib/playerV2/versions"
import { lockScreenArtist } from "@/lib/playback/catalogTrack"
import { buildVersions, versionLine } from "@/lib/songPage/versions"
import { songDetailToMockSong } from "@/lib/songMap"

import { apiSongDetail } from "./helpers/apiSongDetail"

const detail = (number: number, title: string, media: unknown[]) =>
  ({ ...apiSongDetail(number), title, media }) as unknown as Parameters<typeof songDetailToMockSong>[0]

const API = "https://api.example.org"
const colleague = (extra: Record<string, unknown> = {}) => ({
  kind: "audio",
  provider: "ps_colleagues",
  title: "BANDHU HE NIYE CALO",
  url: `${API}/api/v1/ps-audio/1%20Bandhu%20He%20Niye%20Calo.m4a`,
  verification_status: "verified",
  performer: "Gunavati",
  is_latest: true,
  ...extra,
})
const official = (url: string, extra: Record<string, unknown> = {}) => ({
  kind: "audio",
  provider: "official",
  title: "BANDHU HE NIYE CALO",
  url,
  verification_status: "verified",
  ...extra,
})

describe("the colleagues' recordings on the song page and in the player", () => {
  const media = [
    official("https://prabhatasamgiita.net/1-999/1%20BANDHU%20HE%20NIYE%20CALO.mp3"),
    official("https://prabhatasamgiita.net/1-999/1%20BANDHU%20HE%20NIYE%20CALO%20%28old%20version%29.mp3", { is_older: true }),
    colleague(),
  ]

  it("lists the API's current recording first and carries the singer", () => {
    const list = listPlayableAudio(media)
    expect(list[0]).toMatchObject({ provider: "ps_colleagues", performer: "Gunavati", isLatest: true })
    expect(list).toHaveLength(3)
    expect(list.slice(1).every((r) => r.performer === undefined)).toBe(true)
  })

  it("makes the colleague's file the song's default audio, keeping the archive links after it", () => {
    const song = songDetailToMockSong(detail(1, "BANDHU HE NIYE CALO", media))
    expect(song.audioUrl).toBe(colleague().url)
    expect(song.audioRecordings?.map((r) => r.provider)).toEqual(["ps_colleagues", "official", "official"])
    expect(song.audioRecordings?.[0].title).toBe("BANDHU HE NIYE CALO")
  })

  it("names Gunavati in the version picker, the player's versions and the lock screen", () => {
    const song = songDetailToMockSong(detail(1, "BANDHU HE NIYE CALO", media))
    const [first] = buildVersions(song.audioRecordings, song.performer, song.audioUrl, 0)
    expect(first.performer).toBe("Gunavati")
    expect(versionLine(first)).toBe("Voice · Gunavati")
    expect(first.tag).toBe("Best")
    expect(versionsFromSong(song)[0].performer).toBe("Gunavati")
    expect(lockScreenArtist(song, colleague().url)).toBe("PS 1 · Voice · Gunavati")
  })

  it("leaves a song without colleague recordings as it was", () => {
    const song = songDetailToMockSong(detail(3, "T", [official("https://prabhatasamgiita.net/1-999/3.mp3")]))
    expect(song.audioRecordings?.[0].performer).toBeUndefined()
  })
})

describe("the 69 recordings", () => {
  const audio = JSON.parse(readFileSync(path.resolve(__dirname, "../../../data/curated/ps_colleagues/audio.json"), "utf8")) as {
    songs: Record<string, { app_title: string; recordings: Array<{ file_name: string; r2_key: string; is_current: boolean }> }>
  }
  const songs = JSON.parse(readFileSync(path.resolve(__dirname, "../../../data/generated/songs.json"), "utf8")) as Array<{ number: number; title: string }>

  it("each carries the official English title of its song, never a Russian one", () => {
    const titles = new Map(songs.map((s) => [s.number, s.title]))
    expect(Object.keys(audio.songs)).toHaveLength(69)
    for (const [n, entry] of Object.entries(audio.songs)) {
      expect(entry.app_title, `PS ${n}`).toBe(titles.get(Number(n)))
      expect(entry.app_title, `PS ${n}`).not.toMatch(/[Ѐ-ӿ]/)
      expect(entry.recordings[0].r2_key).toBe(`audio-extractor/ps-audio/${entry.recordings[0].file_name}`)
      expect(entry.recordings[0].is_current).toBe(true)
    }
  })
})
