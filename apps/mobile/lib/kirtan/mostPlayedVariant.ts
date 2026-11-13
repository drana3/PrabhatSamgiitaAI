/**
 * Which design of the "Most played" card the Kiirtan page draws (Dada, 13 Nov 2026: three designs to choose from; the others stay in
 * the code until one is picked, then they go). ONE constant picks it; nothing else changes.
 *  - "A": a ranking: three big numerals and the names, no pictures (quiet, typographic).
 *  - "B": one poster: place 1 as a photo with its name large, places 2 and 3 as chips on it.
 *  - "C": a row of three photo covers with the numerals over them, names underneath (a Top 3 shelf).
 * Chosen by Dada, 13 Nov 2026: "E" (three square covers, round numeral tabs). The others stay in the code for now.
 * Dada, 13 Nov 2026, liked the big numerals of A but not its thin rules and framed card, so three more with no line anywhere:
 *  - "D": three soft plates, numeral left and a small cover, set apart by empty space and tone.
 *  - "E": three square covers side by side, each numeral on a page-coloured tab half over the cover's corner (Apple Music chart).
 *  - "F": place 1 as a large peach hero plate with a big cover and numeral, places 2 and 3 as smaller plates under it.
 */
export type MostPlayedVariant = "A" | "B" | "C" | "D" | "E" | "F"

export const MOST_PLAYED_VARIANT: MostPlayedVariant = "E"
