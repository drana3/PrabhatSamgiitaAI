# Learn system: songs to learn, one active song, daily plan, review all

Status: design proposal, 2026-11-05. Branch `redesign/v2`, app `apps/mobile`. No code was changed for this document.
Audience: Dada (decisions) and whoever builds it (phases in section 9).

The goal in one sentence: a person opens Learn and never has to hunt for "which song am I learning, what am I repeating". The first screen says it, and one button does it.

---

## 0. How to read this, and what is verified

Claims about other products carry one of these marks:

- **[V]** verified: I read the page in this session (URL given).
- **[S]** seen only in search results or a snippet; the primary page blocked me (HTTP 403) or did not carry the detail.
- **[M]** from memory; treat as unverified until someone checks.

Claims about the app's code are verified by reading the files listed in 1.1.

---

## 1. What exists today

### 1.1 Files read

`app/learn.tsx`, `components/learn-v2/*`, `lib/learn/{srs,hub,progress,songPath,library,quiz,words,streak,routes}.ts`, `stores/learnStore.ts`, `app/learn/{words,songs,quiz,ragas}.tsx`, `app/learn/song/[songId].tsx`, `app/harmonium-v2.tsx`, `app/harmonium-v2/chords.tsx`, `lib/songPage/{spChords,chordChart,songContent,settings}.ts`, `stores/songPageStore.ts`, `lib/playerV2/lyricsSync.ts`, `lib/fixtures/learn.ts`, `docs/notifications.md`.

### 1.2 The Learn tab today, tool by tool

The hub (`app/learn.tsx`) is a scroll of five sections: Continue card, "Learn a song" shelf, "Practice today", "Play along", "Explore more".

