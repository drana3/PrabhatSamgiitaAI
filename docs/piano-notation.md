# Piano notes for Kiirtans and Prabhat Samgiita: proposal

Status (2026-11-09): **Variant A is decided and built (Stages 0, 1 and 2, section 0).** Sections 1 to 9 below are the research and the options
that led to it; they are kept as the record. Dada asked (2026-11-08): notes for the piano, for Kiirtans and for Prabhat Samgiita (PS);
how to play on the piano; a way for people to add notes; and a section "Kiirtans for piano". The board for Dada (Russian, 390 px
screenshots of the built screens on top, the old proposals below as an archive) is `Для-Дады/ноты-для-пианино/index.html` in the
Carousel folder.

Every claim carries a tag: **[source]** a page on the internet (links in section 9), **[code]** this repository (path given),
**[assumption]** my inference, to be checked. No text or notes of anyone's composition are copied here; all examples are made-up scale
exercises.

## 0. Decisions and what is built

Dada chose on 2026-11-09:

| Question | Decision |
|---|---|
| Which variant | **A, the on-screen keyboard with swaras.** No staff notation (B), no falling keys (D). A link to notes kept elsewhere is allowed (C), as a link only |
| Easy keys | **On by default.** Sa sits on C, so the plain notes (shuddha swaras) are the white keys. The reader can switch it off and pick another Sa |
| Stages | 0, 1 and 2 |
| Who adds notes | Any signed-in member, for a recording and for a PS song. The author of the recording (the account that uploaded it) goes live at once; everybody else, and everybody for PS songs, waits for the team, like chords. A link always waits unless the team posted it |
| Shelf | **One** shelf "Kiirtan for piano": recordings with accepted piano notes **or** whose lead instrument is the piano. One recording is enough; no pinning; never empty |
| Sound | Piano samples under CC BY 3.0 with the credit in About. If this could not be done reliably the harmonium sound would stay |

What was built (branch `redesign/v2`):

* **Stage 0**: "Play on the piano" for PS songs 1, 2 and 27 from the booklet data that is already in the app
  (`lib/pianoNotes/booklet.ts`). No server needed.
* **Stage 1**: table `piano_sheets` and `piano_sheet_reports` (migration `0050_piano_sheets`), the API `/api/v1/piano-notes`
  (`apps/api/app/api/v1/piano_sheets.py`), the input screen (`app/piano-notes-edit.tsx`), the reader (`app/piano-notes.tsx`,
  `components/piano/PianoReader.tsx`), the team's review screen (`app/piano-review.tsx`, entered from the team review desk) and
  the blocks on the recording page and on the song page.
* **Stage 2**: versions (`replaces_id`, `archived_at`), "start from these notes" with the credit (`based_on_id`), levels (one
  finger, or two hands when a row has `hand: "left"`; the level is worked out from the rows, never taken from the request),
  piano sound, and the link field.

### The sheet

A sheet is rows of steps. A step is `{k: [semitones above Sa], b: beats}`; beats come in quarters (0 < b <= 16); an empty `k` is a
rest; up to 6 keys in a step (a chord). A row has an optional label, `repeat` (1 to 16) and `hand` (`right` or `left`). A sheet is
independent of the key: `sa_key` only records where Sa sat when it was written; the reader picks Sa and the keyboard lights the
keys. Limits: 24 rows, 128 steps per row, 600 steps in all, keys from two octaves below Sa to three above, at least two sounding
steps.

The input accepts typed sargam: `Sa Re Ga Ma Pa Dha Ni`; small `re ga dha ni` (and `Reb Gab Dhab Nib`) are komal, `Ma#` is tivra;
the one-letter forms `S R G M P D N` also work (`M` is tivra, `m` is the plain Ma, `r g d n` are komal); `'` goes an octave up and a
leading `.` or `_` an octave down; `:2` sets the length, `-` holds the previous step, `0` or `0:2` is a rest, `(Sa Ga Pa):2` is a
chord, `|` is ignored. The keys can also be tapped on the keyboard (a "Chord" toggle collects several keys into one step; real
multi-touch is not used).

