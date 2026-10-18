export type SongSection = "ask" | "lyrics" | "meaning" | "listen" | "watch" | "notation"

export function songPagePath(number: number, section: SongSection = "ask") {
  return `/songs/${number}#${section}`
}
