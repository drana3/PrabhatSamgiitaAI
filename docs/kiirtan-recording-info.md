# How a recording was made and how it sounds

Fields of an uploaded recording: **type of recording**, **tempo**, **solo or group**. They sit next to the style and the Avarta mark
(`docs/kiirtan-practice.md`) and feed the search menu (`docs/search-menu.md`, section 11). Code: API
`apps/api/app/services/recording_info.py`, phone `apps/mobile/lib/kirtan/recordingInfo.ts`; the two lists are pinned by
`tests/test_recording_info.py` and `__tests__/recordingInfo.test.ts`. The database stores the ids as text, so a new value is one id
on both sides plus a label in en, ru, es: no migration.

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

Where the website requires several fields for a Kiirtan (mood, style, performance), the app requires **style and type of recording**
only. A person uploading from a phone is not asked to judge the mood; the team and the listeners' votes do that.

## Rules

* `recording_type`: REQUIRED for a Kiirtan. Optional for Dance music, a Bhajan and a Spiritual song. Not carried by Prabhat Samgiita
  and Baba's Audio Discourses. `ai` is **not accepted for a Bhajan** (a song to God, which the team does not take from an AI tool):
  the API answers 422, it is not dropped quietly.
* `tempo`: optional, Kiirtan and Dance music. `performance`: optional, Kiirtan and Bhajan.
* A field the kind does not carry is dropped silently (like the style). A word not in the list is a 422 "Choose ... from the list".
* The title of a **Kiirtan** is written in English, with Latin letters (accents like "Bábá" are fine). The phone marks a non-Latin
  title and does not send; the API answers 422 "Write the title of a Kiirtan in English, with Latin letters." The other kinds keep
  any alphabet. Only when the kind is said: a request that does not name a kind is not blocked by this rule.

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
Avarta mark, the type of recording, tempo, solo or group, and what individual rows said about them. Opening the Add screen shows a
queue only if it holds work (something going up, waiting for an answer, failed, done); files that were picked on an earlier visit and
never sent are dropped. Code: `draftWithPatch`, `withoutKindBoundChoices`, `isLeftoverDraft`, `openFresh`.
