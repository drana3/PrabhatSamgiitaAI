/**
 * Pronunciation memo: the shape of the data (see docs/pronunciation.md).
 *
 * Nothing in these files is invented: every rule names the sources it rests on (data/pronunciation/sources.ts)
 * and says whether the sources really state it ("sourced") or whether it is the best reading we have and must be
 * checked by a native speaker ("needs-native-check"). No native speaker has confirmed any rule yet, so
 * `verified` is false everywhere; flip it to true only after a person has listened and agreed.
 *
 * This file holds types only (no imports), so a Node script can read the data files directly.
 */

export type PronLanguage = "bengali" | "sanskrit"

export type PronGroup = "general" | "vowel" | "consonant" | "sibilant" | "nasal" | "special"

export type RuleStatus = "sourced" | "needs-native-check"

/** One word to listen to: a real word of a Prabhat Samgiita lyric, how it is spelled in the app, in script, and its clip. */
export type PronSample = {
  /** the word as the app's Roman text spells it, lower case, NFC (data/generated/songs.json is the proof) */
  roman: string
  /** the same word in the script the clip reads (Bengali script for Bengali, Devanagari for Sanskrit) */
  script: string
  /** a song of the catalogue in which this exact word occurs */
  song: number
  /** audio id: see data/pronunciation/audioIndex.ts */
  audio: string
}

export type PronRule = {
  /** `bn.<name>` or `sa.<name>`; also the key stem in locales/pronunciation.ts: `pron.<id>.text` and `pron.<id>.like` */
  id: string
  language: PronLanguage
  group: PronGroup
  /** the symbols as the app's Roman text writes them (what the row shows large) */
  symbols: string[]
  /** the letters of the script they stand for */
  script: string[]
  /** IPA, in the sources' notation */
  ipa: string
  /**
   * What to look for in a song's Roman text to say "this rule is used here": token ids of
   * lib/pronunciation/symbols.ts (letters, digraphs and a few `@pattern` ids). Empty: cannot be told from the text.
   */
  tokens: string[]
  /** words to hear, each with its own clip */
  samples: PronSample[]
  /** locales/pronunciation.ts has a `pron.<id>.like` line (an approximate English/Russian/Spanish equivalent) */
  like: boolean
  /** ids of data/pronunciation/sources.ts */
  sources: string[]
  status: RuleStatus
  /** a native speaker has listened and confirmed. False for every rule today. */
  verified: boolean
  /** why a native check is needed (English, for the team and docs/pronunciation.md; not shown in the app) */
  checkNote?: string
}

export type PronSource = {
  id: string
  title: string
  url: string
  /** what the project took from it */
  used: string
  /** when it was read for this memo */
  read: string
}
