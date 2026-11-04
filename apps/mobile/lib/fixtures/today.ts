/**
 * TODO(api): sample days and songs of the design prototype (Main.dc.html `DAYS` and `_songs()`),
 * shown only when the Today route is opened with ?day=date|fest|season for design review.
 * The real screen takes its songs from GET /recommendations/today.
 */
export type TodayFixtureSong = { number: number; title: string; firstLine: string; seconds: number; composed?: string }

export const TODAY_FIXTURE_SONGS: Record<number, TodayFixtureSong> = {
  0: { number: 1, title: "Bandhu He Niye Calo", firstLine: "Bandhu he niye calo", seconds: 238 },
  1: { number: 2, title: "E Gán Ámár, Álor Jharańá Dhárá", firstLine: "E gán ámár álor jharańá dhárá", seconds: 252 },
  2: { number: 3, title: "Ándhára Sheśe Álora Deshe", firstLine: "Ándhára sheśe álora deshe", seconds: 271 },
  3: { number: 4, title: "Sakal Maner Viińá Ek Sure Báje Áj", firstLine: "Sakal maner viińá ek sure báje áj", seconds: 305 },
  4: { number: 5, title: "Elo, Anek Juger Sei Ajáná Pathik", firstLine: "Elo, anek juger sei ajáná pathik", seconds: 226 },
  5: { number: 6, title: "Bandhu Ámár", firstLine: "Bandhu ámár", seconds: 300 },
  6: { number: 7, title: "Niiravatá Májhe Ke Go Tumi Ele", firstLine: "Niiravatá májhe ke go tumi ele", seconds: 284 },
}

export const TODAY_FIXTURE_DAYS = {
  date: { songs: [2, 0, 4], composed: ["1983", "1982", "1985"], also: null as number | null },
  fest: { songs: [3, 1, 5], composed: [] as string[], also: 4 as number | null, festival: "Díipávalii", date: new Date(2026, 10, 8) },
  season: { songs: [6, 4, 1], composed: [] as string[], also: 0 as number | null, season: "Hemanta", date: new Date(2026, 10, 15) },
} as const

/** Recently played in the prototype: PS 6, PS 1, PS 4. */
export const TODAY_FIXTURE_RECENT = [5, 0, 3]