Playback follows the rows: a right-hand row starts a group and the left-hand rows after it join it at the same time; rows repeat on
their own; keys at the same time are one "moment"; "one finger" leaves the left hand out. Speed 40 to 140 beats a minute.

### Rules the server keeps

* Publishing as above. A team member's sheet is live at once. Team review: approve, reject (with a reason, the member gets a notice
  `piano_rejected`) or restore (`piano_published`).
* Limits: 10 sheets a day and 6 an hour per member (team: 120 an hour, no daily limit); the daily count is read from the table, so
  deleting a sheet gives the place back; 3 open (waiting or rejected) sheets per member and target. The same notes twice are
  refused by a fingerprint (409 `piano_duplicate`).
* Reports: anyone may report live notes, once per person; reports show in the team's queue.
* Privacy: the public list is `Cache-Control: private, no-store` because it holds the viewer's own waiting sheets; an anonymous sheet
  carries no author (the team sees the author in review).
* Error codes the phone has words for: `piano_daily_limit`, `piano_duplicate`, `piano_open_limit`, `piano_not_editable`.

### Sound and licence

Salamander Grand Piano V2 (Yamaha C5) recorded by Alexander Holm, **CC BY 3.0** (https://creativecommons.org/licenses/by/3.0/).
The licence was read in two places: the sfzinstruments repository page and the README of Tonejs/audio (`salamander`: "Licence:
CC-by ... Author: Alexander Holm"). The app carries 14 MP3 files taken unchanged from
https://github.com/Tonejs/audio/tree/master/salamander: A2 C3 Ds3 Fs3 A3 C4 Ds4 Fs4 A4 C5 Ds5 Fs5 A5 C6, 932 KB in all
(`apps/mobile/assets/audio/piano/`, with `LICENSE.txt`). Other keys are made by playing the nearest sample at most three semitones
faster or slower. The credit is in About, "Credits". If a sample cannot load, the harmonium sound plays instead.

### The shelf

`kiirtan:piano` in the Kiirtan block of the Search menu, rule `MENU_RULES.kiirtanPiano = {on: 1, off: 1}`, and a row on the Kiirtan
tab with "See all". The ids come from `GET /piano-notes/recordings` (read at most every two minutes); the lead instrument is read
defensively, so the shelf works before the upload form's field exists. Only Kiirtans count. See docs/search-menu.md section 9.3b.

### Not done, and not checked

* Not tried on a real phone: touch on the keyboard (one finger at a time), sound latency, the sound with the silent switch.
* The migration was run on SQLite in the tests; **not on PostgreSQL**.
* Staff notation, falling keys, MusicXML import and a notation file upload are not built (B, D and a stored file were not chosen).
* ru and es words are listed as unreviewed in `locales/review.json`.

## 1. What the app has today

| Thing | State | Where |
|---|---|---|
| Sargam notation of PS songs, as data | `HarmoniumNotation`: lines of lyrics, measures, beats, notes (`sargam`, `western`, `duration`, `octave`, `syllable`), tala. Sa is movable: the same data is transposed by `?scale=` | [code] `apps/api/app/schemas/notation.py`, `GET /songs/{n}/notation` |
| How many songs have it | 3 machine-readable (songs 1, 2, 27); about 1,098 as Bengali-script PDF links; 175 Roman booklets and 1,201 Bengali scans are a plan, not data | [code] `docs/song-page-redesign.md` (table of real numbers) |
| Who can add sargam | Admins only, line by line (`NotationCapture`) | [code] `apps/api/app/services/sargam_capture.py`, `apps/mobile/app/admin/sargam/[number].tsx` |
| A keyboard on screen | 25 keys, white and black, one octave below Sa to one above; Sa picker (`HARMONIUM_TONICS`); each key knows its western name ("D4"), Latin and Devanagari swara; typed sargam is parsed (`parseSargamInput`); sample playback; windows cut out of the layout | [code] `packages/core/src/harmonium-keyboard.ts`, `apps/mobile/components/songs/VirtualHarmonium.tsx`, `lib/harmonium-v2/keyboardWindow.ts` |
| Chords to keys | A chord is three keys, with the swara of each key for the chosen Sa | [code] `apps/mobile/lib/harmonium-v2/chords.ts` |
| Chord charts for recordings | Table `recording_chord_sheets`: instrument `guitar` or `harmonium` (database CHECK), status pending / published / rejected, team review, versions (`replaces_id`), "Start from this chart" (`based_on_id`), key and capo | [code] `apps/api/app/models/recording_extras.py`, migration `0047_recording_chord_charts.py`, screens `recording-chart.tsx`, `upload-chords.tsx`, `recording-chords.tsx`, `chords-review.tsx` |
| Kiirtan chords (loops, "x4") | Proposal board only, not built; the viewer today is plain text | [code] board `киртан-аккорды-и-видео`; `components/recording-extras/ChordsViewer.tsx` |
| Video links on recordings | Built on `redesign/v2` | [code] `components/recording-extras/VideosSection.tsx` |
| Recording fields | `recording_type`, `tempo`, `performance` (migration 0046). **No `instruments` field yet** (it is page 5 of the upload wizard proposal) | [code] `docs/kiirtan-recording-info.md`, board `мастер-загрузки-киртана` |
| Search shelves that appear by themselves | A value becomes a shelf at 3 recordings, leaves under 2 after a 7-day hold; any `tags` facet is found without code; the team may pin up to 3 shelves (a pinned shelf skips the threshold, never the "not empty" rule) | [code] `lib/searchMenu/config.ts`, `facets.ts`, `docs/search-menu.md` sections 2.7 and 10 |
| Sounds | Harmonium reed samples only (39 files, 8.3 MB, CC0). No piano samples | [code] `assets/audio/harmonium-player/ATTRIBUTION.txt` |
| Libraries | `react-native-svg` 15.12.1, `react-native-webview` 13.15.0, `expo-document-picker`, `expo-file-system` already installed. No music-notation or MIDI library | [code] `apps/mobile/package.json` |

Consequence: for **PS** the melody is already data and the keyboard already exists, so "how to play it on the piano" is mostly a new
view of existing data. For **Kiirtans** there is no notation at all; that is the new part.

## 2. How piano music is written down (research)

| System | What it is | For us |
|---|---|---|
| Staff notation | Five lines, absolute pitch, exact durations; ties music to one key [source: swarganga] | The world standard, but the Indian tradition is movable-Sa, and the staff is hard to type for people who do not read it |
| Letter names (C D E, C4) | Absolute pitch by name and octave number | Easy to type; the app already has them on every key (`western`) [code] |
| Numbered notation (jianpu) | Digits 1-7, dots for octave, underline halves a duration, dash adds a beat; **movable Do** (the key sets what "1" is) [source: Wikipedia] | Same idea as sargam. Shows that relative degrees are a normal, proven way to write a melody |
| Sargam (Sa Re Ga Ma Pa Dha Ni) | Seven shuddha swaras; Re, Ga, Dha, Ni can be komal, Ma tivra; 12 semitones above Sa; a dot above or below marks the octave (Bhatkhande); Sa can be set to any pitch [source: Wikipedia Swara, swarganga] | Our native system. A skeleton: durations are approximate [source: swarganga] |
| Keyboard diagram | A picture of keys with the pressed ones lit | No reading skill needed; the app draws keys already [code] |
| Falling notes (Synthesia) | Bars fall onto a keyboard; MIDI files, MusicXML since 10.8; paid, $39 [source: synthesiagame.com] | Great feel, needs timing data (section 3) |
| Piano apps | Flowkey: sheet music, video of hands, "wait for the right note"; Simply Piano: gamified [source: review sites, weak] | Shows the usual mix: notes plus keyboard plus video |
| Tablature | Standard for guitar; I found no common one for piano [assumption] | Skip |
| Lead sheet (chord symbols over words) | What the app already does for guitar and harmonium | The left hand of a piano arrangement can reuse it |

Community practice: TheoryTab (Hooktheory) holds community transcriptions of "Baba Nam Kevalam" in relative scale degrees, with titles
that are digit strings, and any registered user can revise a page [source: hooktheory.com]. So Kiirtan melodies are already shared as
scale degrees. Hooktheory shows no reuse licence on those pages, so it is not a data source. I found **no piano-specific Kiirtan
tutorial** [source: searches]; there is a Udemy course for harmonium/keyboard (content not checked) and a guitar booklet with notation
and chords by Jyoshna La Trobe [source]. The usual simple way to play a Kiirtan on a keyboard (a chord with the left hand, the melody
with the right, a short cycle repeated, faster each round) is common knowledge but **I have no source for it** [assumption].

### Formats and libraries

| Format | Facts | For us |
|---|---|---|
| MusicXML 4.0 | W3C Community Group Final Report under the Final Specification Agreement; not a W3C Standard [source: w3.org] | Best exchange format from MuseScore and others. Import later |
| MIDI (SMF) | Official spec sold by midi.org; community spec by Kaitai under CC0 [source] | Good for timing and sound. Export later |
| ABC notation | Plain ASCII text, standard 2.1 (2011), media type `text/vnd.abc` [source: Wikipedia] | Easiest text form of a staff. Can be generated from our data |
| LilyPond | Free software (GPL), text in, printed sheet out [source: lilypond.org] | A tool for authors, not for embedding |
| MEI | Licence ECL 2.0 [source: music-encoding.org] | Academic; skip |
| Our own JSON | Extension of `HarmoniumNotation` [code] | Source of truth; everything else is exported from it |

| Library | Version, licence | Size [source: npm registry and bundlephobia API, 2026-11-08] | Notes |
|---|---|---|---|
| VexFlow | 5.0.0, MIT | 1.12 MB minified, 693 KB gzip | Draws a staff to SVG or canvas; usable in React Native through react-native-svg [source: abcjs FAQ] |
| OpenSheetMusicDisplay | 2.3.0, BSD-3-Clause | 1.44 MB, 372 KB gzip | Renders MusicXML on top of VexFlow; a WebView wrapper exists [source: search] |
| abcjs | 6.7.2, MIT, no dependencies | 510 KB, 148 KB gzip | Renders ABC; **needs a DOM**, so in React Native it runs in a WebView [source: docs.abcjs.net FAQ] |
| alphaTab | 1.9.0, MPL-2.0 | 14 MB unpacked | Aimed at guitar tab; not needed |
| Verovio | 6.4.1, LGPL-3.0-only | 28 MB unpacked | LGPL inside an app-store binary is a compliance task [assumption]; skip |
| react-native-svg | 15.16.1 latest, MIT | already installed (15.12.1) | Enough to draw a keyboard and a sargam strip |
| Salamander Grand Piano samples | CC BY 3.0, Alexander Holm | not measured | Needs a visible credit; a small subset (a few MB) would be cut [source: github.com/sfzinstruments/SalamanderGrandPiano] |

Optical recognition of a photo of printed notes: Audiveris is AGPL-3.0, supports printed (not handwritten) scores, and its authors say
accuracy "is still far from perfection" [source: Audiveris handbook]. A server-side AGPL tool brings source-offer duties [assumption].
Not recommended.

### Prabhat Samgiita notation and rights

* Sarkarverse hosts scans of the earliest sargam booklets; files for songs 1001 and up are entirely in Bangla script; no sargam is
  available there for songs 4001-5018; **the copyright remains with Ananda Marga Pracaraka Samgha** [source: sarkarverse.org portal].
* prabhatasamgiita.net has an archive of notation PDFs, titles in Bengali [source: the page; I read only the first part, songs 1-182].
* The app already links learners only to prabhatasamgiita.net, never to Sarkarverse [code] `apps/api/app/services/notation_links.py`.
* I found no statement that allows copying these notations into a new data format. **Open question for Dada**, section 8.
  Until it is answered, PS piano sheets are limited to the 3 songs already captured and to melodies that members work out themselves.

## 3. What a piano sheet can contain (building blocks)

All four options below are built from these parts. Positions are written relative to Sa so that one sheet works in any key.

* **Key**: where Sa sits, answering the same question as the chords editor, "Which key do you play in?" [code] board `аккорды-v2`.
  A beginner shortcut: "Easy keys (Sa = C, white keys only)" [assumption: easier for beginners].
* **Melody (right hand)**: a row of steps. A step is a swara (12 chromatic degrees), an octave (lower, middle, upper), a length in
  beats, optionally the syllable. Same shape as `NotationNote` [code].
* **Accompaniment (left hand)**: a chord per bar or beat, optionally a pattern (block, broken, root and fifth). Chord names reuse the
  chord vocabulary and the transposer of recording chords [code] `lib/recordingChords/transpose.ts`.
* **Cycle**: for a Kiirtan, a short part and how many times it repeats ("x4"), then a faster part. This must match the Kiirtan chord
  proposal (parts with repeats), so that chords and notes use the same parts [code] board `киртан-аккорды-и-видео`, variant a.
* **Levels**: "One finger" (melody only) and "Two hands" (melody and chords).
* **Timing (optional, later)**: marks tying steps to seconds of the recording. A Kiirtan speeds up, so one fixed grid does not fit
  [assumption]; marks per part would be needed. The recording has no chord or note timing today [code] `recChords.noTiming`.
* **Attachment (optional)**: a link to a PDF, MusicXML or MIDI file.
* **Credit and status**: author, anonymous or not, pending / published / rejected, versions, "based on", like chord sheets [code].

## 4. Four options

### A. Keyboard and swaras (recommended base)

* **Stores:** a structured sheet: key, melody steps, chords, cycle parts, level. Our own JSON.
* **Enter:** tap keys on the on-screen keyboard (existing capture mode), or type a line ("Sa Re Ga | Pa - -"; letters like "C D E" are
  added to the parser). Import later.
* **Shown:** a keyboard window with the current step lit (right hand orange, left hand green), a strip of swaras above, a Sa chip,
  "One finger / Two hands", play and step buttons. Over the recording: static, scrollable.
* **Who adds / checks:** any signed-in member; the team reviews, like chords. The recording's author may be fast-tracked (question).
* **Size:** medium. First usable step 8-12 days, the full option 18-25 days (+/-50%).
* **For:** matches the tradition (movable Sa); the keyboard and parser exist; transposition is free; searchable; exports to ABC, MIDI
  and MusicXML are possible later; works offline.
* **Against:** nobody outside the app can reuse the sheet until an export exists; not a staff; the sound is harmonium until piano
  samples are added.
* **Risks:** note rights for PS; typed rhythm is rough for people who play by ear; a piano sound needs a CC BY credit.

### B. Staff notation (MusicXML / ABC)

* **Stores:** a MusicXML or ABC text, plus key and title.
* **Enter:** upload a MusicXML file from MuseScore or similar, or write ABC. Typing on screen is not realistic.
* **Shown:** a rendered staff (abcjs or OpenSheetMusicDisplay inside a WebView; the web preview needs an iframe), scrolling; a key
  signature instead of a Sa chip.
* **Size:** large, 15-25 days. **Libraries:** abcjs MIT 148 KB gzip or OSMD BSD-3 372 KB gzip (section 2).
* **For:** a standard other musicians understand; imports from professional tools.
* **Against:** the audience reads sargam, not staff [assumption]; heavy; no easy authoring; transposition means re-rendering;
  WebView and web-preview special cases.
* **Risks:** few people can supply files; rights of uploaded scores.

### C. File or link only

* **Stores:** a link or file (PDF, image, MusicXML, MIDI), title, credit.
* **Enter:** paste a link or pick a file; no editor.
* **Shown:** a card "Notes (PDF) by name" that opens the file.
* **Size:** small, 3-5 days (8-10 if the app hosts the files: storage, scanning).
* **For:** fastest; for people who already have notes.
* **Against:** not searchable, not transposable, no keyboard help, no "how to play"; moderation of files and rights is heavier.
* **Risks:** copyrighted PDFs; dead links.

### D. Falling keys, played with the recording

* **Stores:** option A plus timing marks tied to seconds.
* **Enter:** tap-along while the recording plays ("mark the part now") [assumption].
* **Shown:** bars fall onto a keyboard in time with the recording.
* **Size:** large, +12-20 days on top of A.
* **For:** the most attractive; close to what Synthesia does [source].
* **Against:** needs A first; Kiirtan tempo changes; precision of the audio position with the screen off is unverified.
* **Risks:** authoring effort is high; few sheets will have timing.

### Recommendation

Build **A** in steps and keep **C** as a small side door; **B** and **D** stay possible later because A is exportable:

1. Step 0 (2-3 days): a "Play on piano" view of the PS sargam that already exists (3 songs), letter names on keys.
2. Step 1 (8-12 days): Kiirtan piano sheets (A) with team review, the "For piano" shelf, the wizard question.
3. Step 2 (6-10 days): versions, "start from this sheet", levels, piano sound with credit, link or file attachment (C).
4. Step 3 (10-20 days, only if wanted): ABC / MusicXML / MIDI export, staff view, timing marks and falling keys (D).

## 5. Section "Kiirtans for piano"

* **Two doors.** (1) The recording has at least one **published piano sheet** (derived, nobody ticks a box). (2) The uploader says
  piano was played (an `instrument` tag, from wizard page 5). They mean different things: door 1 is "you can play it", door 2 is
  "it was played on piano". Recommended: the shelf **"Kiirtans for piano"** uses door 1; "Played on piano" is a second, later shelf.
* **Facets.** Both doors become tags (`notes: piano`, `instrument: piano`) in `toMenuRecording`; the existing facet rule applies, so the
  shelf appears at 3 recordings, leaves under 2 after 7 days, and a team pin can show it earlier but never empty [code].
* **Where.** A shelf on the Kiirtan tab and in the search menu; a chip "Piano" among the Kiirtan tab filters; "See all" lists the same
  filter that made the count [code] `docs/search-menu.md` section 10.1.
* **Recording page.** A "Piano" block next to "Chords" and "Videos": counts, level, Sa, "Open", "Add notes".
* **Empty state.** If someone opens the filter with nothing in it: a calm sentence and a button "Add notes to a recording". No empty
  shelf is ever drawn.

## 6. Upload wizard

* Page 5 (instruments): add a chip "Piano" (sets door 2). Needs the `instruments` field (small-medium, shared with the wizard work).
* Page 7 (chords, currently a stub): becomes "Chords and notes", still one page. Questions: chords (add now / later / I do not know)
  and under it "Notes for piano" (add now / later). "Add now" opens the editor and returns to the wizard.
* No tenth page. The stub is another agent's work; this only reserves the space [code] board `мастер-загрузки-киртана`.

## 7. Plan, migrations, API, dependencies (outline, no code)

| Step | Scope | Days (+/-50%) |
|---|---|---|
| 0 | Piano view of existing PS sargam: key-name toggle, "Which key do you play in?", no new data | 2-3 |
| 1 | Tables, API, editor (tap and typed line), viewer, team review, shelf and filter, wizard question, en/ru/es words, tests | 8-12 |
| 2 | Versions, "start from this sheet", levels, piano sound, attachment link or file | 6-10 |
| 3 | Exports (ABC, MIDI, MusicXML), staff view, timing and falling keys | 10-20 |

* **Migration (one, new, not touching existing rows):** a table `piano_sheets` for either a recording or a PS song (exactly one of the
  two filled), with: key, level flags, melody and chords as JSON, cycle parts, optional attachment link, status, reviewer, versions
  (`replaces_id`), `based_on_id`, credit, anonymous flag, rights confirmation. Written the way 0047 was: safe to run twice, works on
  PostgreSQL and SQLite. Chord sheets were not changed at first (their database CHECK allowed only guitar and harmonium); migration 0063 later added `piano` as a third chord instrument (docs/chord-instruments.md).
* **API (shape):** list sheets of a recording or song; create; new version of my own; delete my own; team: list waiting, accept,
  reject with a reason; the recordings list says whether a recording has a published sheet (feeds the tag). Same limits and
  notifications as chords.
* **App:** a viewer and an editor reusing the keyboard, the parser and the chord vocabulary; a block on the recording page; a tag in
  the search menu; locales en, ru, es.
* **Dependencies:** steps 0-2 need **none** (react-native-svg is installed). Step 3 adds abcjs (MIT) or OSMD (BSD-3) inside a WebView.
  A piano sound adds CC BY 3.0 samples and a credit line.
* **Tests:** unit tests for the parser and the transposition, API tests like `test_recording_chord_charts.py`, a migration test.

## 8. Questions for Dada

1. Which option: A, B, C, D, or A with C beside it (recommended)?
2. Who may add notes to a recording: anyone signed in (team reviews), or only the recording's author and the team?
3. May the recording's author publish their own notes without review?
4. For PS songs: may members add piano notes, or only the team? May we use the Sarkarverse and prabhatasamgiita.net notations as a
   starting point? (The copyright is with Ananda Marga Pracaraka Samgha; someone must ask them.)
5. Does "Kiirtans for piano" mean "has notes" (recommended), "played on piano", or both as two shelves?
6. Should the team pin the shelf until there are 3 recordings, or wait for the usual rule?
7. Is the easy-key shortcut (Sa = C, white keys only) wanted by default?
8. Should the wizard get a "Piano" chip on page 5 and a notes question on page 7?
9. Is a harmonium sound enough at first, or should a piano sound (CC BY 3.0, credit line) come in step 1?
10. Is the staff view needed at all, or is sargam enough for the audience?

## 9. Sources (accessed 2026-11-08)

* Sarkarverse, Portal Prabhat Samgiita: https://sarkarverse.org/wiki/Portal:Prabhat_Samgiita
* prabhatasamgiita.net, notations archive: https://prabhatasamgiita.net/notations/andromeda.php
* Synthesia: https://synthesiagame.com/
* Numbered musical notation (Wikipedia): https://en.wikipedia.org/wiki/Numbered_musical_notation
* Swara (Wikipedia): https://en.wikipedia.org/wiki/Swara
* Hindustani notation versus staff: https://www.swarganga.org/articles/icmconcepts/icm17 and https://raganet.com/Issues/1/nisargam.html
* MusicXML 4.0: https://www.w3.org/2021/06/musicxml40 and https://w3c.github.io/musicxml
* ABC notation: https://en.wikipedia.org/wiki/ABC_notation
* LilyPond: https://lilypond.org/introduction.html
* MEI: https://music-encoding.org/about
* MIDI files: https://midi.org/about-midi-part-4midi-files and https://formats.kaitai.io/standard_midi_file
* abcjs: https://docs.abcjs.net/overview/faq and https://abcjs.net
* VexFlow: https://vexflow.com/ and https://www.npmjs.com/package/vexflow
* OpenSheetMusicDisplay: https://opensheetmusicdisplay.org
* npm registry and bundlephobia API (versions, licences, sizes): https://registry.npmjs.org/ and https://bundlephobia.com/
* Audiveris handbook: https://audiveris.github.io/audiveris/_pages/handbook
* Salamander Grand Piano: https://github.com/sfzinstruments/SalamanderGrandPiano
* TheoryTab, Baba Nam Kevalam page: https://hooktheory.com/theorytab/view/didi-jayagiita/baba-nam-kevalam-kiirtan
* Kiirtan guitar booklet: https://jyoshnamusic.com/?p=248
* Piano apps overview (reviews, weak source): https://roli.com/blog/what-is-the-best-piano-learning-app

## 10. Not checked

Nothing was run on a phone. Bundle sizes are the registry's and bundlephobia's numbers, not measured in our build. I read only the first
part of the prabhatasamgiita.net list. I did not check the Udemy course or the guitar booklet. Piano-app features come from review
sites. That a Kiirtan speeds up, so a fixed grid does not fit, is the chord board's own assumption and mine, not a study. Whether
AMPS allows its notation to be reused is unknown.
