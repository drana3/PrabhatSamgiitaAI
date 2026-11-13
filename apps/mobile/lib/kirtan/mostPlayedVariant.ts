/**
 * Which design of the "Most played" card the Kiirtan page draws (Dada, 13 Nov 2026: three designs to choose from; the others stay in
 * the code until one is picked, then they go). ONE constant picks it; nothing else changes.
 *  - "A": a ranking: three big numerals and the names, no pictures (quiet, typographic).
 *  - "B": one poster: place 1 as a photo with its name large, places 2 and 3 as chips on it.
 *  - "C": a row of three photo covers with the numerals over them, names underneath (a Top 3 shelf).
 */
export type MostPlayedVariant = "A" | "B" | "C"

export const MOST_PLAYED_VARIANT: MostPlayedVariant = "A"
