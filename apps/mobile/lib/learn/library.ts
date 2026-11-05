import type { LibraryRowData } from "@/components/learn-v2/LearnBlocks"
import type { LearnWord } from "@/lib/learn/words"
import { demoLibraryEntry } from "@/lib/fixtures/learn"
import { pathDoneCount, pathDots, songsWithDueWords, type LearningSong, type PathState } from "@/lib/learn/progress"
import { nextStepNote } from "@/lib/learn/songPath"
import { describeNextDue, nextDueAt, type WordCard } from "@/lib/learn/srs"
import { wordsForSong } from "@/lib/learn/words"

export type LibraryFilter = "all" | "due" | "learning" | "learned"

export const LIBRARY_FILTERS: ReadonlyArray<{ key: LibraryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "due", label: "Due" },
  { key: "learning", label: "Learning" },
  { key: "learned", label: "Learned" },
]

/**
 * One row per song on the learner's list (the old "My songs" tab, now the "See all" screen).
 * `mockup` fills the memory strength and the "next review" line from the prototype's
 * sample library, because song-level review does not exist in the logic yet.
 */
export function buildLibraryRows(input: {
  songs: readonly LearningSong[]
  paths: Readonly<Record<string, PathState>>
  cards: Readonly<Record<string, WordCard>>
  words: readonly LearnWord[]
  now: number
  mockup: boolean
}): LibraryRowData[] {
  const { songs, paths, cards, words, now, mockup } = input
  const dueBySong = songsWithDueWords(words, cards, now)
  return songs.map((song): LibraryRowData => {
    const path = paths[song.songId]
    const learned = pathDoneCount(path) === 3
    const demo = demoLibraryEntry(song.number)
    const due = learned && Boolean(demo?.due || (!mockup && dueBySong.has(song.number)))
    let note: string
    if (!learned) note = nextStepNote(path)
    else if (mockup && demo?.next) note = demo.next
    else if (due) note = "Review due today"
    else {
      const nextWord = nextDueAt(
        Object.fromEntries(wordsForSong(words, song.number).flatMap((w) => (cards[w.id] ? [[w.id, cards[w.id]!]] : []))),
        now,
      )
      note = nextWord ? describeNextDue(nextWord, now).replace("Next card", "Next review") : "All three steps done"
    }
    return {
      number: song.number,
      title: song.title,
      learned,
      due,
      strength: (mockup ? demo?.strength : undefined) ?? 3,
      steps: pathDots(path),
      note,
    }
  })
}

export function filterLibraryRows(rows: readonly LibraryRowData[], filter: LibraryFilter): LibraryRowData[] {
  return rows.filter((row) => {
    if (filter === "due") return row.due
    if (filter === "learning") return !row.learned
    if (filter === "learned") return row.learned
    return true
  })
}

/** Empty-state text of the songs list, for the chosen filter. */
export function libraryEmptyText(totalRows: number, filter: LibraryFilter = "due"): string {
  if (totalRows === 0) {
    return "No songs yet. Open a song and tap Learn this song. Three steps: hear it, know what it means, play it."
  }
  if (filter === "learning") return "Nothing in progress. Pick a song on the Learn page and begin."
  if (filter === "learned") return "No song is fully learned yet. Finish its three steps and it lands here."
  return "You have nothing due. Words and songs come back here when it is time."
}

export function libraryCounts(rows: readonly LibraryRowData[]): { learned: number; learning: number; total: number } {
  const learned = rows.filter((row) => row.learned).length
  return { learned, learning: rows.length - learned, total: rows.length }
}
