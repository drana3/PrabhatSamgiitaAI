import type { PronSource } from "./types"

/**
 * Every source the pronunciation memo rests on. Read on 2026-11-06 for docs/pronunciation.md. A rule lists the ids
 * of the sources that state it; a rule that no source states is marked `needs-native-check`.
 */
export const PRON_SOURCES: readonly PronSource[] = [
  {
    id: "sarkarverse-roman",
    title: "Sarkarverse: Roman Saḿskrta transliteration (with the Roman Bengali additions)",
    url: "https://sarkarverse.org/wiki/Roman_Samskrta_transliteration",
    used: "The key of the Roman letters Prabhat Samgiita is printed in: á, ii, ú, ae = ai, ao = au, t́ d́ ń, sha = palatal ś and ś = retroflex ṣ, aḿ, ah, uṋ and iṋ for ṅ and ñ, ŕ for ড় and ঢ়, initial ya may be ja. The page cites Prabhat Samgiita vol. 1 (1993) and Shabda Cayanika part 2 (1996).",
    read: "2026-11-06",
  },
  {
    id: "sarkarverse-help",
    title: "Sarkarverse: Help:Roman Samskrta",
    url: "https://sarkarverse.org/wiki/Help:Roman_Samskrta",
    used: "How the marks are named (acute mark above a, u, r, t, d, n, m, s; the mark below n) and typed.",
    read: "2026-11-06",
  },
  {
    id: "wp-bn-phonology",
    title: "Wikipedia: Bengali phonology",
    url: "https://en.wikipedia.org/wiki/Bengali_phonology",
    used: "The vowels, consonants and diphthongs of Bengali in IPA; vowel length is not contrastive; the retroflex stops are not strongly retroflex; ph and bh often sound like f and v; initial stress; nasal vowels.",
    read: "2026-11-06",
  },
  {
    id: "wp-bn-alphabet",
    title: "Wikipedia: Bengali alphabet",
    url: "https://en.wikipedia.org/wiki/Bengali_alphabet",
    used: "The IPA of each Bengali letter; the inherent vowel and when it rises to o; ই and ঈ, উ and ঊ sound alike; ঋ is ri; জ্ঞ is a long g; the effect of ya-phala and ba-phala; visarga doubles the next consonant; chandrabindu nasalises the vowel.",
    read: "2026-11-06",
  },
  {
    id: "wp-bn-romanisation",
    title: "Wikipedia: Romanisation of Bengali",
    url: "https://en.wikipedia.org/wiki/Romanisation_of_Bengali",
    used: "Roman spellings follow the letters, not the sound: শ ষ স are all usually [ʃ]; the Bengali inherent vowel is [ɔ~o], not the Sanskrit [ɐ]; অজ্ঞান is [ˈɔɡːæn].",
    read: "2026-11-06",
  },
  {
    id: "wp-schwa",
    title: "Wikipedia: Schwa deletion in Indo-Aryan languages",
    url: "https://en.wikipedia.org/wiki/Schwa_deletion_in_Indo-Aryan_languages",
    used: "Bengali drops a word-final inherent vowel unless a cluster or h comes before it (পথ is [pɔtʰ], অন্ত keeps its o); Sanskrit keeps the vowel everywhere.",
    read: "2026-11-06",
  },
  {
    id: "wp-anusvara",
    title: "Wikipedia: Anusvara",
    url: "https://en.wikipedia.org/wiki/Anusvara",
    used: "Bengali ং is a final [ŋ] (বাংলা [baŋla]); in Sanskrit it stands for a nasal that matches the next consonant.",
    read: "2026-11-06",
  },
  {
    id: "wp-visarga",
    title: "Wikipedia: Visarga",
    url: "https://en.wikipedia.org/wiki/Visarga",
    used: "Sanskrit visarga is [h], sometimes with an echo of the vowel before it; in Bengali it is silent or a faint breath at the end of a word and doubles the next consonant inside a word.",
    read: "2026-11-06",
  },
  {
    id: "wp-candrabindu",
    title: "Wikipedia: Chandrabindu",
    url: "https://en.wikipedia.org/wiki/Chandrabindu",
    used: "The chandrabindu usually means that the vowel before it is nasalised.",
    read: "2026-11-06",
  },
  {
    id: "wp-ipa-sanskrit",
    title: "Wikipedia: Help:IPA/Sanskrit",
    url: "https://en.wikipedia.org/wiki/Help:IPA/Sanskrit",
    used: "The IPA and English approximations of every Sanskrit vowel and consonant; dental versus retroflex; ṛ; visarga as [h]; stress by syllable weight in Classical Sanskrit.",
    read: "2026-11-06",
  },
  {
    id: "wp-sanskrit-phonology",
    title: "Wikipedia: Sanskrit phonology",
    url: "https://en.wikipedia.org/wiki/Sanskrit_phonology",
    used: "Long vowels last about twice as long as short ones; the classes of consonants; ś ṣ s are three sounds; v was earlier [w], later labio-dental; the pitch accent of Vedic.",
    read: "2026-11-06",
  },
  {
    id: "wikt-bn-pron",
    title: "Wiktionary: Appendix:Bengali pronunciation",
    url: "https://en.wiktionary.org/wiki/Appendix:Bengali_pronunciation",
    used: "IPA of the Bengali consonants and vowels with example words; [s] is mostly word-initial or before dental, l and r consonants and in loanwords; z mostly in loanwords.",
    read: "2026-11-06",
  },
  {
    id: "ps-data",
    title: "This app's catalogue (data/generated/songs.json, 5018 songs)",
    url: "data/generated/songs.json",
    used: "Which Roman symbols the lyrics really use and how (counted by the team: ś, sh, ń, t́, d́, ŕ, ḿ, ae, ao, un/in for ṅ/ñ, kś, gy, a final h as visarga; no ṋ at all). The example words are taken from these lyrics. This is evidence of usage, not a linguistic source.",
    read: "2026-11-06",
  },
] as const

export const PRON_SOURCE_IDS: readonly string[] = PRON_SOURCES.map((source) => source.id)
