import { extractSongSearchIntent, songIntentPath } from "@/lib/search-intent"

describe("intelligent search intent", () => {
  it.each([
    ["223", "/songs/223#ask"],
    ["Song 223", "/songs/223#ask"],
    ["explain about prabhat sagiat 223", "/songs/223#ask"],
    ["lyrics of Prabhat Samgiita 111", "/songs/111#lyrics"],
    ["harmonium notation for song 2256", "/songs/2256#notation"],
    ["listen to PS 9", "/songs/9#listen"],
  ])("routes %s to its authoritative song context", (query, expected) => {
    const intent = extractSongSearchIntent(query)
    expect(intent).not.toBeNull()
    expect(songIntentPath(intent!)).toBe(expected)
  })

  it.each([
    "songs composed in 1983",
    "rain songs for meditation",
    "compare songs 1 and 2",
    "song 0",
    "song 5019",
  ])("does not invent a direct song route for %s", (query) => {
    expect(extractSongSearchIntent(query)).toBeNull()
  })
})
