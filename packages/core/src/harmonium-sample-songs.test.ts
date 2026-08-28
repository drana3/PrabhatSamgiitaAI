import { describe, expect, it } from "vitest"

import {
  BANDHU_HE_NIYE_CALO_SONG,
  bookletHarmoniumSong,
  hasPublishedLearnerSargam,
  sampleSongLineEvents,
  sampleSongPlayEvents,
  sampleSongTiming,
  notationToHarmoniumSong,
} from "./harmonium-sample-songs"

describe("harmonium sample songs", () => {
  it("maps Bandhu He Niye Calo onto chromatic keys from Sa", () => {
    const events = sampleSongPlayEvents("C")
    expect(events.length).toBeGreaterThan(20)
    expect(events[0]?.western).toBe("G4")
    expect(events.some((event) => event.western === "C4")).toBe(true)
    expect(BANDHU_HE_NIYE_CALO_SONG.lines[0]?.sargam).toContain("Pa á á ma")
    expect(BANDHU_HE_NIYE_CALO_SONG.lines[1]?.sargam).toContain("Sa Re Re á")
    const firstLine = sampleSongLineEvents("C")[0]!.events
    expect(firstLine.map((event) => event.western).join(" ")).toContain("G4")
  })

  it("leaves a singer-length rest between lines", () => {
    const lines = sampleSongLineEvents("C", BANDHU_HE_NIYE_CALO_SONG, "medium")
    const rest = lines[1]!.startSec - lines[0]!.endSec
    expect(rest).toBeGreaterThanOrEqual(0.85)
    expect(rest).toBeLessThan(2.2)
  })

  it("lets each kaharva line last a full sung cycle", () => {
    const lines = sampleSongLineEvents("C", BANDHU_HE_NIYE_CALO_SONG, 80)
    expect(lines[0]!.endSec).toBeGreaterThan(11)
    const last = sampleSongPlayEvents("C", BANDHU_HE_NIYE_CALO_SONG, 80).at(-1)
    expect((last?.startSec ?? 0) + (last?.durationSec ?? 0)).toBeGreaterThan(80)
  })

  it("plays slower and faster from the tempo tuner", () => {
    const slow = sampleSongPlayEvents("C", BANDHU_HE_NIYE_CALO_SONG, "slow")
    const fast = sampleSongPlayEvents("C", BANDHU_HE_NIYE_CALO_SONG, "fast")
    const lastSlow = slow[slow.length - 1]!
    const lastFast = fast[fast.length - 1]!
    expect(lastSlow.startSec).toBeGreaterThan(lastFast.startSec)
    expect(sampleSongTiming("slow").bpm).toBeLessThan(sampleSongTiming("medium").bpm)
    expect(sampleSongTiming("fast").bpm).toBeGreaterThan(sampleSongTiming("medium").bpm)
    expect(sampleSongTiming("slow").bpm).toBe(90)
    expect(sampleSongTiming("fast").bpm).toBe(176)
  })

  it("turns stored notation into keyboard play events", () => {
    const song = notationToHarmoniumSong(
      [
        {
          line_number: 1,
          lyrics: "E gán ámár",
          measures: [
            {
              beats: [
                { beat: 1, notes: [{ sargam: "S", western: "C4", duration: 1 }] },
                { beat: 2, notes: [{ sargam: "R", western: "D4", duration: 1 }] },
              ],
            },
          ],
        },
      ],
      { id: "ps-2", title: "E gan amar" },
    )
    expect(song?.title).toBe("E gan amar")
    expect(song?.lines).toHaveLength(1)
    const events = sampleSongPlayEvents("C", song!, 100)
    expect(events.map((event) => event.western)).toEqual(["C4", "D4"])
    const inD = sampleSongPlayEvents("D", song!, 100)
    expect(inD.map((event) => event.western)).toEqual(["D4", "E4"])
  })

  it("plays OCR sargam that has no western pitches yet", () => {
    const song = notationToHarmoniumSong(
      [
        {
          line_number: 1,
          lyrics: "E gan amar",
          measures: [
            {
              beats: [
                { beat: 1, notes: [{ sargam: "S", duration: 1 }] },
                { beat: 2, notes: [{ sargam: "R", duration: 1 }] },
                { beat: 3, notes: [{ sargam: "-", duration: 1 }] },
              ],
            },
          ],
        },
      ],
      { id: "ps-2", title: "E gan amar" },
    )
    expect(sampleSongPlayEvents("C", song!, 100).map((event) => event.western)).toEqual(["C4", "D4"])
    expect(song?.lines[0]?.sargam).toBe("Sa Re")
  })

  it("shows booklet Sa Re Ga ma with á holds instead of compact S R G", () => {
    const song = notationToHarmoniumSong(
      [
        {
          line_number: 1,
          lyrics: "Bandhu",
          measures: [
            {
              beats: [
                { beat: 1, notes: [{ sargam: "S", duration: 1 }] },
                { beat: 2, notes: [{ sargam: "S", duration: 1 }] },
                { beat: 3, notes: [{ sargam: "S", duration: 1 }] },
                { beat: 4, notes: [{ sargam: "S", duration: 1 }] },
                { beat: 5, notes: [{ sargam: "R", duration: 1 }] },
                { beat: 6, notes: [{ sargam: "G", duration: 1 }] },
                { beat: 7, notes: [{ sargam: "m", duration: 1 }] },
                { beat: 8, notes: [{ sargam: "P", duration: 1 }] },
              ],
            },
          ],
        },
      ],
      { id: "ps-test", title: "Test" },
    )
    expect(song?.lines[0]?.sargam).toBe("Sa á á á | Re Ga ma Pa")
  })

  it("plays booklet copies for songs 1 and 2", () => {
    expect(bookletHarmoniumSong(1)).toBe(BANDHU_HE_NIYE_CALO_SONG)
    expect(bookletHarmoniumSong(2)?.id).toBe("e-gan-amar-alor-jharnadhara")
    expect(bookletHarmoniumSong(2)?.lines[0]?.lyric).toMatch(/E gan amar alor jharna/i)
    expect(bookletHarmoniumSong(2)?.lines[1]?.lyric).toMatch(/dhara/i)
    expect(bookletHarmoniumSong(2)?.lines[1]?.sargam).toBe("Ni á Sa á | á á á á")
    expect(bookletHarmoniumSong(2)?.lines[2]?.lyric).toMatch(/Upala pathe/i)
    expect(bookletHarmoniumSong(2)?.lines[2]?.sargam).toBe("Pa Dha Ga ma | Ga á á á")
    expect(bookletHarmoniumSong(2)?.lines[0]?.sargam).toContain("Sa Re Ga á")
    expect(sampleSongPlayEvents("C", bookletHarmoniumSong(2)!).length).toBeGreaterThan(20)
    expect(bookletHarmoniumSong(200)).toBeNull()
    expect(bookletHarmoniumSong(5)).toBeNull()
    expect(bookletHarmoniumSong(38)).toBeNull()
    expect(bookletHarmoniumSong(4961)).toBeNull()
    expect(hasPublishedLearnerSargam(5)).toBe(false)
    expect(hasPublishedLearnerSargam(5, "admin_submitted")).toBe(true)
    expect(hasPublishedLearnerSargam(1, "practice_draft")).toBe(true)
    expect(hasPublishedLearnerSargam(1, "practice_draft", false)).toBe(false)
    expect(hasPublishedLearnerSargam(5, "admin_submitted", false)).toBe(false)
  })

  it("plays a hand copy of song 27 from RS_0026-0050", () => {
    const song = bookletHarmoniumSong(27)!
    expect(song.id).toBe("dao-sara-ogo-prabhu")
    expect(song.lines[0]?.lyric).toMatch(/Dao sara ogo Prabhu chande gane/i)
    expect(song.lines[0]?.sargam).toBe("Ga Pa Pa Pa | Pa Pa Pa Pa | Pa Dha Pa ma | Ga á á á")
    expect(song.lines[1]?.lyric).toMatch(/nrtye tale/i)
    expect(song.lines[2]?.lyric).toMatch(/priyatama/i)
    expect(song.lines[4]?.lyric).toMatch(/Eso nrtye tale/i)
    expect(song.lines[4]?.sargam).toContain("|")
    const firstMatras = song.lines[0]!.playBeats?.reduce((sum, beat) => sum + beat.beats, 0) ?? 0
    expect(firstMatras).toBe(16)
    expect(sampleSongPlayEvents("C", song).length).toBeGreaterThan(20)
  })

  it("lets song 2 kaharva lines last a full sung cycle like song 1", () => {
    const song = bookletHarmoniumSong(2)!
    expect(song.lines[0]?.sargam).toBe("Sa Re Ga á | Ga Dha Pa á | Re á Ga á | Sa á Re á")
    expect(song.lines[1]?.lyric).toMatch(/dhara/i)
    expect(song.lines[2]?.lyric).toMatch(/Upala/i)
    const firstMatras = song.lines[0]!.playBeats?.reduce((sum, beat) => sum + beat.beats, 0) ?? 0
    expect(firstMatras).toBe(16)
    expect(song.lines[0]?.sargam).toContain("|")
    expect(song.lines[0]?.sargam).toContain("á")
    const lines = sampleSongLineEvents("C", song, 80)
    expect(lines[0]!.endSec).toBeGreaterThan(11)
  })
})
