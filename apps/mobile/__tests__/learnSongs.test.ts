import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
    },
  }
})

import {
  PS_SONG_COUNT,
  isListed,
  isSongNumber,
  learnSongId,
  listedNumbers,
  planAddSong,
  planRemoveSong,
  planRestoreSong,
  songNumberOfId,
} from "@/lib/learn/learnSongs"
import { EMPTY_PATH, type LearningSong, type PathState } from "@/lib/learn/progress"
import { buildShelf } from "@/lib/learn/hub"
import { learnSongTitle } from "@/lib/fixtures/learn"
import { useLearnStore } from "@/stores/learnStore"

const NOW = new Date(2026, 10, 5, 9, 0, 0).getTime()

function song(number: number, startedAt = NOW): LearningSong {
  return { songId: `ps-${number}`, number, title: `Song ${number}`, startedAt }
}

describe("song numbers and ids", () => {
  it("accepts 1 to 5018 and nothing else", () => {
    expect(isSongNumber(1)).toBe(true)
    expect(isSongNumber(PS_SONG_COUNT)).toBe(true)
    expect(isSongNumber(0)).toBe(false)
    expect(isSongNumber(PS_SONG_COUNT + 1)).toBe(false)
    expect(isSongNumber(2.5)).toBe(false)
    expect(isSongNumber(Number.NaN)).toBe(false)
    expect(isSongNumber("7")).toBe(false)
  })

  it("ps-7 and 7 are the same song", () => {
    expect(learnSongId(7)).toBe("ps-7")
    expect(songNumberOfId("ps-7")).toBe(7)
    expect(songNumberOfId("PS-12")).toBe(12)
    expect(songNumberOfId("ps-0")).toBeNull()
    expect(songNumberOfId("kiirtan-3")).toBeNull()
  })
})

describe("adding a song", () => {
  it("puts a new song at the end of the list with an empty path", () => {
    const plan = planAddSong([song(1)], { "ps-1": EMPTY_PATH }, { number: 4321, title: "Some Song" }, NOW + 5)
    expect(plan.status).toBe("added")
    expect(plan.songs.map((s) => s.number)).toEqual([1, 4321])
    expect(plan.songs[1]).toEqual({ songId: "ps-4321", number: 4321, title: "Some Song", startedAt: NOW + 5 })
    expect(plan.paths["ps-4321"]).toEqual(EMPTY_PATH)
  })

  it("accepts any of the 5,018 numbers, not only the suggested ones", () => {
    for (const number of [1, 2, 999, 2500, PS_SONG_COUNT]) {
      expect(planAddSong([], {}, { number, title: "x" }, NOW).status).toBe("added")
    }
  })

  it("leaves a song that is already there alone: same start time, same progress", () => {
    const done: PathState = { ...EMPTY_PATH, listen: true }
    const before = [song(7, NOW - 1000)]
    const plan = planAddSong(before, { "ps-7": done }, { number: 7, title: "New title" }, NOW)
    expect(plan.status).toBe("already")
    expect(plan.songs).toEqual(before)
    expect(plan.paths["ps-7"]).toEqual(done)
  })

  it("does not add a number that is not a song", () => {
    expect(planAddSong([], {}, { number: 0, title: "x" }, NOW).status).toBe("invalid")
    expect(planAddSong([], {}, { number: 9999, title: "x" }, NOW).songs).toEqual([])
  })

  it("names a song without a title by its number, never by an invented title", () => {
    expect(planAddSong([], {}, { number: 88, title: "  " }, NOW).songs[0]!.title).toBe("Prabhat Samgiita 88")
  })

  it("does not change the lists it was given", () => {
    const songs = [song(1)]
    const paths = { "ps-1": EMPTY_PATH }
    planAddSong(songs, paths, { number: 2, title: "b" }, NOW)
    expect(songs).toHaveLength(1)
    expect(Object.keys(paths)).toEqual(["ps-1"])
  })
})

