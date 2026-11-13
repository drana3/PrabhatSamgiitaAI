# How to pronounce: the pronunciation memo

Every song page has a "How to pronounce" cheat-sheet: a bottom sheet with the pronunciation rules of the Roman letters of the song's language, and a sound to tap for every example word. It opens from the "Aa" text options (last row of the popover) and from the About area at the end of the page. Nothing plays by itself.

Status: **no native speaker has checked any rule or any sound yet.** Every rule carries `verified: false`. The sounds are a computer voice. The sheet says so. This page lists what is sourced, what is a reading of ours, and what a native speaker must confirm.

## What is in the sheet

The sheet is a **cheat-sheet**, built to be read by a child: on the left "You see" (the Roman letters), on the right "It sounds like" (the closest sound in the reader's language), and a speaker button to hear a real word of the lyrics. Nothing in it is new: every line is a `pron.<rule id>.like` or `pron.<rule id>.text` string of `locales/pronunciation.ts`, and the audio is the existing clips.

1. The language switch (Bengali | Sanskrit). The sheet opens in the language the song seems to be in (see "Which language"); the other one is one tap away, so a wrong guess is never hidden. A song with both languages gets one extra line that says so.
2. One quiet line: the sounds are a computer voice, close but not exact (Sanskrit adds the Hindi-voice note).
3. **Six groups**, the data's own groups, in this order: Vowels, Consonants, Nose sounds, S and sh sounds, Special signs, Good to know (the general rules of the language: what the Roman text spells, the inherent a, final a, aspirates, stress ...). Each group is a card with a header that opens it; the vowels are open, the others open with a tap. A header says how many of its letters occur in this song.
4. Inside a group the letters **that occur in this song come first and are shaded**; the rest follow in the order of the rule list.
5. A **row** shows at most four letters, one line (the "close to" line, or the first sentence of the rule when it has none) and a speaker for the rule's first example word. Tap the row to open it: the script letters, the IPA, the whole rule and every example word with its song number.
6. A rule that a native speaker has still to confirm (`status: "needs-native-check"`) says "being checked" in small grey type on its row, and "Needs a native-speaker check" when the row is open. A footer says how many rules are still being checked. Nothing is hidden.
7. The sources, in small type.

`lib/pronunciation/cheatSheet.ts` is pure (no text, no React): it cuts the rules of `memo.ts` into the six groups, puts the song's letters first and picks the letters and the word for each row. `__tests__/pronunciationCheatSheet.test.ts` checks it. The old long memo (basics, letters in this song, all letters, one block per rule) is gone from the sheet; `buildMemo` stays because the cheat-sheet is built on it.

## Files

| File | What it is |
| --- | --- |
| `data/pronunciation/types.ts` | The shape of a rule, a sample and a source |
| `data/pronunciation/bengali.ts`, `sanskrit.ts` | The rules (`BENGALI_RULES`, `SANSKRIT_RULES`) |
| `data/pronunciation/rules.ts` | The `rule()` builder: audio ids `<rule id>.<n>`, `verified: false` |
| `data/pronunciation/sources.ts` | The sources (`PRON_SOURCES`) |
| `data/pronunciation/songLanguages.ts` | Songs whose language was checked by hand |
| `data/pronunciation/audioIndex.ts` | GENERATED: audio id to clip (never edit by hand) |
| `lib/pronunciation/symbols.ts` | Reads a song's Roman text into symbols (tokens) |
| `lib/pronunciation/memo.ts` | Splits the rules of one language: basics, symbols of this song, the rest |
| `lib/pronunciation/cheatSheet.ts` | Cuts them into the six groups of the cheat-sheet (pure) |
| `lib/pronunciation/songLanguage.ts` | Which language a song gets |
| `lib/pronunciation/audio.ts` | Plays a clip (expo-av) |
| `components/song-page/Pronunciation.tsx` | The sheet and the row that opens it |
| `locales/pronunciation.ts` | en, ru, es texts |
| `assets/audio/pronunciation/computer/` | Computer-voice clips (m4a) and `manifest.json` |
| `assets/audio/pronunciation/native/` | Recordings by a native speaker (empty today) |
| `scripts/pronunciation/*.mjs` | Generate the clips and the index |
| `__tests__/pronunciation*.test.ts` | Tests |

Existing files touched (all additive, a few lines each): `components/song-page/state.ts` (the sheet name `"pronounce"`), `Sheets.tsx` (renders the sheet), `TextOptions.tsx` (the row in the Aa popover), `SongPage.tsx` (the row in the About area), `locales/en.ts`, `ru.ts`, `es.ts` (spread the new module) and `locales/review.json` (new keys marked as not reviewed).

## The rules

A rule has: `id` (`bn.*` or `sa.*`), `group` (general, vowel, consonant, sibilant, nasal, special), `symbols` (as the app's Roman text writes them), `script` (the letters), `ipa`, `tokens` (what to look for in a song's Roman text), `samples` (example words, each with its audio id), `like` (has a "close to" line), `sources` (ids), `status`, `verified` and, where a check is needed, `checkNote`.

* `status: "sourced"`: the fetched sources state the rule (or it follows directly from the letters they define).
* `status: "needs-native-check"`: it is the best reading we have, or the sources do not settle it. `checkNote` says why. These rules show a mark in the sheet.
* `verified`: true only after a native speaker has listened and agreed. It is false for every rule today.

The Roman text is the Ananda Marga / Sarkar transliteration (á ii ú ae ao ś sh ń t́ d́ ŕ ḿ kś gy; un and in for the velar and palatal nasals; a final h for the visarga). It follows the **letters** of the script, not always the sound: in Bengali i and ii, u and ú, and sh ś s sound alike, so the basics block says so.

The English texts say only what the sources state. The "Close to" lines in en, ru and es are approximations by design (an English, Russian or Spanish sound that is nearest), not claims about the language.

## Which language a song gets

The catalogue has no reliable language field per song; nearly all songs are Bengali. `songPronLanguage(number, roman)`:

1. `SANSKRIT_SONGS` and `MIXED_SONGS` in `data/pronunciation/songLanguages.ts` (checked by hand: PS 3246 is Sanskrit; PS 4601, 4602, 4607, 4636 start with a Sanskrit verse and go on in Bengali, so they get a switch with a note).
2. Otherwise the text: a song is "sanskrit" when at least half of its lines read as Sanskrit (frequent Sanskrit function words and endings) and fewer than 15% read as Bengali (frequent Bengali function words); everything else is "bengali".

Run over the 5018 songs this gives PS 1565, 2526, 3246, 3653, 4279, 4281 as Sanskrit, the four above as mixed, the rest Bengali. A song with no text (one in the catalogue) is Bengali by default. The sheet always offers the other language. A "mixed" song opens in Bengali with the note that it also has Sanskrit lines.

## Audio

**Which source: a computer voice, labelled as such in the sheet.** No human recordings exist yet. The clips are made on macOS with `say` and compressed with ffmpeg:

* Bengali words: the `bn_IN` voice **Piya**, reading the Bengali-script spelling of the word.
* Sanskrit words: the `hi_IN` voice **Lekha**, reading the Devanagari spelling (macOS has no Sanskrit voice).

Honest limits:

* The voices are not native Sanskrit or Bengali singers; the sound is approximate. A Hindi voice reading Sanskrit **drops a final short a** that Sanskrit keeps, and may not hold long vowels twice as long. The sheet says so for Sanskrit.
* The Bengali and Devanagari spellings of the example words (in `samples[].script`) are the project's own, written from the Roman text. A wrong spelling gives a wrong clip. A native speaker must read them too.
* A rough check with a speech recogniser (Whisper) recognised only a couple of clips and failed on the shortest ones. That shows at most that some clips are audible words; it is not proof that any clip is right. Nobody has listened to them with a native ear.
* Apple's licence terms for redistributing audio produced by the macOS system voices were not checked. **Check them before a store release**, or replace the clips with recordings.

Size: 137 clips, about 420 KB in total (mono, 22 kHz, AAC 32 kbps). The budget in the tests is 1.5 MB.

Playback (`lib/pronunciation/audio.ts`, expo-av, no new native dependency):

* Only a tap starts a clip. One clip at a time; tapping a playing clip stops it.
* A song that is playing is paused first (`yieldSongPlayback` from `lib/audioFocus.ts`, the call the harmonium uses). `stores/playerStore.ts` is not touched.
* The audio mode is set to play in silent mode (the person tapped it to hear it), without recording, with ducking on Android.
* The clip is stopped when the sheet closes, and when a song or the capture screen takes the audio session back (`registerExtraAudioCleanup`).
* A failure shows "This device could not play the sound." and nothing else changes.

### Replace a computer clip with a native recording

1. Record the word (the same word the row shows: its audio id is `<rule id>.<n>`; `assets/audio/pronunciation/computer/manifest.json` lists every id with the word and the text that was read).
2. Save it as `assets/audio/pronunciation/native/<audio id>.m4a` (`.mp3` or `.wav` also work), mono, short, trimmed. Example: `native/bn.aa.1.m4a`.
3. Run `node scripts/pronunciation/build-audio-index.mjs`. A native file wins over the computer clip of the same id; `data/pronunciation/audioIndex.ts` is rewritten with `kind: "native"` for it.
4. Commit the file and the regenerated index. Nothing else changes: the sheet's note is shown while any clip in view is still a computer voice, and `clipKind(id)` tells the code which kind a clip is.
5. When a native speaker has also confirmed a rule, set its `verified` to true: in `rules.ts` the builder fixes it to `false`, so add an override there for that rule id (or give `rule()` a `verified` input) and update the tests that pin it.

To change the example words or add rules: edit the data files, then `node scripts/pronunciation/generate-clips.mjs` (makes the clips that are missing; `--force` makes all) and `node scripts/pronunciation/build-audio-index.mjs`. The tests fail if a clip or an index entry is missing or orphaned.

## Sources

All read on 2026-11-06. Every rule names its source ids in its data.

- `sarkarverse-roman`: Sarkarverse: Roman Saḿskrta transliteration (with the Roman Bengali additions). https://sarkarverse.org/wiki/Roman_Samskrta_transliteration (read 2026-11-06). Used for: The key of the Roman letters Prabhat Samgiita is printed in: á, ii, ú, ae = ai, ao = au, t́ d́ ń, sha = palatal ś and ś = retroflex ṣ, aḿ, ah, uṋ and iṋ for ṅ and ñ, ŕ for ড় and ঢ়, initial ya may be ja. The page cites Prabhat Samgiita vol. 1 (1993) and Shabda Cayanika part 2 (1996).
- `sarkarverse-help`: Sarkarverse: Help:Roman Samskrta. https://sarkarverse.org/wiki/Help:Roman_Samskrta (read 2026-11-06). Used for: How the marks are named (acute mark above a, u, r, t, d, n, m, s; the mark below n) and typed.
- `wp-bn-phonology`: Wikipedia: Bengali phonology. https://en.wikipedia.org/wiki/Bengali_phonology (read 2026-11-06). Used for: The vowels, consonants and diphthongs of Bengali in IPA; vowel length is not contrastive; the retroflex stops are not strongly retroflex; ph and bh often sound like f and v; initial stress; nasal vowels.
- `wp-bn-alphabet`: Wikipedia: Bengali alphabet. https://en.wikipedia.org/wiki/Bengali_alphabet (read 2026-11-06). Used for: The IPA of each Bengali letter; the inherent vowel and when it rises to o; ই and ঈ, উ and ঊ sound alike; ঋ is ri; জ্ঞ is a long g; the effect of ya-phala and ba-phala; visarga doubles the next consonant; chandrabindu nasalises the vowel.
- `wp-bn-romanisation`: Wikipedia: Romanisation of Bengali. https://en.wikipedia.org/wiki/Romanisation_of_Bengali (read 2026-11-06). Used for: Roman spellings follow the letters, not the sound: শ ষ স are all usually [ʃ]; the Bengali inherent vowel is [ɔ~o], not the Sanskrit [ɐ]; অজ্ঞান is [ˈɔɡːæn].
- `wp-schwa`: Wikipedia: Schwa deletion in Indo-Aryan languages. https://en.wikipedia.org/wiki/Schwa_deletion_in_Indo-Aryan_languages (read 2026-11-06). Used for: Bengali drops a word-final inherent vowel unless a cluster or h comes before it (পথ is [pɔtʰ], অন্ত keeps its o); Sanskrit keeps the vowel everywhere.
- `wp-anusvara`: Wikipedia: Anusvara. https://en.wikipedia.org/wiki/Anusvara (read 2026-11-06). Used for: Bengali ং is a final [ŋ] (বাংলা [baŋla]); in Sanskrit it stands for a nasal that matches the next consonant.
- `wp-visarga`: Wikipedia: Visarga. https://en.wikipedia.org/wiki/Visarga (read 2026-11-06). Used for: Sanskrit visarga is [h], sometimes with an echo of the vowel before it; in Bengali it is silent or a faint breath at the end of a word and doubles the next consonant inside a word.
- `wp-candrabindu`: Wikipedia: Chandrabindu. https://en.wikipedia.org/wiki/Chandrabindu (read 2026-11-06). Used for: The chandrabindu usually means that the vowel before it is nasalised.
- `wp-ipa-sanskrit`: Wikipedia: Help:IPA/Sanskrit. https://en.wikipedia.org/wiki/Help:IPA/Sanskrit (read 2026-11-06). Used for: The IPA and English approximations of every Sanskrit vowel and consonant; dental versus retroflex; ṛ; visarga as [h]; stress by syllable weight in Classical Sanskrit.
- `wp-sanskrit-phonology`: Wikipedia: Sanskrit phonology. https://en.wikipedia.org/wiki/Sanskrit_phonology (read 2026-11-06). Used for: Long vowels last about twice as long as short ones; the classes of consonants; ś ṣ s are three sounds; v was earlier [w], later labio-dental; the pitch accent of Vedic.
- `wikt-bn-pron`: Wiktionary: Appendix:Bengali pronunciation. https://en.wiktionary.org/wiki/Appendix:Bengali_pronunciation (read 2026-11-06). Used for: IPA of the Bengali consonants and vowels with example words; [s] is mostly word-initial or before dental, l and r consonants and in loanwords; z mostly in loanwords.
- `ps-data`: This app's catalogue (data/generated/songs.json, 5018 songs). data/generated/songs.json (read 2026-11-06). Used for: Which Roman symbols the lyrics really use and how (counted by the team: ś, sh, ń, t́, d́, ŕ, ḿ, ae, ao, un/in for ṅ/ñ, kś, gy, a final h as visarga; no ṋ at all). The example words are taken from these lyrics. This is evidence of usage, not a linguistic source.

## Rules that need a native speaker

- `bn.g.final` (-a): Wikipedia gives the rule (final inherent vowel dropped unless a cluster or h precedes; tatsama words often keep it) and the example পথ. Which songs words are sung with the final o (tava, bhálo, kata) is not stated by any source we found. Needs a native speaker.
- `bn.g.nasalvowel` (ṋ): The key writes the chandrabindu as ṋ, but the catalogue contains no ṋ at all. That a nasal vowel hides in an n before a consonant (ánkhi) is our reading of the text, not a statement of any source.
- `bn.e` (e): Sources say e is [e], and [æ] or [ɛ] occurs mainly in the first syllable (এক is [ɛk] in Wiktionary). They do not say in which words. The Roman text writes e for both; only a native speaker can say which words take the open sound.
- `bn.ao` (ao): The key makes ao the letter ঔ, but in the catalogue ao is also two separate vowels in words such as nao (নাও), kao (কও), ájao. The text does not tell them apart. Which words are which needs a native speaker.
- `bn.ri` (r ri): Wikipedia gives ঋ as /ri/. The Roman text writes it as plain r (krśńa) and sometimes as ri, so the text cannot show where it is. The sound of the whole word কৃষ্ণ is not given by the sources.
- `bn.rr` (ŕ): The sources give the letters ড় ঢ় as a flap [ɽ] (Wiktionary also notes [ɹ]) and the key writes them ŕ. How close the English comparison in the app is to a Bengali ear is not stated anywhere; a native speaker should judge the clip.
- `bn.s` (s): Sources agree that স is usually [ʃ] but is [s] in some clusters and loanwords (Wiktionary: word-initially or before dental, l, r; Wikipedia: আস্তে [aste] against আসতে [aʃte]). They do not agree on the exact conditions, and the two examples above (sab, sthán) are our illustrations, not quotations. A native speaker must decide each word.
- `bn.nya` (in): Wikipedia lists ঞ as /nɔ/ (a nasal in the palate region before ch/j). The key writes it iṋ; the catalogue writes it as in (jhainjhá). That in before c or j means ঞ is our reading of the catalogue. A native speaker should confirm the sound of ঝঞ্ঝা.
- `bn.kss` (kś): No source we could open gives the Bengali sound of ক্ষ. Our description (a long kh) is the common description, not a quotation. The Assamese entry in Wiktionary differs (khyo). Needs a native speaker.
- `bn.yphala` (-ya-): Wikipedia states the rule with the examples ত্যাগ [t̪æɡ] and মুখ্য [mukʰːɔ]. Our two words are applications by analogy, not quoted examples. A native speaker should confirm ব্যথা and লক্ষ্য.
- `bn.vphala` (-va- -wa-): Wikipedia states the rule with স্বাধীন [ʃad̪ʱin] and বিশ্ব [biʃːɔ]. Our svapane is an application by analogy. A native speaker should confirm.
- `bn.loan` (f z q): The key adds f, z, q for sounds of Persian, Arabic and English words. The sources say ph is often [f] and z is mostly a loanword sound, often replaced by j; how a singer says them is not stated. Needs a native speaker.
- `sa.g.stress` (ˈ): Wikipedia says Classical Sanskrit stress depends on syllable weight counted from the end, and Vedic had a pitch accent. How the Sanskrit verses of Prabhat Samgiita are meant to be stressed when sung is not stated by any source we found.
- `sa.ri` (r ri rr): Wikipedia gives [r̩] and notes that most modern speakers say [ɻĭ] or [ɾɪ] (southern speakers [rŭ]). Which way the Sanskrit verses are said by the Ananda Marga community is not stated. The catalogue writes ṛ as r, ri or rr (kriśńo, mriga, kripá, drrśt́am), so the text cannot show where it is.
- `sa.ao` (ao): The key makes ao the letter औ, but in the catalogue ao is sometimes two separate vowels (nao, kao). The example word comes from a Bengali song because no Sanskrit song of the catalogue has ao as a diphthong.
- `sa.anusvara` (ḿ): Wikipedia says the anusvara stands for a nasal that matches the following consonant and that its exact nature is debated; at the end of a word it is commonly said as m. The sources we opened do not state the word-final value for Sanskrit. Needs a native speaker.
- `sa.kss` (kś): क्ष is k followed by ṣ, so [kʂ] follows from the letters (wp-ipa-sanskrit); no source we opened describes the cluster as a whole, and many speakers say it differently (for example 'ksh' or 'kkh').

Besides these 17 rules: **all** rules are unverified (none has been heard by a native speaker), all clips are a computer voice, and the example-word spellings in script are the project's own.

## Tests

`npm test` in `apps/mobile`:

* `pronunciationSymbols.test.ts`: reading a song's Roman text into symbols; the order of the memo (basics, symbols of this song, the rest; no rule twice).
* `pronunciationLanguage.test.ts`: the language choice, also over the whole catalogue.
* `pronunciationData.test.ts`: data integrity (ids, sources, status and verified flags, every rule has a sound except the five explained in words only, every example word really occurs in the stated song, every symbol occurs in the catalogue, clips and index agree, bundle size, texts in en/ru/es for every rule, placeholders match).
* `pronunciationAudio.test.ts`: playback logic with a faked expo-av (pauses the song first, one clip at a time, no autoplay, errors, release on audio-focus change).

## Not verified

* Real devices: playback on iOS and Android, the iOS silent switch, interruption by a phone call, and the pause of a playing song were not run on a device (the logic is tested with a fake player; the web build plays a clip in headless Chromium).
* How the clips sound to a native ear.
* Dark mode and the largest accessibility text sizes of the sheet were not looked at.
* `docs/song-page-redesign.md`, named in the task, does not exist in the repository; the design language was taken from the code (`components/song-page/ui.tsx`, `SpSheet`, `SpTheme`).

## Known data issue found on the way

The catalogue text of PS 3756 and PS 3850 contains broken characters (`SŔu83 ́u84 ́ STHITI`, from a failed conversion of "sṛṣṭi"). They are not used by the memo, but the lyrics of those songs are wrong in the catalogue.
