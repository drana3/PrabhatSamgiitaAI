import { describe, expect, it } from "vitest"

import { LEARN_SUGGESTED_NUMBERS, buildLearnDemoSeed, learnSongTitle } from "@/lib/fixtures/learn"
import {
  HUB_LINKS,
  HUB_SECTION_ORDER,
  buildContinue,
  buildShelf,
  nextStep,
  nextStepHref,
  pickContinue,
  quizSubtitle,
  songStepBars,
  statsLine,
  stepLine,
  wordCardsSubtitle,
} from "@/lib/learn/hub"
import { EMPTY_PATH, type LearningSong, type PathState } from "@/lib/learn/progress"
import { LEARN_ROUTES } from "@/lib/learn/routes"

const NOW = new Date(2026, 10, 3, 9, 0, 0).getTime()
const DONE: PathState = { listen: true, words: true, meaning: true, chords: true }

function song(number: number, startedAt = NOW): LearningSong {
  return { songId: `ps-${number}`, number, title: learnSongTitle(number), startedAt }
}

describe("steps of one song", () => {
  it("shows three bars with the done ones marked", () => {
    const bars = songStepBars({ ...EMPTY_PATH, listen: true, chords: true })
    expect(bars.map((b) => b.label)).toEqual(["Hear", "Words", "Play"])
    expect(bars.map((b) => b.done)).toEqual([true, false, true])
  })

  it("treats a missing path as nothing done", () => {
    expect(songStepBars(undefined).every((b) => !b.done)).toBe(true)
    expect(stepLine(undefined)).toBe("Not started")
  })

  it("next step is the first one not done, in any order", () => {
    expect(nextStep(EMPTY_PATH)).toBe(1)
    expect(nextStep({ ...EMPTY_PATH, listen: true })).toBe(2)
    expect(nextStep({ ...EMPTY_PATH, listen: true, words: true })).toBe(3)
    expect(nextStep({ ...EMPTY_PATH, chords: true })).toBe(1)
    expect(nextStep({ ...EMPTY_PATH, listen: true, chords: true })).toBe(2)
    expect(nextStep(DONE)).toBeNull()
  })

  it("describes the step in words", () => {
    expect(stepLine({ ...EMPTY_PATH, listen: true })).toBe("Step 2 of 3 · Words")
    expect(stepLine({ ...EMPTY_PATH, listen: true, words: true })).toBe("Step 3 of 3 · Play")
    expect(stepLine(DONE)).toBe("All three steps done")
  })

  it("Go opens the song's word cards for the words step, the song path otherwise", () => {
    expect(nextStepHref("ps-3", 3, { ...EMPTY_PATH, listen: true })).toBe("/learn/words?song=3")
    expect(nextStepHref("ps-3", 3, EMPTY_PATH)).toBe("/learn/song/ps-3")
    expect(nextStepHref("ps-3", 3, { ...EMPTY_PATH, listen: true, words: true })).toBe("/learn/song/ps-3")
  })
})

