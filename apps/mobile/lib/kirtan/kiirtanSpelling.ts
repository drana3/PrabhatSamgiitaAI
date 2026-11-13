/**
 * "Kiirtan" with two i's (Dada, 9 Nov 2026). Whatever a person types in a title or a name, the word kirtan in any case or spelling
 * (kirtan, Kirtan, KIRTAN, kiirtan, Kiirtan) is written "Kiirtan". The check is on words, not on parts of words: "Sankirtan" is
 * left alone, "kirtans" becomes "Kiirtans" and "my kirtan 2" becomes "my Kiirtan 2". Pure, so a text field can run it on every
 * change and on blur (it changes nothing that is already right) and the submission can run it once more before it is sent.
 * Only visible strings are corrected: code identifiers, ids and routes keep the `kirtan` spelling.
 */
// no look-behind (older JavaScript engines): the character before the word is kept by the replacement
const KIRTAN_WORD = /(^|[^\p{L}\p{N}])ki{1,2}rtan/giu

export function fixKiirtanSpelling(text: string): string {
  return text.replace(KIRTAN_WORD, "$1Kiirtan")
}

/** Does the text hold the word the wrong way (so a field can tell it changed the text)? */
export function hasKirtanSpelling(text: string): boolean {
  return fixKiirtanSpelling(text) !== text
}

/**
 * A patch of a form with the text fields named in `keys` spelled right. The stores run every patch of a title or a name through this, so
 * each input (the queue's titles, the performer, the place, a playlist's title and tracks) is corrected as it is typed, with no
 * per-input code to forget. A key that is not in the patch, or not text, is left as it is.
 */
export function fixKiirtanSpellingIn<T extends object>(patch: T, keys: readonly (keyof T)[]): T {
  let out = patch
  for (const key of keys) {
    const value = patch[key]
    if (typeof value === "string") {
      const fixed = fixKiirtanSpelling(value)
      if (fixed !== value) out = { ...out, [key]: fixed }
    }
  }
  return out
}
