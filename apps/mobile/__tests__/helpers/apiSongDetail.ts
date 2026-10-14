/** Minimal API song payload so songDetailToMockSong gets a stream URL in tests. */
export function apiSongDetail(number: number) {
  const url = `https://example.com/${number}.mp3`
  return {
    number,
    title: `PS ${number}`,
    first_line: `Line ${number}`,
    media: [
      {
        kind: "audio" as const,
        url,
        provider: "direct_audio",
        title: "Recording",
      },
    ],
  }
}
