/**
 * Songs whose language the text alone cannot give. The catalogue has no language field per song (every song is
 * "Roman"), and nearly all of the 5018 songs are Bengali. lib/pronunciation/songLanguage.ts reads the text for the
 * rest; these numbers were checked by hand against data/generated/songs.json.
 */

/** Songs sung in Sanskrit although the text heuristic would not say so. */
export const SANSKRIT_SONGS: readonly number[] = [3246]

/** Songs that hold a Sanskrit verse and Bengali verses: the memo offers both languages. */
export const MIXED_SONGS: readonly number[] = [4601, 4602, 4607, 4636]
