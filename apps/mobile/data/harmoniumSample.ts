import type { HarmoniumLineWord } from "@/lib/harmonium-v2/lines"

/**
 * SAMPLE CONTENT from the design mockup (PS 1, first line). Chords and swaras are
 * placeholders until a harmonium teacher reviews real data (open question 17,
 * API-07 and API-14).
 */
export const SAMPLE_HARMONIUM_SONG = {
  number: 1,
  title: "Bandhu He Niye Calo",
  /** Sa on the harmonium for the sample, as in the mockup */
  chords: ["C", "Am", "F", "G"],
  lines: [
    [
      { word: "Bandhu", chord: "C", swara: "Sa" },
      { word: "he", swara: "Re" },
      { word: "niye", chord: "Am", swara: "Ga" },
      { word: "calo", chord: "F", swara: "Ma" },
    ],
    [
      { word: "Álor", chord: "G", swara: "Pa" },
      { word: "jharańá", swara: "Dha" },
      { word: "dháráy", chord: "C", swara: "Ni" },
      { word: "dhuiye", swara: "Sa" },
    ],
  ] as HarmoniumLineWord[][],
}