describe("removing a song and Undo", () => {
  it("takes the song off and hands it back for Undo", () => {
    const plan = planRemoveSong([song(1), song(2)], 2)
    expect(plan.status).toBe("removed")
    expect(plan.songs.map((s) => s.number)).toEqual([1])
    expect(plan.removed).toEqual(song(2))
  })

  it("says so when the song is not on the list", () => {
    const plan = planRemoveSong([song(1)], 9)
    expect(plan.status).toBe("absent")
    expect(plan.removed).toBeNull()
    expect(plan.songs).toHaveLength(1)
  })

  it("Undo puts it back with its original start time", () => {
    const removed = song(2, NOW - 5000)
    const plan = planRestoreSong([song(1)], { "ps-2": { ...EMPTY_PATH, words: true } }, removed)
    expect(plan.status).toBe("added")
    expect(plan.songs.find((s) => s.number === 2)?.startedAt).toBe(NOW - 5000)
    expect(plan.paths["ps-2"]!.words).toBe(true)
  })

  it("Undo twice does not double the song", () => {
    const first = planRestoreSong([], {}, song(3))
    expect(planRestoreSong(first.songs, first.paths, song(3)).status).toBe("already")
  })
})

describe("list helpers", () => {
  it("knows which numbers are listed", () => {
    const songs = [song(3), song(5)]
    expect([...listedNumbers(songs)].sort()).toEqual([3, 5])
    expect(isListed(songs, 5)).toBe(true)
    expect(isListed(songs, 6)).toBe(false)
  })
})

describe("the hub shows a just-added song first among the songs not started", () => {
  it("newest added first, then older ones, then suggestions", () => {
    const songs = [song(1500, NOW - 3000), song(2200, NOW - 1000), song(3100, NOW - 2000)]
    const paths = { "ps-1500": EMPTY_PATH, "ps-2200": EMPTY_PATH, "ps-3100": EMPTY_PATH }
    const shelf = buildShelf(songs, paths, [1], learnSongTitle)
    expect(shelf.map((e) => e.number)).toEqual([2200, 3100, 1500, 1])
    expect(shelf.slice(0, 3).every((e) => e.listed)).toBe(true)
    expect(shelf[3]!.listed).toBe(false)
  })
})

describe("the Learn store", () => {
  beforeEach(() => {
    useLearnStore.getState().resetAll()
  })

  it("startLearning adds once and says what happened", () => {
    const { startLearning } = useLearnStore.getState()
    expect(startLearning({ songId: "ps-42", number: 42, title: "Forty Two" }, NOW)).toBe("added")
    expect(startLearning({ songId: "ps-42", number: 42, title: "Forty Two" }, NOW + 1)).toBe("already")
    expect(useLearnStore.getState().songs).toHaveLength(1)
    expect(useLearnStore.getState().paths["ps-42"]).toEqual(EMPTY_PATH)
  })

  it("a song added from the picker shows its start state at once: no steps done", () => {
    useLearnStore.getState().startLearning({ songId: "ps-3000", number: 3000, title: "Far Song" }, NOW)
    const { songs, paths } = useLearnStore.getState()
    const shelf = buildShelf(songs, paths, [], learnSongTitle)
    expect(shelf[0]).toMatchObject({ number: 3000, state: "notStarted", listed: true })
    expect(shelf[0]!.path).toEqual(EMPTY_PATH)
  })

  it("stopLearning takes the song off but keeps its progress; adding it again brings the progress back", () => {
    const store = useLearnStore.getState()
    store.startLearning({ songId: "ps-9", number: 9, title: "Nine" }, NOW)
    store.markPart("ps-9", "listen")
    store.stopLearning("ps-9")
    expect(useLearnStore.getState().songs).toHaveLength(0)
    expect(useLearnStore.getState().paths["ps-9"]!.listen).toBe(true)
    store.startLearning({ songId: "ps-9", number: 9, title: "Nine" }, NOW + 10)
    expect(useLearnStore.getState().paths["ps-9"]!.listen).toBe(true)
  })

  it("restoreLearning (Undo) keeps the original start time", () => {
    const store = useLearnStore.getState()
    store.startLearning({ songId: "ps-9", number: 9, title: "Nine" }, NOW)
    store.stopLearning("ps-9")
    store.restoreLearning(song(9, NOW))
    expect(useLearnStore.getState().songs[0]!.startedAt).toBe(NOW)
  })

  it("stopLearning on a song that is not there does nothing", () => {
    useLearnStore.getState().stopLearning("ps-1")
    expect(useLearnStore.getState().songs).toEqual([])
  })
})