describe("continue card", () => {
  const seed = buildLearnDemoSeed(NOW)

  it("continues the song closest to finished (demo: PS 3 at step 3)", () => {
    const model = buildContinue(seed.songs, seed.paths, LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(model.kind).toBe("continue")
    if (model.kind !== "continue") return
    expect(model.song.number).toBe(3)
    expect(model.step).toBe(3)
    expect(model.href).toBe("/learn/song/ps-3")
  })

  it("on a tie, the song started last wins", () => {
    const songs = [song(1, NOW - 5000), song(3, NOW)]
    const paths = { "ps-1": { ...EMPTY_PATH, listen: true }, "ps-3": { ...EMPTY_PATH, listen: true } }
    expect(pickContinue(songs, paths)?.number).toBe(3)
  })

  it("ignores learned songs and songs with no step done", () => {
    const songs = [song(2), song(4)]
    expect(pickContinue(songs, { "ps-2": DONE, "ps-4": EMPTY_PATH })).toBeNull()
  })

  it("offers the first suggested song when the learner has nothing", () => {
    const model = buildContinue([], {}, LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(model.kind).toBe("start")
    if (model.kind !== "start") return
    expect(model.first).toBe(true)
    expect(model.song.number).toBe(1)
    expect(model.song.title).toBe("Bandhu He Niye Calo")
    expect(model.href).toBe("/learn/song/ps-1")
  })

  it("says 'next' once a song has been learned, and skips songs already on the list", () => {
    const model = buildContinue([song(1), song(2)], { "ps-1": DONE, "ps-2": DONE }, LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(model.kind).toBe("start")
    if (model.kind !== "start") return
    expect(model.first).toBe(false)
    expect(model.song.number).toBe(3)
  })

  it("starts a listed song that has no step done before a suggestion", () => {
    const model = buildContinue([song(5)], { "ps-5": EMPTY_PATH }, LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(model.kind === "start" && model.song.number).toBe(5)
  })

  it("is 'none' only when there is nothing to suggest", () => {
    expect(buildContinue([], {}, [], learnSongTitle).kind).toBe("none")
  })
})

describe("song shelf order", () => {
  const seed = buildLearnDemoSeed(NOW)
  const shelf = buildShelf(seed.songs, seed.paths, LEARN_SUGGESTED_NUMBERS, learnSongTitle)

  it("lists songs in progress first, then not started", () => {
    expect(shelf.map((e) => `${e.state}:${e.number}`)).toEqual([
      "learning:3",
      "learning:1",
      "notStarted:5",
      "notStarted:7",
    ])
  })

  it("leaves learned songs out of the shelf", () => {
    expect(shelf.some((e) => [2, 4, 6].includes(e.number))).toBe(false)
  })

  it("is never empty for a new learner: it falls back to suggestions", () => {
    const empty = buildShelf([], {}, LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(empty).toHaveLength(LEARN_SUGGESTED_NUMBERS.length)
    expect(empty.every((e) => e.state === "notStarted" && !e.listed)).toBe(true)
  })

  it("puts listed not-started songs before suggestions", () => {
    const list = buildShelf([song(7)], { "ps-7": EMPTY_PATH }, [1, 7], learnSongTitle)
    expect(list.map((e) => e.number)).toEqual([7, 1])
    expect(list[0]!.listed).toBe(true)
  })
})

describe("texts", () => {
  it("stats line", () => {
    expect(statsLine(3, 2, 6)).toBe("3 songs learned · 2 learning · 6 words")
    expect(statsLine(1, 0, 1)).toBe("1 song learned · 0 learning · 1 word")
  })

  it("word cards subtitle", () => {
    expect(wordCardsSubtitle(2, true)).toBe("2 due")
    expect(wordCardsSubtitle(0, true)).toBe("All done")
    expect(wordCardsSubtitle(0, false)).toBe("Start with 10 words")
  })

  it("quiz subtitle names the level", () => {
    expect(quizSubtitle(1)).toBe("Level 1 · Know the words")
    expect(quizSubtitle(3)).toBe("Level 3 · Know the story")
  })
})

describe("page structure", () => {
  it("sections run continue, songs, practice, play, explore", () => {
    expect([...HUB_SECTION_ORDER]).toEqual(["continue", "songs", "practice", "play", "explore"])
  })

  it("keeps every destination of the old Practice, My songs and Tools tabs", () => {
    expect(HUB_LINKS.wordCards).toBe(LEARN_ROUTES.words)
    expect(HUB_LINKS.harmonium).toBe(LEARN_ROUTES.harmonium)
    expect(HUB_LINKS.chords).toBe(LEARN_ROUTES.harmoniumChords)
    expect(HUB_LINKS.stories).toBe(LEARN_ROUTES.stories)
    expect(HUB_LINKS.index).toBe(LEARN_ROUTES.ragaTalaIndex)
    // the Certificates / Live quiz entry is hidden for now (Dada 2026-11-05)
    expect("certificates" in HUB_LINKS).toBe(false)
    expect(HUB_LINKS.allSongs).toBe("/learn/songs")
  })
})