| Tool | What it does now | What is missing |
|---|---|---|
| **Continue card** | Shows the song with the most steps done (`pickContinue`: closest to finished, then latest started). The button opens its next undone step. | The learner cannot choose it. There is no "active" flag. Two songs at 1 of 3: the app picks, not the person. |
| **Song shelf** | Songs in progress, then not started, then 7 hard-coded suggestions (`LEARN_SUGGESTED_NUMBERS`, PS 1 to 7). "See all" opens My songs. | No picker over the real catalog. `startLearning` runs when a song path page opens (effect on mount in `app/learn/song/[songId].tsx`), so merely looking at a song puts it on your list. |
| **Song path (3 steps)** | 1 Hear and sing (player at 0.75 speed, lyrics light up), 2 Learn the words (the song's word cards), 3 Play it (turns song-page chords on). | Step 1 and step 3 are marked done the moment the button is tapped (`mark("listen")`, `mark("chords")`), before anything is heard or played. Only step 2 has a real rule (`songWordsComplete`: every word graded once). |
| **Word cards** | Anki-like. Three review styles (steps, adaptive, daily), four grades, a learning queue inside the session, the next interval shown under each button. The deck for `?song=n` is that song; with no song it is `sessionDeck(...)`, **capped at 10 words**, built from learning songs plus saved songs. | No daily new-card setting (10 is a default argument and a hard cap). No review cap. No leech handling. No "review all learned songs" session. Card history keeps the last 30 grades. |
| **Song-level memory** | The library row shows "memory strength" and "Next review in 6 days". | Fixture only: `buildLibraryRows(..., mockup)` reads `strength` and `next` from `LIBRARY_DEMO`. In real mode a learned song is "due" only if one of its word cards is due. A song has no schedule of its own. |
| **Quiz** | 3 levels (Know the words, Know the meaning, Know the story), 10 questions, pass 7, level 2 opens after passing level 1. Level 1 builds 4-option "What does X mean?" from the word deck. | Levels 2 and 3 have no question bank. Results never touch word cards. One question type only. |
| **Streak** | `learningStreak`: days with at least one word review, derived from card histories. | Song practice and quizzes do not count. |
| **Harmonium** (`/harmonium-v2`) | "Sa is" key stepper, a keyboard with swara and note on every key, two hard-coded practice songs. | A reference, not a practice tool. No sound in the preview. Not linked to the active song. |
| **Chords** (`/harmonium-v2/chords`) | "How chords work": three explainer cards, then "Try it" (pick a chord, see its three keys lit, first lines of a sample song with letters over words). **Harmonium only.** The hub tile has a guitar icon. | A guitarist taps a guitar icon and gets a harmonium lesson. |
| **Song-page chords** (`/song-v2/ps-n?section=chords`) | The real play-along surface. Instrument switch (guitar, harmonium), capo with "easiest capo" (`spBestCapo`), shapes or sounding names, 24 fret shapes with diagrams (`SP_FRETS`, `diagramPaths`), harmonium key (Sa) transposition, letters above words (`wordColumns`). | **No chart data.** `songContent.ts`: "Today none of it exists in the catalog, so every provider returns null". A chart shows only when `reviewed: true` (spec API-07/API-14: chords are never generated at read time). So today almost no song shows chords. |
| **Lyrics sync** | Player karaoke lights lines and words. | Timing is **interpolated from line length** (`lib/playerV2/lyricsSync.ts`: "the catalog has no line or word timestamps yet (API-11)"). Fine for reading along; weak for looping a line or a wait mode. |
| **Raga and Tala index** | Browse list with song counts (fixtures). | I found no song-to-raga/tala field in app code. Raga questions depend on that data; unverified. |
| **Certificates** | Live-quiz certificates (`/quiz`). | Separate system; leave alone. |
| **Notifications** | `words` reminder 18:00 only when words are due; `streak` off by default (`docs/notifications.md`). | Should point at the daily plan, not only words. |

### 1.3 The data today (`stores/learnStore.ts`, key `prabhat-learn`, version 1)

```
reviewStyle: "steps" | "adaptive" | "daily"      one global style
cards:  Record<wordId, WordCard>                 status, dueAt, intervalDays, ease, step, reps, lapses, history[30]
songs:  LearningSong[]                           {songId, number, title, startedAt}
paths:  Record<songId, {listen, words, meaning, chords}>
quizBest: best result per level
```

Gaps against Dada's request: no active song, no song status except what is derived from `paths`, no per-song schedule, no review log, no settings, nothing synced (the file comment says the shape "follows API-13 so it can sync later").

### 1.4 What "Play along, Harmonium and Chords" means (plain answer)

The hub section **Play along** answers one question: "I know the song a little. How do I play it on my instrument?" It holds three different things that are mixed up today:

1. **A reference keyboard** (Harmonium tile): where is Sa, what is each swara in my key.
2. **A lesson** (Chords tile): how a chord is built, so the letters over the words make sense.
3. **The actual play-along** (on the song page and in step 3 of the path): lyrics with chord letters over the words, in my key, at a speed I can follow.

Item 3 is what a learner needs every day, and it has no door on the hub. The redesign makes it the centre: the **Play screen** of a song (5.1), opened from the Active card, the Today plan and the song page. Harmonium and Chords become two supporting tools. Both serve **both instruments**: Chords gets a Guitar | Harmonium switch, plus a "Chords in my songs" list that connects the lesson to the learner's own songs.

---

## 2. Research: how learning apps do it

### 2.1 Anki (Anki manual, docs.ankiweb.net)

Verified [V] unless marked.

- **Daily flow.** Open a deck, press Study Now; the overview shows New, Learning, To Review. Four buttons: Again, Hard, Good, Easy. Good should be the most common (roughly 80 to 95 percent), Again roughly 5 to 20 percent. Each button shows when the card returns. Intervals get small random "fuzz" so cards do not bunch on one day. https://docs.ankiweb.net/studying.html
- **Queues.** Cards are gathered: intraday learning, interday learning, review, then new. Learning cards are time-sensitive. Overdue cards are prioritised by how long they waited, and the delay is used when computing the next interval. https://docs.ankiweb.net/deck-options.html
- **Daily limits.** *New cards/day* and *Maximum reviews/day*. Unused allowance does not carry over: skip a day and the next day returns to the setting. Interday learning cards count toward the review limit. By default the review limit also applies to new cards, so no new cards appear once the review limit is reached; the manual advises against adding new cards while you have an overdue backlog. Limits can be per preset, per deck, or "today only". The default numbers (20 new, 200 reviews) are **[M]**; the page did not print them.
- **Learning steps and graduating.** A new card walks through learning steps (manual example: 1m 10m 1d). Good advances, Again returns to step one. After the last step the card graduates with the *graduating interval*; Easy on a learning card uses the *easy interval*. Relearning steps do the same for a failed review card. Defaults (1m 10m; graduating 1 day; easy 4 days; relearning 10m) are **[M]**.
- **SM-2 constants printed by the manual:** starting ease 2.50, easy bonus 1.30, interval modifier 1.00, hard interval 1.20, new interval after a lapse 0.00 (reset), minimum interval after a lapse 1 day, maximum interval 100 years.
- **How Anki's SM-2 differs from original SuperMemo 2** (https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm): configurable learning steps; failures during learning do not lower ease; four buttons with one fail option instead of six grades; late answers feed the next interval; Easy adds a bonus; ease never falls below 130 percent; each new interval (except after Again) is at least a day longer.
- **Lapses and leeches.** A lapse is failing a card in review mode. At 8 lapses the note is tagged a leech and by default suspended; warnings repeat every 4 lapses. Advice: rework the card (simplify, split, mnemonic), delete it, or wait. https://docs.ankiweb.net/leeches.html
- **Decks.** Studying a parent deck mixes its subdecks; each subdeck's limit caps what it contributes; the selected deck's limit caps the total.
- **Filtered decks and Custom Study.** Custom Study builds a temporary deck. Presets: raise today's new or review limit; review forgotten cards (Again in the last N days); review ahead (cards due within N days, "meant for one-off use ... because reviewing early barely changes scheduling"); preview new cards; study by card state or tag. With *rescheduling on* (default) answers update the schedule; with it off ("preview mode") cards go home exactly as they were. https://docs.ankiweb.net/filtered-decks.html
- **Easy Days** shift due dates away from chosen weekdays after the interval is computed.

**Lessons for ПС:** a hard cap on new cards, a separate review cap, "a backlog stops new cards", a *rescheduling-off* mode for "repeat everything now" (this is exactly request 2), and leech handling for a word that keeps failing.

### 2.2 FSRS (open-spaced-repetition wiki on GitHub; Anki manual)

- Developed by Jarrett Ye at MaiMemo. Three values per card: **Difficulty** D (1 to 10; how fast stability grows), **Stability** S (days for recall probability to fall from 100 to 90 percent), **Retrievability** R (current probability of recall; falls with time since the last review). https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS [V]
- **Desired retention** is the one knob: each interval is chosen so R equals the target when the card is due. 90 percent is Anki's default; the wiki calls about 70 to 97 percent reasonable; higher means more reviews, and workload rises sharply above 90. [V]
- Current version FSRS-6, 21 parameters, power-law forgetting curve R(t,S) = (1 + factor*t/S)^(-w20) with factor = 0.9^(-1/w20) - 1, so R(S,S) = 90 percent. https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm [V]
- **Why it replaced SM-2 as Anki's recommended scheduler:** FSRS arrived in Anki 23.10; the manual says it needs fewer reviews than the default algorithm for the same retention [V]. The wiki says its simulations show about 20 to 30 percent fewer reviews than SM-2 at the same retention and much better handling of cards reviewed after long gaps [V]. That is the project's own claim, not an independent audit. Mechanism: SM-2 keeps one number per card (ease) moved in fixed steps; FSRS predicts the probability of recall from real elapsed time and schedules to a target.
- **Cautions from the Anki manual** [V]: every device must support it; parameters should be optimised on your own history, and the optimiser can suffer "with fewer than a few hundred reviews"; do not press Hard on a forgotten card; keep learning steps under a day. Before optimising, default parameters fitted on a large dataset are used.
- A TypeScript implementation (`ts-fsrs`, same organisation) exists **[M]**; check npm, license and size before using.

### 2.3 Duolingo

- **Daily goal vs streak** (https://blog.duolingo.com/improving-the-streak [V]). The streak used to need the daily goal; learners with the highest goal tier were least likely to have a streak. Now one lesson extends the streak and the goal is shown separately. Reported relative results: day-14 retention +3.3 percent, learners on a streak +10.5 percent in 20 days, new learners on a streak +19 percent; a year later just over half of daily learners had a streak of 7+ days, up from about a third. The post also notes fewer people reached their daily goal. **Lesson:** make the streak cheap, keep the goal as a separate soft target.
- **Spaced repetition** (https://blog.duolingo.com/how-we-learn-how-you-learn [V]). Half-life regression predicts each word's memory half-life; strength meters average word predictions; a skill is due when its meter is half full; practice picks the words least likely to be remembered. Reported A/B results: +9.5 percent daily retention for practice sessions, +1.7 for lessons, +12 percent overall activity. **Lesson:** a skill (for us: a song) has a strength meter built from its parts, and is "due" when the meter is low.
- **Practice Hub** (https://blog.duolingo.com/guide-to-duolingo-practice-hub/ [V]): Mistakes, Words, Speak, Listen, plus Stories/Radio/Adventures. **Lesson:** "Mistakes" is its own review type.
- **Unit tests, hearts, notifications [S]:** checkpoints now "Unit Reviews"; hearts (five, one lost per mistake) reported as being replaced by "energy"; a Duolingo post (via search) says copy about building a habit got 5 percent more opt-ins than copy about keeping a streak. I could not verify hearts from an official page. **Decision:** adopt the checkpoint idea (an optional test after a group of songs); **do not** adopt hearts, which punish mistakes in a devotional learning setting.

### 2.4 Memrise and Quizlet

- **Memrise [S]:** its blog says review prompts come from a spaced repetition system and a correct answer moves an item to a longer interval; the help page with exact intervals returned 403.
- **Quizlet [S, help centre blocked]:** *Learn* is an adaptive path to mastery (reports: each term must be answered correctly twice); *Test* builds a mixed-type practice exam; *Match* is a timed pairing game. Whether Learn uses spaced repetition is unconfirmed. **Lessons:** Learn = guided first pass until each item is right twice (good for a song's words); Test = a mixed check at the end; Match = a 60-second game for a tired day.

### 2.5 Play-along apps

- **Yousician [S]** (support.yousician.com snippets; two pages gave 403). Practice mode has a tempo slider, loops any section with sliders, "Wait To Play" pauses until you play the correct note (toggle), and auto-adjust speed which for singing runs 25 to 125 percent in 5 percent steps. The text does not explain how detection works.
- **Simply Guitar "Play"** [V] (https://piano-help.hellosimply.com/en/articles/14588852-what-is-play-in-simply-guitar): strum along with lyrics and chords together, automatic scrolling, tap a chord for a diagram and short video, basic or full strumming version, and it explicitly "doesn't check for right/wrong notes". **Lesson:** a play-along without verification is an accepted product; verification is a separate, harder feature.
- **Chordify [S]:** diagrams for guitar, piano, ukulele; transpose, capo, tempo and loop are Premium. Auto-scroll unconfirmed. It detects chords from audio **[M]**; expect lower accuracy on voice + harmonium + tabla.
- **Ultimate Guitar [S]:** help centre lists Loop, Speed, Transpose, autoscroll, metronome; chord diagrams with variations; several tools are Pro only.
- **Smule / karaoke sync [S]:** no Smule-specific documentation found. Word-level highlighting needs a timestamp per word (LRC-like formats), made by tapping along or by speech-recognition alignment (one vendor claims 50 to 100 ms for speech). Line-level timing is enough for casual karaoke. My view **[M]**: forced alignment on sung music with harmonium and tabla is much less reliable than on speech.

### 2.6 What we take

1. A **short list** in progress and **one current** item.
2. A **daily plan** with a size cap; missed days never become a wall.
3. **Review is its own habit**, doable across everything at once.
4. **Cheap streak, soft goal**, no hearts.
5. **Play-along** = chords over words, transpose, capo, tempo, loop, auto-scroll; verification optional.
6. **Mistakes** are a review type.

---

## 3. The learner's mental model

Four nouns, used with the same words everywhere:

```
 LIBRARY          ->   ACTIVE SONG      ->   TODAY (daily plan)   ->   REVIEW ALL
 songs I chose         the one I am          what to do now,          repeat everything
 to learn              working on            sized to my goal         I know, in one go
 (queued/learning/     (exactly one,         (cards due, practise     (scheduled, or
  learned)              I can change it)      active song, a song      "practise now" with
                                              to sing again)           no schedule change)
```

Rules that hold it together:

1. **Add is explicit.** A song joins the Library only when the person taps "Learn this song" or adds it in the picker. Opening a song or its path never adds it (fixes the side effect in 1.2).
2. **Exactly one Active song.** It is shown first everywhere, gets priority for new word cards, and is what Continue and Play-along open. The first song added becomes active. Changing it is one tap ("Make active"). When it is finished the app offers "Next: <next queued song>" or "Pick another".
3. **Other songs are not lost.** Started songs stay "Learning" with their progress; untouched ones stay "Queued". A soft hint, never a limit: "5 songs in progress. One at a time tends to work better."
4. **Review is automatic and shared.** Every learning and learned song feeds one review queue. The person never picks "which song to repeat"; the plan picks. If they want everything now, there is a button.
5. **Today answers three questions in one card:** how many cards are due, what I do for the active song, whether a song needs singing again.

Example of the daily plan:

```
 Today                                      about 11 minutes
  12 cards due                              3 songs
  Practise Bandhu He Niye Calo (active)     5 min   Step 3: Play
  1 song to sing again                      Ámár Gán
 -------------------------------------------------------
 [ Start today ]       Review all songs       Not today
```

"Start today" runs the items back to back: cards first (short, warms up), then the song to sing again, then active-song practice. Each item can be skipped. Time estimates today are fixed constants (1 minute per card, 4 per song in `practiceSummary`); once the review log has `durationMs`, use the learner's own median instead.

---

## 4. Data model

Goals: derived values stay derived; one place for settings; algorithm-neutral cards so FSRS can be added without a migration; shaped for later sync (API-13).

### 4.1 Entities

```ts
// Library
type SongStatus = "queued" | "learning" | "learned" | "paused"
type Instrument = "voice" | "harmonium" | "guitar"
type LearningSong = {
  songId: string               // "ps-12"
  number: number
  title: string
  addedAt: number
  status: SongStatus           // learned = all 3 steps done (4.3); paused = out of plan and review
  instruments: Instrument[]    // what THIS person plays for this song
  keyPref?: { harmoniumKey?: string; capo?: number; transpose?: number }
  note?: string                // the learner's own line
}
// store level
activeSongId: string | null    // exactly one; must be a non-paused song in the list

// Progress per step (replaces PathState booleans; the four names migrate 1:1)
type StepProgress = {
  hear:  { doneAt?: number; passes: number; bestShare?: number }   // share of song heard, 0..1
  words: { doneAt?: number }                                        // derived from cards
  play:  { doneAt?: number; byInstrument: Partial<Record<Instrument, { doneAt: number; lastTempo: number }>> }
  quizPassedAt?: number                                             // today's `meaning` flag
}

// One card engine for everything
type CardKind = "word" | "sing" | "play" | "chord" | "line"
type Card = {
  id: string      // word "ps3-bandhu" (unchanged), "sing:ps-3", "play:ps-3:guitar", "chord:Am:guitar"
  kind: CardKind
  songId?: string
  state: "new" | "learning" | "review" | "relearning"
  dueAt: number
  intervalDays: number
  reps: number
  lapses: number
  lastReviewedAt: number | null
  ease: number            // SM-2 family (existing three styles)
  step: number
  stability?: number      // FSRS family, only if "smart" is ever used
  difficulty?: number
  leech?: boolean
  suspended?: boolean
}

// Append-only review log: source of truth for streak, stats, and replay under another algorithm
type ReviewLogEntry = {
  at: number
  cardId: string
  kind: CardKind
  grade: "again" | "hard" | "good" | "easy"
  prevState: Card["state"]
  prevIntervalDays: number
  elapsedDays: number | null
  durationMs?: number
  source: "cards" | "quiz" | "song-practice" | "review-all" | "practise-now"
  scheduled: boolean      // false for "practise now" answers
}
```

Song ids stay `ps-n`; word card ids keep `ps{n}-{slug}`, so existing local data migrates untouched.

### 4.2 Settings

```ts
type LearnSettings = {
  reviewStyle: "steps" | "adaptive" | "daily" | "smart"   // "smart" only after phase 6
  desiredRetention: 0.8 | 0.85 | 0.9 | 0.95               // "smart" only, default 0.9
  newCardsPerDay: number        // default 10, 0..30 (0 = reviews only)
  maxReviewsPerDay: number      // default 40, 10..200
  goalMinutes: 5 | 10 | 15 | 20 // default 10; soft, never gates the streak
  instruments: Instrument[]     // default ["voice"]; decides which Play cards exist
  sessionOrder: "cards-first" | "song-first"
}
```

Reminder time and on/off stay in `notificationSettingsStore`; the Learn settings only link there.

### 4.3 Derived, never stored

- `learned` = `hear.doneAt && words.doneAt && play.doneAt` (same as `isSongLearned`).
- Song **strength** 1 to 5 (the bar in the prototype), from the song's `sing` card interval: under 1 day = 1, under 3 = 2, under 7 = 3, under 21 = 4, otherwise 5. Before a `sing` card exists, use the mean interval of the word cards. Replaces `LIBRARY_DEMO.strength`.
- Song **due** = its `sing` or any `play` card is due. Due word cards count in the cards number but do not light the whole song (one forgotten word is not a forgotten song).
- Streak and week dots from the review log plus a practice entry when a Play session ends (so song practice counts; today it does not).
- Today's plan and all counters.

### 4.4 Song cards: how a song gets its own schedule

Two new kinds run through the **same** `gradeCard` engine as words:

- `sing:<songId>`: "Can I sing it from memory?" The session shows the title and first line; the learner sings or hums, then grades themselves.
- `play:<songId>:<instrument>`: "Can I play it?" Exists only for instruments the learner plays, and only once that Play step is done. Playing is a different skill from singing, so harmonium and guitar do not share a card.

The self-rating at the end of a Play or Sing session (Again, Hard, Good, Easy) is applied to that card. This is the "Again / Hard / Good / Easy applied to the song's practice interval" requirement. A learned song then has a real next-review date for the library row.

### 4.5 SM-2 vs FSRS and the existing three review styles

Today (`lib/learn/srs.ts`): **Steps** (fixed ladder 1, 3, 7, 14, 30 days), **Adaptive** (SM-2-like: ease 2.5 start, floor 1.3, hard factor 1.2, lapse penalty 0.2; Easy adds 0.15 to ease instead of Anki's 1.3 multiplier, so close to Anki but not identical), **Daily** (tomorrow until Easy, then weekly).

**Recommendation: keep the three; add a fourth, "Smart" (FSRS), later; do not make it the default.**

Why keep the three:
- They are predictable for people who do not know Anki. Steps fits one line: "you always know what is coming".
- Scale is small. A song has 15 to 40 words; a serious learner might reach 300 to 800 cards. FSRS personalises from a few hundred reviews of history [V]; below that it runs on default parameters, and its edge over a tuned ladder shrinks.
- They exist, are tested, and have UI (`ReviewStyleSheet`).

Why add Smart at all:
- One understandable control: "How sure do you want to be: 80 / 85 / 90 / 95 percent".
- It handles long gaps and missed days properly, because R is computed from real elapsed time. This is where SM-2 is weakest [V, FSRS wiki], and a hobby learner disappears for a week often.
- Claimed 20 to 30 percent fewer reviews at equal retention [V as the project's own claim].

How it fits without a rewrite:
- `Card` carries optional `stability` and `difficulty`; `ReviewLogEntry` has everything FSRS needs. Switching style means replaying the log, so nothing is lost either way.
- Implement as a fourth branch in `gradeCard` and `previewIntervals` (the interval under each button works unchanged).
- Ship only if replaying real logs from the three-style period shows Smart giving equal or fewer reviews at equal self-reported recall. If not, leave it out.
- Inherited rules [V, Anki manual]: learning steps stay in minutes; Hard is not for forgotten cards; one scheduler per card.

New accounts default to **Steps**, as today. Picker copy stays human: "Steps: you always know what is coming" / "Smart: asks for less, the app learns your memory".

### 4.6 Leeches (words that never stick)

At 6 lapses (Anki uses 8 [V]; our decks are tiny) set `leech` and show the card once with help instead of another flip: the song line it came from, an audio snippet of that line, and "Say it in your own words" (a note). Keep it in review; do not suspend by default. Leeches feed the "Only mistakes" review (6.4).

---

## 5. The song-practice side: step 3 "Play"

### 5.1 The Play screen

One screen, one switch: **Voice | Harmonium | Guitar**, remembered per song (default from settings). Layout in 6.6a.

| Part | Voice | Harmonium | Guitar |
|---|---|---|---|
| Lyrics | lines light up; script per the song-page setting | same | same |
| Over the words | nothing (swara names if notation data ever exists) | chord letters transposed to Sa | chord letters, as shapes (with capo) or sounding names |
| Reference strip | none | keyboard with the **current chord's three keys lit** (`explainChord`, `spKeys` exist) | the **current chord diagram**, big, next chord small beside it (`shapeCards`, `diagramPaths` exist) |
| Key | the singing key | **Sa is** stepper (same `harmoniumKey`) | **Capo** stepper, "Easiest capo: 3" (`spBestCapo`), and Transpose when the voice needs another key |
| Chord list | none | all chords of the song, tap to see the keys | all chord cards of the song with diagrams |

Both instruments need chords. The hub's Chords tile opens a library with a Guitar | Harmonium switch (6.6b), so a guitarist no longer lands on a harmonium lesson.

### 5.2 Practice tools (all three instruments)

- **Tempo 0.5x to 1x.** Presets 0.5, 0.65, 0.8, 0.9, 1.0. The player has `setRate`; step 1 already plays at 0.75. Pitch must stay fixed when slowed; I did not verify that the audio layer corrects pitch, so test it in phase 3.
- **Tempo ramp.** After two clean passes of a loop, *suggest* "Try 0.8?" (one tap). Never change speed silently. (Yousician has an automatic version for singing [S].)
- **Loop a line or section.** Tap a line to loop it; tap another to extend. Section shortcuts if the song has sections, otherwise groups of 2 or 4 lines. **Data caveat:** loops and seeks need real line start times. Today they are interpolated from line length and drift. Phase 3 ships loops with the interpolated timing plus a per-line nudge (+/- 0.5 s, saved on the phone); real timestamps (API-11) replace it later.
- **Auto-scroll.** Follows the active line like the karaoke panel; touching it pauses until the line changes (existing `LyricsPanel` behaviour).
- **Wait mode, two honest levels.**
  1. *Tap-wait (phase 3):* the song pauses at a line end; the learner taps Next when they have played it. No verification, like Simply Guitar Play [V]. Good for slow chord-change practice.
  2. *Listen-wait (research only):* the microphone checks the note or chord. Single-note pitch detection for a harmonium melody is realistic **[M]**; chord detection from a live guitar, or a harmonium playing drone plus chord, is much harder and I would not promise it. A spike, not a roadmap item.
- **Count-in and click** (one bar) for strumming and chord-change practice. Small.

### 5.3 End of a Play session: self-rating

```
 How did it go?                 Bandhu He Niye Calo · Harmonium · 0.8x
 [ Again ]   [ Hard ]   [ Good ]   [ Easy ]
   <10 min    2 days     5 days     9 days      (preview from this card's interval)
 A note for next time?  [ chord change in line 3 is slow ]
```

- Applies to `play:<song>:<instrument>`; for Voice it applies to `sing:<song>`.
- Step 3 is done on the first Good or Easy, or on "I played it through once". Again and Hard do not mark it. (Fixes marking on tap.)
- Logged with `source: "song-practice"` and the tempo. If tempo is below 0.8 and the rating is Easy, the preview is capped at the Good interval: slow and easy is not the same as known.
- The note is stored on the song and shown at the top of the next Play session.

### 5.4 Rules for "done"

| Step | Today | Proposed |
|---|---|---|
| 1 Hear and sing | tap on the button | at least 80 percent of the song heard once at any speed (`bestShare`) |
| 2 Words | all words graded once | unchanged (`songWordsComplete`) |
| 3 Play | tap on the button | first Good/Easy self-rating in Play, or "I played it through once" |
| Learned | all 3 | all 3, and the song now has a `sing` card (created at the first Good) so it enters review |

---

## 6. Screens

Phone portrait, one column. `[ ]` button, `( )` chip, `*` active marker, `>` navigates.

### 6.1 Learn hub

Changes: Continue becomes **Active song**; a new **Today** card; the shelf becomes **My songs** with the active marker and an Add button; tiles regrouped.

```
+------------------------------------------+
| (D)                        search   bell |
| Learn                                    |
| 3 songs learned · 2 learning · 24 words  |
+------------------------------------------+
| ACTIVE SONG                              |
| PS 1                                     |
| BANDHU HE NIYE CALO                      |
| [###][###][ . ]  Hear · Words · Play     |
| Next: Step 3, Play (harmonium)           |
| [ Continue ]                 Change song |
+------------------------------------------+
| TODAY                      about 11 min  |
|  12 cards due                            |
|  Practise Bandhu He Niye Calo     5 min  |
|  1 song to sing again                    |
| [ Start today ]       Review all songs > |
| This week  · · ● ● ○ ○ ○ ○ ○             |
+------------------------------------------+
| MY SONGS                   ( + Add songs )|
| * Bandhu He Niye Calo   Learning  2/3    |
|   Ámár Gán              Due today        |
|   E Gán Ámár           Queued            |
|   Sakal Maner Viińá  Learned · strong    |
| See all >                                |
+------------------------------------------+
| PRACTISE              | PLAY ALONG       |
| [Word cards  12 due ] [Chords Gtr·Harm ] |
| [Quiz  Level 1      ] [Harmonium Sa = D ]|
| Word of the day: Bandhu                  |
+------------------------------------------+
| Explore: Stories · Raga/Tala · Certificates
+------------------------------------------+
```

- Empty state (no songs): Active and Today are replaced by one card, "Pick your first song. Three steps: hear it, know the words, play it." with `[ Choose a song ]` and three suggestions.
- The week strip shows days practised (7.3), not a flame.
- The Active card *is* the old Continue card, now explicit.

### 6.2 Add songs to learn

Opened from `+ Add songs`. "Learn this song" on a song page adds one song without a screen and offers "Make it active?".

```
+------------------------------------------+
| <  Add songs to learn         [ Add 3 ]  |
| [ search by title or number            ] |
| ( Saved ) ( All songs ) ( Suggested )    |   Saved = songs I saved ("Mine")
|------------------------------------------|
| [x] PS 1   Bandhu He Niye Calo           |
|     27 words · lyrics · chords reviewed  |
| [x] PS 3   Ándhára Sheśe Álora Deshe     |
|     19 words · lyrics · no chords yet    |
| [ ] PS 4   Sakal Maner Viińá Ek Sure ... |
|     22 words · lyrics · chords reviewed  |
| [ ] PS 7   Niiravatá Májhe Ke Go Tumi ...|
|     no word list yet                     |
|------------------------------------------|
| 3 selected   Start with: ( PS 1 v )      |
| [ Add 3 songs ]                          |
+------------------------------------------+
```

- Multi-select. Saved comes from `savedSongIds`; All songs searches the catalog; Suggested lists songs with word lists and reviewed chords first.
- Each row says what exists for it (words, chords). A song without words can still be added; step 2 reads "Not available yet" and does not block "learned" (section 8).
- Already-added songs are checked and disabled: "In your list".
- "Start with" picks which becomes active; default is the current active song if one exists (new songs go to Queued).
- After adding: "3 songs added. Bandhu He Niye Calo is your active song." with `[ Change ]`.

### 6.3 Song learning page (`/learn/song/[songId]`)

```
+------------------------------------------+
| <                               ( ... )  |
| PS 1                                     |
| BANDHU HE NIYE CALO       * Active song  |
| [ Make active ]   (hidden if active)     |
| Memory ●●●○○     Next review in 3 days   |
|------------------------------------------|
| STEP 1 · DONE  (84% heard, 2 passes)     |
|  Hear it and sing it     [ Do it again ] |
|------------------------------------------|
| STEP 2 · TO DO  (14 of 27 words)         |
|  Learn what it means                     |
|  [ Study the words ]   [ Quiz this song ]|
|------------------------------------------|
| STEP 3 · TO DO                           |
|  Play it    I play: (Voice)(Harmonium)(Guitar)
|  Sa D · Capo 2 · last tempo 0.8x         |
|  [ Open Play ]                           |
|------------------------------------------|
| My note: "chord change in line 3"   edit |
| Pause this song · Remove from my list    |
+------------------------------------------+
```

- Pause hides the song from plans and review and keeps progress. Remove asks first and says what is lost, with a "keep my cards" option.
- Opening the page never adds the song. If it is not on the list: `[ Add to my songs ]`.

### 6.4 Review all session

Entry points: hub "Review all songs", the Today card, the Library header, a notification.

```
+------------------------------------------+
| <  Review all                            |
| (•) Today's reviews          12 cards    |
|     + 1 song to sing again   about 6 min |
|     Changes your schedule.               |
|                                          |
| ( ) Practise everything now              |
|     5 songs, 71 cards, about 20 min      |
|     Does not change your schedule.       |
|     Cards you miss come back today.      |
|                                          |
| ( ) Only mistakes                        |
|     9 cards you got wrong lately         |
|                                          |
| Songs: (All 5 v)  -> choose some         |
| [ Start ]                                |
+------------------------------------------+
```

Session screen: the same card UI as `/learn/words` (flip, four grades, interval under each), plus a header "Bandhu He Niye Calo · word 3" so the person always sees which song a card is from, and progress per block:

```
 Words ████████░░ 8/12     Songs ░░ 0/1     (Quiz ░░░░░ 0/5, optional)
```

Order: words interleaved across songs (not one song after another; mixed practice is generally held to help retention **[M]**), then songs to sing, then an optional 5-question mixed quiz from the same songs ("Which line comes next?", "Which song is this line from?").

Mode meaning, borrowed from Anki's custom study [V]:
- **Today's reviews:** normal scheduling, capped by `maxReviewsPerDay`.
- **Practise everything now:** a filtered deck with rescheduling off. Answers are logged with `scheduled: false`, intervals do not move, except Again, which makes that card due today so a real lapse is not hidden. Anki's own note: reviewing early barely changes scheduling, so we skip it rather than distort.
- **Only mistakes:** cards with a lapse in the last 14 days, leeches, and wrong quiz answers.
- **Songs:** choose which; default all non-paused.

End screen: counts per song, the 3 weakest words, and a calm next-due line from `describeNextDue` ("Next card tomorrow"). No confetti, no loss language.

### 6.5 Learning settings

```
+------------------------------------------+
| <  Learning settings                     |
| DAILY                                    |
|  Daily goal          (5)(10)(15)(20) min |
|   A target. One small thing counts as a day.
|  New cards per day   [ - 10 + ]          |
|   0 = only review what you know          |
|  Most reviews a day  [ - 40 + ]          |
|   The rest wait until tomorrow.          |
| REVIEW STYLE                             |
|  (•) Steps ( ) Adaptive ( ) Daily ( ) Smart (later)
|  How sure: 80  85 [90] 95 %   (Smart only)
| I PLAY                                   |
|  [x] Voice  [x] Harmonium  [ ] Guitar    |
|  Harmonium Sa: D        Guitar capo: 0   |
| REMINDERS                                |
|  Today's plan 18:00 · Streak off      >  |   -> notification settings
| DATA                                     |
|  Export my learning data    Reset all    |
+------------------------------------------+
```

- The Reminders row opens the existing notification settings. Plan: rename the `words` reminder to "Today's plan" and fire it only when the plan is non-empty (small change to `docs/notifications.md` and the scheduler).
- Changing the style shows one line: "Your 71 cards keep their dates; new dates use the new style."

### 6.6 Play along and Chord library

**a) Play (song, step 3)**

```
+------------------------------------------+
| <  Play · Bandhu He Niye Calo      ( ... )|
| ( Voice )( Harmonium )( Guitar )         |
| Capo [ - 2 + ]  best: 3 · shapes Em → sounds F#m   (Guitar)
| Tempo (.5)(.65)(.8)(.9)(1.0)   Loop lines 3-4 [x]
|------------------------------------------|
|   Am            G          Em            |
|   Bandhu he niye calo, niye calo         |   active line lit
|   Dm            ...                      |
|   next lines ...                         |
|------------------------------------------|
|  NOW [Am diagram]    NEXT [G diagram]    |   Guitar
|  or  [keyboard, 3 keys lit]              |   Harmonium
|------------------------------------------|
| [ Play / Pause ]  [ Wait: line ]  [ Count-in ]
| [ Finish and rate ]                      |
+------------------------------------------+
```

Without a reviewed chart the screen still works: chord rows become "No chords for this song yet" with `[ Suggest chords ]` (9.3); tempo, loop and rating stay available for Voice.

**b) Chord library (the Chords tile)**

```
+------------------------------------------+
| <  Chords                                |
| ( Guitar )( Harmonium )                  |
| IN MY SONGS  (Guitar)                    |
|  Am  G  Em  F  C  D      tap = diagram   |
|  [ Practise these chords ]               |
| HOW CHORDS WORK                          |
|  1 Frets and fingers   2 Open vs barre   |
|  3 Capo: same shapes, higher key  4 Strum|
| Harmonium tab = the existing 3-card      |
|  lesson and "Try it", unchanged          |
+------------------------------------------+
```

**Chord cards** (`kind: "chord"`) are a small review deck on the same engine. Front: a diagram (guitar) or the three lit keys (harmonium); back: the name; or reversed. Only chords that occur in the learner's songs. This gives instrument learners something to repeat daily, as word cards do for meaning.

**c) Harmonium tile** keeps its screen but "Practise on" becomes the active song (replacing the two hard-coded `PRACTISE_SONGS`).

---

## 7. Quizzes, and how results feed spaced repetition

### 7.1 Question types

| Type | Example | Data needed | Exists now? |
|---|---|---|---|
| Meaning of a word | What does Bandhu mean? (4 options) | word list + meanings | Yes (level 1; sample words for PS 1 and 3 only) |
| Word from meaning | Which word means "friend"? | same | No, easy |
| Fill the missing word | "Bandhu he ___ calo" (options from the song's own words) | lyric lines | Lyrics exist; builder does not |
| Order the lines | Put 4 lines in order (drag) | lyric lines, verse boundaries | Lyrics yes; boundaries partly |
| Which line comes next | Given a line, pick the next of 4 | lyric lines | Lyrics yes |
| Listen and pick the song | 6-second snippet, 4 titles from the learner's own list | audio + a good start offset | Audio yes; offset no (default: first refrain, else 0:20) |
| Raga / tala recognition | Which raga is this song set in? | song-to-raga/tala field | **Unverified.** The index is fixture data; I found no song field. Ship only if the catalog has it, reviewed. |
| Chord recognition | Which diagram is Am? | chord library | Diagram data exists (24 shapes) |

Levels grow by depth of recall, not by trickiness. Level 1 recognition (word meaning, word from meaning). Level 2 line level (fill the word, next line, order lines, line meaning from the translations the song page already shows). Level 3 song level (listen and pick, story and context, raga/tala if data allows). Names stay: Know the words, Know the meaning, Know the story.

### 7.2 How results feed the cards

Principle: **a wrong answer is strong evidence; a right answer to a recognition question is weak evidence** (multiple choice is easier than recall; and Anki notes early reviews barely change scheduling [V]).

| Result | Effect |
|---|---|
| Wrong on a word, line or chord question | **Again** on that card (`source: "quiz"`); added to "Only mistakes". |
| Right, card due today or overdue | Counts as **Good** (never Easy). |
| Right, card not due | No schedule change; logged only. |
| Right on a new card | Card becomes `learning` with Good; counts against `newCardsPerDay`. |
| Level pass (7 of 10, existing rule) | Sets `quizPassedAt` for the songs covered; opens the next level. |

A quiz of 10 questions touches at most 10 cards, so it never creates a backlog by itself.

### 7.3 Levels, XP, streak without dark patterns

The app's honesty rules apply: no fake urgency, no invented scarcity, no loss language, no paid forgiveness.

- **Streak:** keep it, cheap and quiet (Duolingo found one small action beats a goal-gated streak [V]). A day counts when the learner does **any one** of: a card review, a Play session, a quiz, or a 80-percent hear pass. Show the number only from day 2. Never "you will lose your streak". The `streak` notification stays off by default (already so).
- **Alternative to a flame:** a seven-dot week strip ("4 of the last 7 days"). It forgives a missed day by design. I recommend the strip as primary and the number as a small secondary line (question 2).
- **No hearts, no energy, no leaderboards, no limited-time offers.**
- **XP:** not needed. If wanted, the only honest form is a plain count ("142 cards reviewed this month", "6 songs learned"), no multipliers. Levels stay as quiz levels. Certificates stay in the live-quiz system.
- **Daily goal:** minutes, soft. The ring fills; reaching it shows "Done for today"; missing it changes nothing.
- **Checkpoint (Duolingo idea [S]):** after every 3 learned songs, offer an optional mixed quiz over them.

---

## 8. Edge cases

| Case | Behaviour |
|---|---|
| **Song with no lyrics** | Cannot be added; the picker says "No lyrics yet". If lyrics vanish later, the song is paused with a note. |
| **No word list** | Step 2 reads "Not available for this song yet". Learned = steps 1 and 3. |
| **No chords** | Play works for Voice (loop, tempo, rating). Harmonium and Guitar show "No chords yet" + `[ Suggest chords ]`. Step 3 can be done as Voice. Chords are never invented (API-07/14). |
| **Chart exists but unreviewed** | Hidden (current contract). Question 4 asks whether to show it with a label. |
| **Many songs (30+)** | Library: Active, then Due, then Learning, then the rest collapsed with a count; search under "See all". The plan only ever shows three items, never a per-song list. Caps bound the work. |
| **Missed days / backlog** | Never a wall of overdue cards. (1) The plan shows at most `maxReviewsPerDay`; overflow is "waiting", not red, and shows as "x more tomorrow". (2) Order: most overdue first (Anki's default [V]); lowest retrievability first once Smart exists. (3) After 3+ missed days the plan card says "Welcome back. A short session, then you are caught up", capped at 20 cards, and new cards pause until the backlog is under the cap (Anki advises the same [V]). (4) The streak and week strip never depend on backlog size. |
| **Offline** | Local-first, as now. Quizzes use local data. Audio question types are offered only for songs with downloaded audio (`docs/offline-distribution.md`). The log appends locally and syncs later. |
| **Guest** | Full local use. One quiet line in settings: "Your progress is only on this phone. Sign in to keep it safe." No gating, no nagging. On sign-in, local state is uploaded and merged. |
| **Sync across devices** | `TODO(api): store progress on server for signed-in members` (API-13). Merge: cards by `id`, later `lastReviewedAt` wins; the log is append-only, union by (`cardId`, `at`); `activeSongId` last write wins by timestamp; `songs` union, with pause/removal winning if newer. Do not use progress for targeting (`docs/notifications.md`: "nothing about what the person learns or plays"). |
| **Day boundary** | Device-local day for "today" (as `endOfLocalDay`); UTC timestamps in storage. |
| **Style differs between devices** | Style is a synced setting; cards hold both SM-2 and FSRS fields, so a switch loses nothing. |
| **Clock changes** | Clamp negative elapsed time to 0; never schedule into the past. |
| **Active song deleted or paused** | Active moves to the next Learning song, else the first Queued, else none; the hub says so once. |
| **Same word in two songs** | Separate cards (ids are per song). Keep for now. |
| **Leech** | 4.6. |

---

## 9. Build plan

Sizes for one developer: **S** under 3 days, **M** about a week, **L** two weeks or more.

### Phase 0: stop the lying steps and the silent add (S)
- `learnStore` version 2 with `migrate` keeping `songs`, `paths`, `cards`, `quizBest`.
- Stop `startLearning` on page open; add an explicit `[ Add to my songs ]`.
- Step 1 done at 80 percent heard. Step 3 rule needs the Play sheet (phase 3); until then keep the tap and mark it a known gap in a code comment.
- Tests for migration and the rules in `lib/learn/progress.ts`. Backend: none.

### Phase 1: Library, Active song, Today, Review all (M)
- Store: `status`, `activeSongId`, `makeActive`, `pause`, `addMany`.
- Hub: Active card, Today card (pure `buildDailyPlan` in `lib/learn/plan.ts`), My songs with the marker.
- Add songs screen (saved + catalog search, multi-select).
- Review all, words only: merged deck from all non-paused songs, interleaved, capped; modes Today / Practise now / Only mistakes. `buildDailyQueue` handles one deck; extend it and add the review cap.
- Settings screen: goal, new per day, review cap, style.
- Review log replacing `history[30]` for new data (keep reading old history for the streak).
- Backend: none. **Data blocker:** real word lists beyond PS 1 and 3 (today only `SAMPLE_LEARN_WORDS`). This blocks a good Learn tab regardless of this design.

### Phase 2: backlog and honesty rules (S)
- Caps and spread, welcome-back rule, week strip, streak counts any one action, notification text "Today's plan".
- Leech handling for words.

### Phase 3: Play along v1 and song cards (L)
- Play screen on existing pieces: instrument switch, key/capo, chord strip, diagrams, lines with letters (`wordColumns`), tempo presets, loop on interpolated timing with a nudge, tap-wait, rate sheet.
- `sing` and `play` cards on the same engine; song strength 1 to 5 from real data; drop `LIBRARY_DEMO`.
- Chord library page with instrument switch; "In my songs"; chord cards.
- Verify pitch-correct slow playback and interplay with background audio.
- Backend: chord charts (9.3). Without charts this phase ships the Voice side and the empty states, which is still useful.

### Phase 4: quiz types (M)
- Generators for fill-the-word, next line, order lines, word-from-meaning from lyric lines and translations; feeding cards per 7.2; level 2 uses them. Level 3 needs reviewed story content, not yet available (API-12).

### Phase 5: account sync (L)
- API-13 endpoints for `songs`, `settings`, `cards`, `review log`; merge rules from section 8; guest upload on sign-in. Needs server design and a privacy review (progress is personal data).

### Phase 6: Smart (FSRS) and audio quiz (M each)
- Smart style via `ts-fsrs` **[M, verify]** on default parameters with a desired-retention setting; replay-test on real logs first (4.5).
- Listen-and-pick needs a per-song snippet offset. Raga/tala questions only if the catalog gains a reviewed field.

### 9.1 What needs backend or data

| Item | Need | Blocking? |
|---|---|---|
| Real word lists and meanings | API-07/12, reviewed | Yes for step 2 beyond PS 1 and 3 |
| Chord charts | 9.3 | Yes for chord display on Guitar and Harmonium |
| Line timestamps | API-11 | No (interpolation works); loop and wait precision depends on it |
| Sync | API-13 | No for a local-first launch |
| Audio snippet offsets | new field | Only for listen-and-pick |
| Song to raga/tala | catalog field, unverified | Only for that question type |

### 9.2 Order

0, 1, 2 first (all local, no backend: this is the whole "never hunt" promise). Then 3 in two cuts (Voice and shell first, charts as they arrive). Then 4, 5, and 6 last.

### 9.3 Sourcing guitar chords honestly

Guitar chords do not exist for most songs. Options, most to least trustworthy:

1. **Manual, by the team, in an admin tool (recommended base).** A musician opens a song, taps a word in a line and picks a chord from a palette, sets base key and strum. The existing contract fits (`ChordChart`: placements by word index, `baseKey`, `strum`, `reviewed`). Transposition, capo and diagrams are computed in-app already. Cost is musician time; my estimate **[M]** is 15 to 40 minutes per song for someone who knows it; I have not measured it. Start with a short list of 20 to 30 songs. Choosing them by "most added to Libraries" is a use of learning data, so keep to aggregate saved/played counts or Dada's editorial choice (question 6).
2. **Community suggestions, then review.** A signed-in member submits a chart from the Play screen using the same editor. It goes to a review queue like the Kiirtan upload flow (team and authors upload, admin reviews). Others see nothing until a reviewer marks it `reviewed`; the submitter sees their own, labelled "your suggestion". This multiplies capacity but needs moderation time; start it after the admin tool exists.
3. **Auto-detect from audio: do not publish.** Commercial tools do this (Chordify [S]) with good results on pop recordings **[M]**. For a voice with harmonium, tabla and drone the error rate is likely high, and the contract says charts are never generated at read time. Use at most as a *draft generator inside the admin tool* that a human corrects; that is a model, a server job and testing on our recordings, so a spike, not a promise.
4. **Harmonium may not need chords first.** For harmonium, melody notation (swara per syllable) may be better content than chord letters, if published notation can be digitised. I could not verify whether the catalog or books have it in usable form. Accompaniment chords come from the same chart as guitar (the app already maps one chart to both instruments).

Whatever the source, the screen shows provenance: "Reviewed chart by <team>" or "Your suggestion", never mixed silently.

---

## 10. Open questions for Dada

1. **Active song: exactly one, or up to three "focus songs"?** I recommend exactly one (one Continue button, clear). Three suits someone learning a morning and an evening song but weakens the clarity.
2. **Streak:** keep a number (any one small action counts), or replace it with the week strip and no number? I recommend the strip first, number secondary.
3. **What does "learned" mean?** I propose three steps plus a first Good self-rating in Play. Should it also need a passed song quiz, or seven days of successful review? Stricter means fewer but more honest "learned" songs.
4. **Chords: who writes them, and may unreviewed community charts be shown with a clear label?** Today only reviewed charts show. Labelled suggestions grow coverage fast but risk wrong chords being practised.
5. **Smart (FSRS): build it, and when?** My view: after phase 3, only if replayed logs justify it. Cost: a library and a longer explanation in the UI. Gain: less review and better handling of missed days.
6. **Defaults and data use:** new cards per day (10?), review cap (40?), goal (10 minutes?). And may anonymous aggregate counts decide which songs get chords first, or is that your editorial choice only?

---

## Appendix A: Sources

Read in this session:
- Anki manual: https://docs.ankiweb.net/studying.html, https://docs.ankiweb.net/deck-options.html, https://docs.ankiweb.net/filtered-decks.html, https://docs.ankiweb.net/leeches.html, https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm
- FSRS: https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS, https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm
- Duolingo: https://blog.duolingo.com/improving-the-streak, https://blog.duolingo.com/how-we-learn-how-you-learn (paper: Settles and Meeder, ACL 2016, "A Trainable Spaced Repetition Model for Language Learning"), https://blog.duolingo.com/guide-to-duolingo-practice-hub/
- Simply Guitar: https://piano-help.hellosimply.com/en/articles/14588852-what-is-play-in-simply-guitar

Search results only (primary page returned 403 or was not fetched): Yousician support (support.yousician.com, Practice vs Play articles), Quizlet help centre (help.quizlet.com, Studying), Memrise help (memrise.zendesk.com/hc/articles/360015889057), Chordify App Store text, Ultimate Guitar help centre and App Store text, karaoke-sync tool pages, Duolingo hearts/energy (third-party reports).

Memory only, not looked up: Anki default numbers (20 new, 200 reviews, learning steps 1m 10m, graduating 1 day, easy 4 days), `ts-fsrs` details, the interleaving benefit, accuracy of audio chord recognition on devotional recordings, musician time per chart.

## Appendix B: Mapping from today's code to the proposal

| Today | Becomes |
|---|---|
| `LearningSong` (4 fields) | adds `status`, `instruments`, `keyPref`, `note` |
| `PathState {listen, words, meaning, chords}` | `StepProgress`; the four names migrate 1:1 |
| `WordCard` | `Card` with `kind: "word"` (optional fields added) |
| `buildDailyQueue(wordIds, cards, now, newLimit)` | `buildDailyPlan(settings, library, cards, now)` with the same queue rules plus the review cap |
| `practiceSummary(dueWords, dueSongs)` | text of the Today card, with real `dueSongs` from `sing`/`play` cards |
| `pickContinue` (most progress) | `activeSongId` (explicit); `pickContinue` stays as fallback when none is set |
| `sessionDeck(..., limit = 10)` | cap removed; `newCardsPerDay` and `maxReviewsPerDay` |
| `learningStreak` (word history only) | derived from the review log plus practice entries |
| `LIBRARY_DEMO` strength and next review | derived from the `sing` card interval |
| Hub "Play along" tiles | Chords (both instruments + in my songs) and Harmonium (with active song), plus Play from the Active card |
