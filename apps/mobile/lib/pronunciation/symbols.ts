/**
 * Which pronunciation rules a song's Roman text touches. Pure: no React, no data files.
 *
 * The Roman text is the Ananda Marga / Sarkar transliteration (data/pronunciation/sources.ts: sarkarverse-roman).
 * It is read into tokens, the letters and digraphs of that key, and into a few pattern ids written `@name` for
 * things a single letter cannot tell (a visarga h, the diphthongs, an `un` that stands for a velar nasal ...).
 * A rule lists the token ids it is about (`PronRule.tokens`); a rule is "used in this song" when one of them occurs.
 *
 * This says "this symbol occurs", not "this is how it is sung". It is a way to put the symbols of the song first.
 */

/** Digraphs and trigraphs of the key, longest first. Read greedily, so `t́h` is one token and not `t́` and `h`. */
const MULTI = ["t́h", "d́h", "t́", "d́", "kh", "gh", "ch", "jh", "th", "dh", "ph", "bh", "sh", "kś", "gy", "ii", "ae", "ao"]

const VOWELS = "aáeiíoóuú"
const isVowel = (ch: string) => VOWELS.includes(ch)
const isLetter = (ch: string) => /\p{L}/u.test(ch)

/** Lower case, NFC, and the one spelling of each letter. `t` + combining acute stays decomposed, as in the key. */
export function normalizeRoman(text: string): string {
  return text.normalize("NFC").toLowerCase()
}

/** Words of a normalized text (letters and the combining marks that belong to them). */
function wordsOf(text: string): string[] {
  return text.match(/[\p{L}\p{M}]+/gu) ?? []
}

/** All token ids that occur in the text. */
export function tokensInRoman(text: string): Set<string> {
  const found = new Set<string>()
  for (const word of wordsOf(normalizeRoman(text))) {
    let i = 0
    while (i < word.length) {
      const hit = MULTI.find((m) => word.startsWith(m, i))
      if (hit) {
        found.add(hit)
        i += hit.length
        continue
      }
      const ch = word[i]
      if (ch !== "́") found.add(ch)
      i += 1
    }
    addPatterns(word, found)
  }
  return found
}

function addPatterns(word: string, found: Set<string>) {
  // A visarga h: after a vowel, at the end of the word or before a consonant (namah, duhkhe). Not the h of kh, sh ...
  for (let i = 1; i < word.length; i++) {
    if (word[i] !== "h" || !isVowel(word[i - 1])) continue
    const next = word[i + 1]
    if (next === undefined || (isLetter(next) && !isVowel(next))) found.add("@visarga")
  }
  // ai oi ei ui (a letter pair, not the long ii)
  if (/[aáoeu]i(?!i)/u.test(word)) found.add("@diph")
  // un before k or g: the velar nasal; in before c or j: the palatal nasal (how the catalogue writes ṅ and ñ)
  if (/un(?=[kg])/u.test(word)) found.add("@nga")
  if (/in(?=[cj])/u.test(word)) found.add("@nya")
  // y or v/w after a consonant, followed by a vowel: the Bengali ya-phala and ba-phala
  const plain = word.replace(/\u0301/g, "")
  if (/[^aáeiíoóuúy]y(?=[aáeiíoóuú])/u.test(plain)) found.add("@yphala")
  if (/[^aáeiíoóuúyvw][vw](?=[aáeiíoóuú])/u.test(plain)) found.add("@vphala")
}
