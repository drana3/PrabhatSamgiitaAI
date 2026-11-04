/**
 * TODO(api): samples of the design prototype for the harmonium screens. The catalog API has no chord charts,
 * so "In the song" of the chord explainer and "Practise on" of the keyboard use the two sample songs
 * of the prototype (PS 1 and PS 3). Replace with the chart of the song the learner is on.
 */
export const EXPLAINER_SONG_LINES: string[][] = [
  ["Bandhu", "he", "niye", "calo"],
  ["Álor", "jharańá", "dháráy", "dhuiye", "dáo"],
]

export const PRACTISE_SONGS = [
  { number: 1, title: "Bandhu He Niye Calo" },
  { number: 3, title: "Ándhára Sheśe Álora Deshe" },
] as const
