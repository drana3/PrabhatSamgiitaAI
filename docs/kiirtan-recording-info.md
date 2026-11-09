# How a recording was made and how it sounds

Fields of an uploaded recording: **type of recording**, **tempo**, **solo or group**, **main instrument**. They sit next to the style and the Avarta mark
(`docs/kiirtan-practice.md`) and feed the search menu (`docs/search-menu.md`, section 11). Code: API
`apps/api/app/services/recording_info.py`, phone `apps/mobile/lib/kirtan/recordingInfo.ts`; the two lists are pinned by
`tests/test_recording_info.py` and `__tests__/recordingInfo.test.ts`. The database stores the ids as text, so a new value is one id
on both sides plus a label in en, ru, es: no migration.

## Changes of 9 Nov 2026 (these win over the older lines below)

* **A Kiirtan is only Baba Nam Kevalam.** Guru Puja, Pitr Yajina and every other mantra of Ananda Marga is a kind of its own,
  `other_mantra`, **shown as "Others"** (it was "Other mantras"; see `docs/others-category.md`), with its own upload page `/add-mantra`
  (`apps/mobile/app/add-mantra.tsx`, the one form of `app/add-kirtan.tsx` with the Others header and a REQUIRED choice of what it is,
  no default), its own tab on the Kiirtan page, its own radio category and its own types `guru_puja`, `pitriyajina`, `samgacchadhvam`,
  `nityam_shuddham`, `ananda_sutram`, `shlokas`, `other` ("Something else", with a name the team checks). The kind is a text column
  with a check constraint; migrations `0064_mantras_styles_moods` and `0067_others_choice` widen it. Moderation, reports, removal notices and the player treat it like every other kind.
* **Type of recording: exactly three**, `studio`, `live` (concert), `ai` (AI-generated). The removed `home` is rewritten to `studio` by
  the migration; an old phone that still sends `home` is read as `studio`. Solo or group (`performance`) is its own required field
  for a Kiirtan and is never part of the type.
* **Tempo is for Dance music only** (Slow, Medium, Fast, Mix). A Kiirtan row stored with a tempo keeps it in the database; the API and
  the phone no longer show or accept it.
* **Style and mood are lists.** `styles` / `moods` hold ids from a short list, `styles_other` / `moods_other` the person's own words
  (at most 5 tags in all, 2 own words per field). Styles: Indian style, Electronic, Acoustic guitar, African, Western. Moods: Joyful,
  Meditative, Longing, Energetic, Mix. The old styles (Bengali, Hindi, Brajabuli, Dhrupad, Folk) are not offered, but a row that
  carries one reads as before. A Kiirtan needs at least one style. Old rows with a single `style` read as a list of one; new rows
  also mirror the first style into `style` / `style_other` for older phones. Code: `services/recording_tags.py`,
  `services/recording_styles.py`, phone `lib/kirtan/tags.ts`, `lib/kirtan/styles.ts`, `lib/kirtan/moods.ts`.
* **Own words are not public until the team accepts them** (same rule as `lead_instrument_other`): the writer sees their word at
  once, a stranger sees it only after the matching suggestion (`value_suggestions`, field `style` or `mood`) is accepted. One shared
  resolution path for every moderation route.
* **Lead instrument**: ONE choice, shown as one row (the chosen value and a Choose / Change button, no chips). The button opens the white sheet with a search box and a scrollable list of all sixteen instruments (guitar, harmonium, piano, synthesizer and keyboard marked electronic, tabla, dholak, khol, kartal, flute, violin, sitar, esraj, bass guitar, ukulele, voice only), and "Add your own" inside the sheet (own words wait for the team, as before).
* **Place** where it was recorded or performed: optional, in "More details", for every kind.
* **Compact picker** (`components/kirtan/add/TagPicker.tsx`): Style, Mood and Main instrument show as one line of chosen chips and a
  "+"; a tap opens a bottom sheet with a scrollable list and a search box. The search box doubles as "add your own", so no text input
  ever sits next to chips (layout rule in `docs/layout-rules.md`).
