import { describe, expect, it } from "vitest"

import { LEARN_SUGGESTED_NUMBERS, buildLearnDemoSeed, learnSongTitle } from "@/lib/fixtures/learn"
import {
  HUB_LINKS,
  HUB_SECTION_ORDER,
  CHOOSE_LIMIT,
  buildChoices,
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
  it("shows three bars, Words, Quiz, Chords, with the done ones marked", () => {
    const bars = songStepBars({ ...EMPTY_PATH, listen: true, chords: true })
    expect(bars.map((b) => b.label)).toEqual(["Words", "Quiz", "Chords"])
    expect(bars.map((b) => b.done)).toEqual([false, false, true])
    expect(bars.map((b) => b.optional)).toEqual([false, false, true])
  })

  it("treats a missing path as nothing done", () => {
    expect(songStepBars(undefined).every((b) => !b.done)).toBe(true)
    expect(stepLine(undefined)).toBe("Not started")
  })

  it("next step is Words, then Quiz; Chords never come next", () => {
    expect(nextStep(EMPTY_PATH)).toBe(1)
    expect(nextStep({ ...EMPTY_PATH, words: true })).toBe(2)
    expect(nextStep({ ...EMPTY_PATH, meaning: true })).toBe(1)
    expect(nextStep({ ...EMPTY_PATH, chords: true, listen: true })).toBe(1)
    expect(nextStep({ ...EMPTY_PATH, words: true, chords: true })).toBe(2)
    expect(nextStep({ ...DONE, chords: false })).toBeNull()
  })

  it("describes the step in words", () => {
    expect(stepLine({ ...EMPTY_PATH, words: true })).toBe("Step 2 of 2 · Quiz")
    expect(stepLine({ ...EMPTY_PATH, meaning: true })).toBe("Step 1 of 2 · Words")
    expect(stepLine({ ...EMPTY_PATH, listen: true, chords: true })).toBe("Not started")
    expect(stepLine(DONE)).toBe("Learned")
    expect(stepLine({ ...DONE, chords: false })).toBe("Learned")
  })

  it("Go opens the word cards for Words, the song quiz for Quiz, the song page otherwise", () => {
    expect(nextStepHref("ps-3", 3, EMPTY_PATH)).toBe("/learn/words?song=3")
    expect(nextStepHref("ps-3", 3, { ...EMPTY_PATH, words: true })).toBe("/learn/quiz?song=3")
    expect(nextStepHref("ps-3", 3, DONE)).toBe("/learn/song/ps-3")
  })

  it("a song without checked words opens its own page, which says 'Words coming soon'", () => {
    expect(nextStepHref("ps-9", 9, EMPTY_PATH, false)).toBe("/learn/song/ps-9")
    expect(nextStepHref("ps-9", 9, { ...EMPTY_PATH, words: true }, false)).toBe("/learn/song/ps-9")
  })
})

describe("continue card", () => {
  const seed = buildLearnDemoSeed(NOW)

  it("continues the song started last when two are equally far (demo: PS 3, its Quiz is next)", () => {
    const model = buildContinue(seed.songs, seed.paths, LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(model.kind).toBe("continue")
    if (model.kind !== "continue") return
    expect(model.song.number).toBe(3)
    expect(model.step).toBe(2)
    expect(model.href).toBe("/learn/quiz?song=3")
  })

  it("sends a song without checked words to its own page", () => {
    const model = buildContinue(seed.songs, seed.paths, LEARN_SUGGESTED_NUMBERS, learnSongTitle, () => false)
    expect(model.kind === "continue" && model.href).toBe("/learn/song/ps-3")
  })

  it("on a tie, the song started last wins", () => {
    const songs = [song(1, NOW - 5000), song(3, NOW)]
    const paths = { "ps-1": { ...EMPTY_PATH, words: true }, "ps-3": { ...EMPTY_PATH, words: true } }
    expect(pickContinue(songs, paths)?.number).toBe(3)
  })

  it("a song with only Listen or Chords done is not in progress (they do not count)", () => {
    const songs = [song(1), song(3)]
    expect(pickContinue(songs, { "ps-1": { ...EMPTY_PATH, listen: true }, "ps-3": { ...EMPTY_PATH, chords: true } })).toBeNull()
  })

  it("ignores learned songs and songs with no step done", () => {
    const songs = [song(2), song(4)]
    expect(pickContinue(songs, { "ps-2": DONE, "ps-4": EMPTY_PATH })).toBeNull()
    // learned without chords is learned all the same
    expect(pickContinue([song(2)], { "ps-2": { ...EMPTY_PATH, words: true, meaning: true } })).toBeNull()
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

describe("My songs shelf", () => {
  const seed = buildLearnDemoSeed(NOW)
  const shelf = buildShelf(seed.songs, seed.paths)

  it("lists Learning first, then Not started, then Learned", () => {
    expect(shelf.map((e) => `${e.state}:${e.number}`)).toEqual([
      "learning:3",
      "learning:1",
      "learned:6",
      "learned:4",
      "learned:2",
    ])
  })

  it("is empty for a new learner: suggestions are not in My songs", () => {
    expect(buildShelf([], {})).toEqual([])
  })

  it("puts a just-added song (nothing done) after the songs in progress, newest first", () => {
    const paths = { "ps-7": EMPTY_PATH, "ps-5": EMPTY_PATH, "ps-1": { ...EMPTY_PATH, meaning: true } }
    const list = buildShelf([song(7, NOW), song(5, NOW - 1000), song(1, NOW - 2000)], paths)
    expect(list.map((e) => `${e.state}:${e.number}`)).toEqual(["learning:1", "notStarted:7", "notStarted:5"])
    expect(list.every((e) => e.listed)).toBe(true)
  })
})

describe("I want to learn this", () => {
  it("offers the first suggested songs, as many as the column holds", () => {
    const choices = buildChoices([], LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(choices).toHaveLength(CHOOSE_LIMIT)
    expect(choices.map((c) => c.number)).toEqual(LEARN_SUGGESTED_NUMBERS.slice(0, CHOOSE_LIMIT))
    expect(choices.every((c) => !c.listed)).toBe(true)
  })

  it("skips songs already on the list, so a song moves out of the column when it is added", () => {
    const choices = buildChoices([song(1), song(3)], LEARN_SUGGESTED_NUMBERS, learnSongTitle)
    expect(choices.map((c) => c.number)).toEqual([2, 4, 5, 6])
  })

  it("is empty when everything suggested is on the list", () => {
    expect(buildChoices([song(1)], [1], learnSongTitle)).toEqual([])
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
  it("the chain runs continue, my songs, choose, practice; the old blocks follow", () => {
    expect([...HUB_SECTION_ORDER]).toEqual(["continue", "songs", "choose", "practice", "play", "ragas", "harmonium", "stories"])
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
    expect(HUB_LINKS.pickSong).toBe("/learn/add")
    expect(HUB_LINKS.scope).toBe("/learn/scope")
  })
})