* "Kiirtan" with two i's: any "kirtan" typed in a title, performer, place or credits is corrected as typed and again on publish
  (`lib/kirtan/kiirtanSpelling.ts`; the word inside "Sankirtan" is left alone).

## Where the words come from

The team already sorts the library by hand on anandamarga.org/music ("Sorting the music"; the words are in the website repository,
`apps/web/src/lib/razbor/vocab.ts`). The app uses the same ids where it has the same field.

| anandamarga.org | This app | Notes |
|---|---|---|
| tempo: slow, medium, fast | `tempo`: `slow`, `medium`, `fast` | same |
| performance: solo, group or choir | `performance`: `solo`, `group` | same |
| recording: studio, phone or voice recorder, live (concert, group kiirtan), AI-generated | `recording_type`: `studio`, `home`, `live`, `ai` | "phone or voice recorder" is called `home`: how a person says it. "Live at a programme" |
| style: traditional Indian, western pop-rock, electronic, acoustic guitar, ethnic | the app's own Kiirtan `style` (Bengali, Hindi, folk ...) | **differs**: the app's list is about the origin of the Kiirtan and was already in use; the website's list is about the arrangement. Not merged |
| mood: joyful, meditative, longing, energetic | `moods` (confirmed tags, already in the app) | not asked at upload |
| genre, dance | genre: not taken. Dance: `dance` of Dance music | unchanged |

Where the website requires several fields for a Kiirtan (mood, style, performance), the app requires **style, type of recording and
solo or group** (Dada, 8 Nov 2026). Tempo and the main instrument stay optional. A person uploading from a phone is not asked to judge
the mood; the team and the listeners' votes do that.

## Rules

* `recording_type`: REQUIRED for a Kiirtan. Optional for Dance music, a Bhajan and a Spiritual song. Not carried by Prabhat Samgiita
  and Baba's Audio Discourses. `ai` is accepted for a Bhajan too (Dada, 8 Nov 2026, the earlier ban is withdrawn); like every AI
  recording it is never hidden (below).
* `performance` (solo or group): REQUIRED for a Kiirtan, optional for a Bhajan. This includes every track of a playlist and every row
  of a queue; the import script must give it too. `tempo`: optional, Kiirtan and Dance music.
* Main (lead) instrument, `lead_instrument`: optional, for every kind of music (not Baba's Audio Discourses). See below.
* A field the kind does not carry is dropped silently (like the style). A word not in the list is a 422 "Choose ... from the list".
* The title of a **Kiirtan** is written in English, with Latin letters (accents like "Bábá" are fine). The phone marks a non-Latin
  title and does not send; the API answers 422 "Write the title of a Kiirtan in English, with Latin letters." The other kinds keep
  any alphabet. Only when the kind is said: a request that does not name a kind is not blocked by this rule.

## "I am the author of the recording"

The tick belongs to the performer block ("Performer or author"), not to the end of the form. Its hint reads: "If you composed this
melody or song yourself, tick this box. The recording will then appear on your author page." It is not shown for Prabhat
Samgiita (one author, Shrii Shrii Anandamurti). Code: `components/kirtan/add/AuthorTick.tsx`.

## Main instrument and "Add your own"

One value: the instrument that carries the music. The list is `INSTRUMENTS` (API `services/recording_instruments.py`, phone
`lib/kirtan/instruments.ts`, pinned together by `tests/test_value_suggestions.py` and `__tests__/kirtanInstruments.test.ts`):
guitar, harmonium, piano, synthesizer, keyboard, tabla, dholak, khol (mridanga), kartal, flute, violin, sitar, esraj, bass guitar,
ukulele, voice only. The synthesizer and the keyboard are marked "electronic". To add one: its id on both sides and an
`instrument.<id>` label in en, ru, es; no migration.

"Add your own" (instrument, and also the style's "Other") goes to a **suggestion queue** (`services/value_suggestions.py`, table
`value_suggestions`, migration 0054, team endpoints in `api/v1/value_suggestions.py`):

* The author sees the word at once. The word is cleaned (2 to 40 characters, one line) and normalized (case, accents, punctuation,
  spaces do not matter, so "Harmonium", " harmonium." and "HARMONIUM" are one word).
* A word that already is a listed one ("Piano", "Mridangam", "bass guitar") becomes its code and never enters the queue.
* A word at least 85 percent like a listed one ("harmonyum") is offered the listed one before it is sent ("Did you mean ..."); if
  the person keeps it, it still goes to the queue with that hint for the team.
* One person may bring **3 new words a week** (words already in the queue are free; the team is exempt). The fourth is a 429.
* The team **accepts** (the word stays, shown to everyone and offered as a pick), **merges** it into a listed value (the recordings
  take the listed value) or **rejects** it (the recordings lose the word, the author gets a notice, the word is refused next time).
* The search menu builds "Kiirtans for piano" from `lead_instrument` (`docs/search-menu.md`, section 11).

### "Add a language" (9 Nov 2026)

The language sheet (Bhajan, Baba audio, and every sheet that uses the language picker) has an "Add a language" row for a language
that is not in the list. It uses the **same queue**, field `language` (migration 0060 widens the check constraint of
`value_suggestions`; no second queue). The person writes the name (2 to 80 characters), the same normalization applies, and a name
that is a listed language ("Russian", "русский") becomes its code. A name at least 85 percent like a listed language ("Bengalli")
is offered "Did you mean Bengali?" (`similarLanguage` in `lib/kirtan/languages.ts`, one rule `similarWord` for instrument, style and
language). The same weekly limit (3 new words a week, the team exempt) and the same team decision (accept, merge into a listed
language, reject) apply. The recording keeps `language = "other"` and `language_other = <the name>`; a merge writes the listed code
into the recordings, a reject clears the word. The old-recording road, `PATCH /recordings/{id}/language`, goes through the same code as an upload (`_resolve_words` in
`services/recordings.py`): a rejected word is a 422, a merged word becomes its code, a new word counts against the weekly three and
joins the queue with its use. Nothing writes a language word without the queue. Not built: an accepted language word is not yet offered as a pick for others.
The box for the written name is the shared `OwnWord` component (spacing rule: `docs/layout-rules.md`, "An input beside a group of tags").

## AI recordings are never hidden

`ai` is stored, returned by the API as `recording_type: "ai"`, drawn on the recording page as a tag "Made by AI" **and** a plain sentence
under it (`recinfo.type.aiBanner`), and offered as its own search shelf ("Made by AI"). The form tells the person before sending that
listeners will be told. There is no setting to hide it.

## Display and search

* Recording page: `components/kirtan/RecordingInfoTags.tsx` (type, tempo, solo or group, in that order; nothing for an older recording).
* Search: `menuTags()` in `lib/searchMenu/live.ts` maps the fields into `tags` (`recorded`, `tempo`, `performance`). A shelf appears by
  the usual rule (3 recordings). Shelf titles are translated words.

## Old phones

An older app that does not send `recording_type` gets a 422 for a new Kiirtan upload ("Say how this Kiirtan was recorded."). The
change goes out together with the new app version.

## Switching the type on the upload form

Changing the type (Kiirtan to Bhajan, ...) keeps the picked files and clears everything that belonged to the old type: the style, the
Avarta mark, the type of recording, tempo, solo or group, the main instrument, and what individual rows said about them. Opening the Add screen shows a
queue only if it holds work (something going up, waiting for an answer, failed, done); files that were picked on an earlier visit and
never sent are dropped. Code: `draftWithPatch`, `withoutKindBoundChoices`, `isLeftoverDraft`, `openFresh`.
