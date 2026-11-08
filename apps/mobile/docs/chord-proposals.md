# Chord proposals and the Upload button

Members can offer chords, for guitar or for harmonium, for any of the 5,018 Prabhat Samgiita songs. An accepted chart shows on the song page, in the Chords section, drawn by the same code as the built-in chart. This note says what the format is, why it is built this way, how review works, and what has not been checked.

Code: API `apps/api/app/api/v1/song_chords.py` (service, model, migrations `0031` and `0043`, tests `tests/test_song_chords.py`); app `lib/songChords/`, `components/song-chords/`, `app/upload.tsx`, `app/upload-chords.tsx`, `app/chords-review.tsx`, words in `locales/chordProposals.ts`. A board with a real 390 px screenshot of every screen and state below is in `Для-Дады/аккорды-v2/` (the shared folder, not in the repo).

## Where things are

- **Upload button.** On every screen that carries the tab bar (Today, Songs, Kiirtan, Learn, and Search opened from a link), a solid orange button with a plus and the word "Upload" sits to the right of the tab pill. It opens the hub, `/upload`.
- **The hub** has two doors: "A recording" (the existing add-Kiirtan form, unchanged) and "Chords for a song" (new). Under them: "Your chord charts", ONE compact row for each chart: the song number and title, a chip for where it stands (Draft, Waiting, Published, Not accepted, Replaced) and one ⋯ menu. What the menu does is the table "Actions of a row" below. A team member also sees "Review chord charts" with the number waiting.
- **The song page**, Chords section: under the built-in chart, "Chords from members" lists one chip for each chart (instrument and author), the chosen chart as letters over the lyrics, the capo or Sa control (starting where the author played), who made it, "Based on a chart by <name>" when the author started from another member's chart (a link to that chart when it is on the same page, plain words when it is not), their note, "I played it" if they said so, Report (or Delete, for your own chart), "Start from this chart" under another member's chart, and "Offer chords for this song". A chart that a newer version replaced is not on the page. The built-in sample chart stays where it was.

## The format

A chart is what the song page already draws (`lib/songPage/chordChart.ts`):

```
song_id      1..5018
instrument   "guitar" | "harmonium"
base_key     the key the chart SOUNDS in (C, F#, Bb). For a harmonium chart: Sa.
capo         0..7, guitar only: the fret the author's capo was on
strum        optional, guitar only: "D D U U D U"
lines        one entry per lyric line (Roman text), in the song's order:
             [{ placements: [{ word: 3, chord: "Am" }, ...] }, ...]
played_it    true (required: the author says they played or checked it)
note         optional, 300 characters
is_anonymous display choice
```

A placement is "this chord starts on this word and stays until the next one". `word` is the index in `splitWords(line)` of the Roman lyric line (the same index the built-in chart and the pronunciation guide use), so a chart is tied to words and never to character positions. The lyric lines come from the same source as the song page (`buildLyricSources(...).roman`).

**Guitar: shapes and a capo.** A guitarist thinks in shapes (G, C, Em) and a capo fret. So the member picks the key of the SHAPES and the capo, and types shapes. The app stores the sounding chords: each shape moved up by the capo, and `base_key` = shape key moved up by the capo. The capo is kept as a hint. When a reader looks at the chart the song page shows `spShape(chord, capo)`, the shapes again, and the reader can move the capo. A chart written with capo 2 and shapes C Am F G is stored as D Bm G A in key D, and shows as C Am F G at capo 2.

**Harmonium: Sa.** The member picks the key of Sa and types chords in that key. A reader sets their own Sa and the chords move (`harmoniumChord`).

Chord names accepted: a letter A to G, `#` or `b`, then up to ten pieces of a name that musicians really write (`maj`, `min`, `dim`, `aug`, `sus`, `add`, `m`, `M`, `+`, `-`, `#`, `b`, digits, brackets, the signs `°` and `ø`), then an optional bass note (`G/B`) or a second number (`C6/9`). `C6/9`, `C°`, `Am7b5` and `Cdim` pass; `Cfoo` does not. The same grammar is in the app (`lib/songChords/chordName.ts`) and on the server (`CHORD_PATTERN`, matched whole with `fullmatch`), which has the final say. A key or a chord that carries a stray trailing newline is cleaned, not stored as it came.

**Spelling is kept.** `lib/songChords/spelling.ts` (`shiftChord`) moves a chord by the capo and keeps the way its author wrote it: `G#m` stays sharp, `Db` stays flat, a bass note keeps its own style. Zero is "no move": the name comes back exactly as typed. A plain letter that has to take a mark gets the song page's spelling (Eb, Ab, Bb, C#, F#). Opening a chart for fixing and sending it again does not rename its chords. The song page's own `spTranspose` still respells with a fixed table; the editor and the stored chart do not use it.

## How a member enters chords

Two ways, on one screen, both feeding the same data:

1. **Tap words.** Every line of the song is drawn as tappable words. Tap a word and a chord sheet docks at the bottom (see "The chord sheet"). Previous and Next move through the words so a whole chart can be entered without leaving the sheet. This is the way meant for a phone.
2. **Paste text.** For people who already have chords in a file: ChordPro-style, `[Am]word` in front of the word the chord starts on, one line of text for each song line. Optional header lines `{capo: 2}`, `{key: D}`, `{strum: D D U U}`. A minor key (`{key: Am}`) sits on its relative major (C), because the editor's key is the key of the major shapes. Nothing is guessed: if a line has the wrong number of words, a chord has no closing bracket or no word after it, a word differs from the song, or a name is not a chord, the box lists each problem with its line and column, in words, and "Use this text" stays closed until the errors are fixed. Text for fewer lines than the song is only a warning.

Then a **preview** drawn by the song page's own pieces, an optional block (strumming pattern and note, closed until asked for, open by itself when one of them is filled), "I played or checked these chords myself" (required), "Share without my name", and "Send for review".

### The key question

The screen asks "Which key do you play in?" and says in one sentence how to answer: pick the chord the song comes home to, usually the last one; if you use a capo, ignore it here and write the chords your fingers make. Under the chips a live line shows what the choice does: "in the key of D you will mostly use D · G · A · Bm". Why the question is there at all:

1. It is the key of the chords as the member types them (before the capo). The app uses it to offer the usual chords in the chord sheet, to save the chart's key (shape key plus capo, so readers see "sounds in X"), and, for a harmonium, as the Sa the readers move from. It never changes a chord the member typed.
2. The old wording ("the shapes you play are in the key of ...") was jargon, and D was already selected, so beginners never noticed it was a question.
3. It cannot be dropped, because the stored chart needs a key. So it became a plain question with a hint and an example.

### Send with something missing

Send never greys out. When a required piece is missing the screen scrolls to the first missing field in screen order (song, chords, then the "I played it" box), shows the sentence under that field, and the other missing fields show theirs too. The jump is the shared helper `lib/forms/useFormFocus.ts` (`scrollRef`, `field(key)`, `focusFirst`); which field is first is the pure `firstInvalid` in `lib/songChords/fields.ts` (tested).

### The chord sheet

`components/song-chords/ChordSheet.tsx`. A docked sheet, not a popup, so the lyrics stay on screen.

- It moves by `transform` only, with springs (`amSpring`), and any move can be interrupted: a drag grabs it from where it is on screen. It follows the finger one to one, gives with rubber band resistance past its limits, and lets go with the finger's speed.
- It closes with the Done button, by dragging it down, by tapping outside it (the blank part of the editor), or with the Android back button (`useSheetBackHandler`). Focusing another field also closes it.
- The selected word stays visible: the screen measures the word (`measureInWindow`) and scrolls it into the free part above the sheet (`lib/songChords/reveal.ts`, `revealOffset`), centred, so stepping to the next word does not scroll every time. The editor gets bottom padding for the part the sheet covers.
- Page 1: "Used in this chart", then "Usual chords in <key>" (I, IV, V, vi, ii, iii, V7) and a "More" tile, then "No chord" and "Type a chord". Page 2, "More chords", takes two steps: pick the root note (twelve tiles), then the kind (major, minor, 7, m7, maj7, sus2, sus4, dim, aug, add9, each with its plain-English name). Page 3, "Type a chord", is the last resort, for a slash chord such as G/B; a name that is not a chord says so with a sentence and does not close the sheet.
- The height changes between pages by a spring on a transform, never by animating `height`. Spacing is from the 4/8/12/16/24/32/48/64 scale, corners are soft, light and dark are both drawn.
- The keyboard: on iOS the sheet lifts with `useAnimatedKeyboard` (`hooks/useKeyboardLift.ts`); on Android the window resizes (`softwareKeyboardLayoutMode: resize`) and the lift is zero.

### Drafts

Unfinished charts are kept on the phone (`stores/chordDraftStore.ts`, pure rules in `lib/songChords/drafts.ts`), not as one draft but as a small book: one per song and instrument (a guitar and a harmonium chart of the same song are different work), one per chart being fixed (`edit:<id>`), one per changed copy of a live chart (`copy:<id>`), one per chart taken back from the team (`kept:<id>`, see "Withdraw"). At most five; the least recently touched makes room. On the Upload hub a draft is a row like any other (chip "Draft"); a draft that fixes or changes a chart (`edit:` or `copy:`) does not get a second row: it rides on that chart's row as "unsent changes saved". A draft with no chord and no note is not kept. Hydration of the store is asynchronous, so the screen waits for it before it decides what to offer.

## Scenario map: the Offer Chords flow

Every state a member can meet, and what the app does in it. Each row has a test or a note about how it was checked (see "Tests").

### Doors into the screen (`lib/songChords/entry.ts`, `parseEntry`)

| Address | Meaning |
| --- | --- |
| `/upload-chords` | a new chart; asks which song |
| `/upload-chords?song=7` | a new chart for song 7 (from the song page) |
| `/upload-chords?song=7&instrument=harmonium` | "Offer another" for that song and instrument |
| `/upload-chords?edit=<id>` | fix a waiting or rejected chart; it is updated, same id |
| `/upload-chords?copy=<id>` | a changed copy of a live chart; it is sent as a new chart |
| `/upload-chords?draft=<key>` | continue exactly this draft (from a Draft row on Upload) |
| `/upload-chords?from=<id>&song=7` | "Start from this chart": a NEW chart that begins with someone else's published chart of song 7. ONLY the chords are copied, in the key they sound in; the capo and the strum pattern are not (they are the other player's way to play it), and the screen says so in its hint. The note and the "I played it" box are left empty and the name is not carried over; it never edits the other chart. The new chart is sent with `based_on_id`, so it carries the credit (below) |

Junk in the address (a song that is not a number, an instrument that is not one) falls back to a plain new chart. `edit` wins over `copy`, `copy` over `draft`, `draft` over `from`, `from` over `song`.

### Drafts

| Situation | What happens |
| --- | --- |
| Open the screen with no draft | A new chart. |
| Open it with a draft of this song and instrument | "Continue where you stopped?" with what is saved (song, instrument, number of chords, "Saved 2 hours ago"), Continue, Start over, and "Start a new chart instead". Nothing is lost by looking. |
| Several drafts | The Upload hub shows each as a Draft row; its menu has "Continue editing" and "Discard the draft". At most five are kept. |
| Close the screen with unsent work | "Leave this chart?" says it is saved as a draft and where to find it: Keep editing, Save and leave, Discard draft. |
| Start over or discard | The dialog says what will be lost (the number of chords, "Nothing has been sent", "This cannot be undone") before anything is deleted. |
| Close with nothing placed | No dialog; nothing is saved. |
| After a send | The draft is removed. |
| Send fails (offline, server error, daily limit) | The draft is kept; the screen says so. |

### Sending

| Situation | What happens |
| --- | --- |
| Not signed in | The send button explains that sign-in is needed; the draft is kept. |
| Missing pieces | The screen jumps to the first missing field and says which one under it (see "Send with something missing"); the sheet closes first if it was open. |
| Member sends | "Sent to the team": three steps (the team looks at it, you get a notice, it shows on the song page, with your name or as an anonymous member, and the team can still see who sent it). Back to Upload, Offer chords for another song. |
| Team member sends | "Your chart is live"; Open the song. |
| Done, Back, Open the song | Sending replaces nothing in the history: these buttons go BACK to a screen that is already open (`router.dismissTo`), so the hub does not stay under the result. "Back to Upload" lands on the one Upload screen; "Back to the song" and "Open the song" land on the song page the member came from (or open it when they came from the hub). See "Where Done goes". |
| Offline | "No connection. Your chart is saved on this phone." The button changes to "Try sending again". |
| Server trouble | The same, with a different sentence. |
| Daily limit (10 in 24 hours) | A sentence that says the draft is kept and to come back tomorrow, with "See your charts". Only charts that were sent for review count; see "Rules of the server". |
| Hourly brake (6 an hour) | "Wait a few minutes and try again." Only a chart that passed every check uses the hour: a refused one (empty, a twin, over the cap) does not. |
| The same chart twice | "You already sent exactly this chart", with "See your charts". |
| Third live chart of one song and instrument | The sentence names the way out (delete one, or wait) and links to the charts. |

### Editing

| Chart state | "Edit" does | Banner |
| --- | --- | --- |
| Waiting (`pending`) | Opens the chart; Send again replaces it (PUT) and it waits again. The daily allowance is not charged again. | "This chart is waiting for the team. If you change it, the new version replaces it." |
| Not accepted (`rejected`) | Opens the chart with the team's words on top; "Fix and send again" updates it (PUT), clears the reason and puts it back in the queue. | "The team did not accept this chart", the reason, and what to do. |
| Live (`published`) | "Make a new version": opens a copy. Sending offers a new chart through the review (`replaces_id` is the live chart); the live one stays on the song page until the team accepts the new one, then the new one takes its place by itself. The API refuses a PUT on a live chart (`chords_not_editable`). | "This chart is live. It stays on the song page while the team looks at your new version." |

**What editing a published chart does (decided).** A live chart is never changed in place. "Make a new version" opens a copy; sending it offers a NEW chart that waits for the team, while the old one stays on the song page. When the new one goes live (the team accepts it, or at once when a team member sent it) the server ARCHIVES the old one: `archived_at` is set, nothing is deleted. The old chart leaves the song page, the live-chart cap and the duplicate check, and stays under "Your chord charts" with the chip "Replaced" and the words "replaced by your new version" (`replaced_by` in `/song-chords/mine`); the member gets a notice, "Replaced by your new version". Only the author's own published chart of the same song and instrument can be replaced; an id that does not fit is ignored, so a stranger learns nothing from it. If the new version is rejected or deleted, the old chart simply stays live. If the old chart is deleted before the new one is accepted, the link is cut and the new chart is just a chart. Taking the new version down later does not bring the old one back by itself; accepting a rejected new version (Publish again) archives the old one then, if it is still live. The member may delete a replaced chart (a menu item with its own question); it is the old version, hidden from everyone else.

A chart keeps its song and its instrument: the pickers are locked and the banner says why. A chart that is gone (deleted somewhere else) shows "This chart is not there any more" and a way back.

### After the decision

| Event | What the member sees |
| --- | --- |
| Approved | A notice "Your chords are live" (open it: the song page). The chart shows on the song page, in "Chords from members", with the member's name (or as anonymous), and the status chip on Upload turns to "Live". |
| Approved after a rejection | The notice says "We looked again". |
| Approved, and it was a new version | The notice "Replaced by your new version": the new chords are live and took the place of the old ones, which are kept under Your chord charts as "Replaced". |
| Rejected | A notice "Your chords were not published" with the team's reason (or a line that says to open it and see); it opens the fix screen. Under "Your chord charts" the card shows the reason in red and a "Fix and send again" button. |
| Taken down later | Same as rejected, from the status change. |

Notices come from the phone seeing a status change in `/song-chords/mine` (`lib/songChords/notices.ts`, `noticeSync.ts`; the server also writes a notice row, but the app has no inbox feed from the server yet). The first look at an account only records what is there, so a new install does not announce old decisions. The look happens when Upload opens, on launch and when the app comes back to the foreground (`components/song-chords/ChordNoticeSync.tsx`, at most once a minute). The notification centre screen is not changed: the items go through the store's own `receive`.

### Your chord charts (Upload hub)

`components/song-chords/MyCharts.tsx` (list, menu, questions, notices), `RowMenu.tsx` (the sheet), pure rules in `lib/songChords/rows.ts` (`buildRows`, `primaryAction`, `menuActions`, `actionHref`; tested in `__tests__/songChordsRows.test.ts`).

| State | What the hub shows |
| --- | --- |
| Signed out | A sentence to sign in. |
| Loading / error | A quiet loading line; an error with "Try again". If the list had loaded once and a refresh fails, the rows stay and a line says the list may be out of date. |
| No charts | "No chord charts yet" and "Offer your first chart". |
| Charts | One row for each: "PS 5 · Title", the chip (icon and text, not colour alone), a line of facts (instrument, capo, date; for a draft the number of chords; "unsent changes saved" when a fix or new version is waiting on the phone), and ⋯. Order: not accepted, drafts, waiting, live; newest first inside a group. No filters. The list reloads when the hub comes back into focus (after an edit). |
| Team | "Review chord charts" with the number waiting. |

A tap on the row does the one thing its state is for: Draft opens it, Waiting opens it for editing, Published opens the song page, Not accepted shows the team's reason.

#### Actions of a row

Every action is in the ⋯ menu (the destructive one is always last and red). "Where it lands" says what the member sees next and how to get back.

| Action | In which states | What it does | Asks first | After it | Where it lands, way back |
| --- | --- | --- | --- | --- | --- |
| Continue editing | Draft | Opens the draft in the editor | No | Nothing | Editor (`?draft=`). Close (X): if there is unsent work, "Leave this chart?" (Keep editing, Save and leave, Discard draft); then the hub |
| Edit | Waiting | Opens the chart; "Send again" replaces it and it waits again; the daily allowance is not charged again | No | "Sent again" screen | Editor (`?edit=`); same way back |
| Fix and send again | Not accepted | Opens the chart with the team's words on top; sending puts it back in the queue | No | "Sent again" screen | Editor (`?edit=`); same way back |
| Make a new version | Published | Opens a copy of the live chart; sending offers a NEW chart, the live one stays until the new one is accepted, then it is archived | No | "Sent to the team" screen, with a line that the old one stays until the team has accepted the new one and is then kept as replaced | Editor (`?copy=`); same way back |
| View on the song page | Waiting, Published, Replaced | Opens the song | No | Nothing | Song page (`/song-v2/ps-N`); the back arrow returns to the hub |
| Why it was not accepted | Not accepted | A small window with the team's words (or "The team did not write a reason...") | No | Nothing | Stays on the hub; "Close", or "Fix and send again" to the editor |
| Withdraw from the team | Waiting | Takes the chart back from the team and puts it back among the drafts on the phone (`kept:<id>`, all chords, strum, capo and note kept; the draft is made before the waiting chart is removed, so nothing is lost if the network fails). Nothing is deleted from the member's point of view. | "Take this chart back from the team?" "The team will not see it any more. The chart goes back to your drafts on this phone, with all its chords, and you can send it again when you are ready. It does not count toward your charts for the day." Buttons: Withdraw / Leave it with the team | Notice "Taken back from the team. It is in your drafts again."; on failure a red notice (offline: "No connection...") that stays until closed. If five drafts are already kept, "You already keep 5 drafts, and this chart would push one of them out. Discard a draft first, then take this chart back." and nothing happens | Stays on the hub; the row turns into a Draft row; "Continue editing" opens it |
| Delete the chart | Waiting, Published, Replaced, Not accepted | Deletes the chart for good. A separate, explicit action, always last and red; it is also in the menu of a waiting chart, for a member who wants it gone and not kept as a draft | "Delete this chart for good?" Waiting: "The chart is removed and cannot be brought back." Live: "This chart is live. Deleting it takes it off the song page for everyone. This cannot be undone." Replaced: "This is the old version. Your new version took its place on the song page, and this one is kept for you only. Deleting it removes it for good." Buttons: Delete / Keep | Notice "The chart was deleted."; red notice on failure | Stays on the hub; the row is gone |
| Discard the draft | Draft | Throws away a draft that has no chart | "Discard this draft?" with the number of chords and "Nothing has been sent. This cannot be undone." Buttons: Discard draft / Keep draft | Notice "The draft was discarded." | Stays on the hub; the row is gone |
| Throw away my changes | Any chart with unsent changes | Throws away the saved fix or new version; the chart itself stays | "Throw away your changes?" "What you changed and did not send is lost. The chart itself stays as it is." Buttons: Throw away / Keep my changes | Notice "Your unsent changes were thrown away." | Stays on the hub; the row loses "unsent changes saved" |

Good notices go away by themselves after six seconds; a problem stays until it is closed. If a delete finds the chart already gone (removed on another phone), the list drops it and says so.

### The whole chain, scenario by scenario

One row for each way into the flow. "Back" is where the member lands when it is over or when they leave.

| Scenario | Door | What the member sees | Ends in | Back |
| --- | --- | --- | --- | --- |
| New, from the hub | Upload, "Chords for a song" (`/upload-chords`) | Asks which song first (the picker), then the same form | "Sent to the team" | "Back to Upload" |
| New, from the song page | "Offer chords for this song" (`?song=N`) | The song is already chosen | "Sent to the team" | "Back to the song" first, then "Back to Upload" (quiet) |
| From a draft | Draft row, "Continue editing" (`?draft=`), or opening the screen again for the same song and instrument | Resume panel (what is saved, "Saved 2 hours ago"): Continue, Start over, "Start a new chart instead" | As a new chart | As a new chart |
| Fix a waiting or not accepted chart | Row menu (`?edit=`) | The chart, the song and instrument locked, a banner (the team's words for a rejected one) | "Sent again" | "Back to Upload" |
| New version of a live chart | Row menu (`?copy=`) | A copy, banner "This chart is live. It stays on the song page..." | "New version sent", with the note that the live chart stays | "Back to Upload" |
| Start from someone's chart | "Start from this chart" under another member's chart on the song page (`?from=&song=`) | Only the chords come over (not the capo, not the strum pattern); the note and the "I played it" box are empty; a hint says so and that the chart will say it is based on theirs | "Sent to the team" | "Back to the song" |
| Withdraw a waiting chart | Row menu on the hub | A question, then the row becomes a draft | The hub | Continue editing from the row |
| Signed out | Any door | "Sign in to offer chords" with a Sign in button; the Upload hub shows a sentence to sign in; nothing is lost | The sign-in screen opens on top; its back arrow returns here | Close (X) |
| Offline or server error | Send | The red sentence under the button ("No connection. Your chart is saved on this phone..."); the button says "Try sending again"; the draft is kept. If the words of the song cannot load, a retry button sits where they would be | Same screen | Leave: "Leave this chart?" |
| Empty states | Hub with no charts; song with no member charts | "No chord charts yet" with "Offer your first chart"; the song page keeps "Offer chords for this song" | The form | Close (X) |
| Limits | Send | Daily limit (10 in 24 hours), hourly brake (6), three open charts of one song and instrument: each has its own sentence, says the draft is kept, and where to go ("See your charts") | Same screen | Close (X) |
| Duplicate | Send | "You already sent exactly this chart. You can find it under Your chord charts on Upload." | Same screen | Close (X) |
| Cancel with unsaved changes | Close (X), Android back | "Leave this chart?": Keep editing, Save and leave (draft), Discard draft. With nothing placed there is no question | The hub or the song page | The draft is a row on the hub |
| A chart that is gone | `?edit=` or `?from=` of a deleted chart | "This chart is not there any more. It may have been deleted." and one button | The hub, or the song page when the member came from there | "Back to Upload" / "Back to the song" |

### Where Done goes

`app/upload-chords.tsx` and `app/upload.tsx` are both modal stacks. Leaving a result screen used to `replace` the route, which left the hub under it. Now: closing the editor with Back goes back when there is something to go back to (`router.canGoBack()`), otherwise to the hub (`router.dismissTo`); "Back to Upload" and Done use `dismissTo` the hub, which pops to the Upload screen that is already open, or replaces the editor with it when the member came straight from a song page; "Back to the song" and "Open the song" use `dismissTo` the song page, which pops back to the song they came from. The stack was checked in a headless browser: hub, editor, send, Back to Upload ends on a single Upload screen; a song page, editor, send, Back to the song ends on that song page.

### Rules of the server that the screens know

| Rule | Where |
| --- | --- |
| 10 charts per 24 hours for members, counting only charts that were SENT FOR REVIEW. A ledger row (`song_chord_offers`, one row for each offer, with `proposal_id`) outlives the chart, so deleting a chart that was published, rejected or replaced does not give the place back. A chart taken back while it still waits for the review (a withdraw, or a delete of a waiting chart) never reached the team: its ledger row goes with it and the place is free again. Editing a waiting chart does not charge again. The team has no daily limit. | `ensure_daily_allowance`, `_give_back_place` |
| A new version replaces the author's own live chart of the same song and instrument when it goes live; the old one is archived, never deleted. The old one does not count toward the 3-live cap once the new one is in. | `_replaceable`, `_archive_replaced` |
| "Based on" credit: the original must be another member's published chart of the same song. Only the id is stored (`based_on_id`); the name is worked out each time the chart is shown (`credit_map`), from the original as it is now: the name appears only while the original exists, is published (or was, and was replaced), is not anonymous and its author's account is there. An anonymous, taken-down or author-less original gives "Based on another member's chart" without a name; a deleted original gives no credit line at all. No name is ever kept as a snapshot (`based_on_name` is unused). | `_credit`, `credit_map` |
| 6 an hour for members (team 120), 30 edits an hour. Counted only after the chart passed every check. | `limiter.hit` inside `create_proposal` / `update_proposal` |
| 3 live charts per song and instrument; a rejected chart that comes back counts as live again. | `OPEN_PER_SONG_INSTRUMENT` |
| Someone else's chart answers 404 on change and delete, the same as a chart that is not there. | `delete_own`, `update_own` |

## Tests

- API: `apps/api/tests/test_song_chords.py` (offering, review, limits, ledger, editing, 404 for strangers, withdrawing a waiting chart, a new version beside a live one, the chord grammar, migration `0031` including `song_chord_offers`, migration `0043`, a new version replacing the old chart on approval and on a team send, the old chart archived and not deleted, the duplicate check and the live cap ignoring an archived chart, `replaced_by` in `/mine`, the credit of "Start from this chart", worked out when shown (no name once the original is anonymous, taken down, deleted or its author is gone), the daily allowance for withdrawn, deleted and replaced charts).
- App: `__tests__/songChordsDraft.test.ts`, `songChordsChordPro.test.ts`, `songChordsRemote.test.ts`, `songChordsSpelling.test.ts` (spelling, grammar, minor keys), `songChordsHub.test.ts` (draft book, entry, reveal, charts, notices, the preview and remote backends for fixing a chart), `songChordsRows.test.ts` (the rows of the hub, the menu of each state, the address of each action, the field Send jumps to, starting from someone else's chart), `songChordsRetire.test.ts` (the retired storage keys), `songChordsVersions.test.ts` (a new version, replaced rows and their menu, the draft made by a withdraw, the copy of another member's chart without capo and strum, the credit), plus `i18nParity.test.ts` for the words.

## Why this design

- **One renderer.** A proposal is stored in the model the song page already draws, so there is no second chord viewer to keep in step and no format conversion on the way to the page.
- **Words, not text.** Indexing by word survives a change of script (Devanagari, Bengali) and typing slips, and it is what the built-in chart does.
- **Sounding chords in the store, shapes on the screen.** Two players with different capos see the shapes that suit them from the same chart.
- **Several versions.** A member may keep up to 3 live charts for one song and instrument, and different members can each offer theirs. Nothing is overwritten. The song page lists them and the reader picks.
- **Honest labels.** Each chart says who made it (or "an anonymous member"), instrument, key and capo, and whether the author says they played it. The app does not check that it is musically right, and does not say it did.
- **Anonymity is for other members only.** The account stays attached so the team can deal with abuse and the author can delete their own chart. The public shape carries no name, id or avatar for an anonymous chart.

## Review

| Who sends | Result |
| --- | --- |
| Team member (`is_admin`, `is_super_admin` or one of the owner emails, the same rule as Kiirtan uploads) | published at once |
| Anyone else | `pending`: visible only to its author, with "Waiting for review" |

- The team sees the queue (Waiting, Reported, Live, Not published) in the app (`/chords-review`, signed-in team members) or with the admin key (`/api/v1/admin/song-chords`). Each card opens into the chart as the page will draw it, then Publish, Reject (a reason of at least three letters is required, and the author reads it in a notice and under "Your chord charts"), Publish again, Take down.
- A member can delete their own chart in any state, and change a waiting or rejected one (see the scenario map).
- Anyone can report a published chart (wrong chords, offensive, spam, other): one report each. A report only raises the count and moves the chart into the "Reported" filter. It does not hide the chart by itself.
- Limits for non-team members: see "Rules of the server" above. The server answers with `X-Error-Code` (`chords_daily_limit`, `chords_duplicate`, `chords_open_limit`, `chords_not_editable`) and the app turns each into a sentence.

## Test data of the preview

The web preview keeps what a person makes in the browser: chord drafts and the notices "your chart is live / not published". Charts made while testing must not outlive the test, so the version in the storage key is raised whenever the test data or the format changes. Raised now: `prabhat-chord-draft-v1` to `-v2` (`stores/chordDraftStore.ts`) and `prabhat-chord-notices-v1` to `-v2` (`stores/chordNoticeStore.ts`). `lib/songChords/retireTestData.ts` removes the two old keys once on the next load and drops the `chords:` notices of the old tests from the inbox (other notices stay). The demo seed charts live in `lib/songChords/mock.ts`, are made again on every load, are stored nowhere, and were not touched. Next time: change the key's version in the store and add the old key to `RETIRED_KEYS`.

## Web preview

With `EXPO_PUBLIC_MOCKUP_DATA=1` the screens use an in-memory server (`lib/songChords/mock.ts`) that keeps charts until the page is reloaded, with two sample charts on PS 1 and, for the previewing member, one chart in each state (waiting PS 2, live PS 3, not accepted PS 5). Add `?team` to the address to act as the team and try the review screen; add `?empty` to see the Upload hub with no charts; add `?guest` to see the screens as someone who is not signed in; add `?fail=network` (or `dailyLimit`, `slowDown`, `duplicate`, `tooMany`, `invalid`, `signin`, `server`) to make every send, fix and delete fail that way; add `?failList` to make the lists fail as if offline; add `?replaced` to see the member's live chart already replaced by a newer version (the old one as a "Replaced" row). These switches are read in `lib/songChords/backend.ts` and only work with the in-memory server. `/phone.html` shows the app in a 390 by 844 frame with a 59 point top and 34 point bottom inset, like a phone with a notch. The real server is never contacted in that mode.

## Not verified

- No run against a real PostgreSQL. The API tests run on SQLite, and the migration `0031` was written by hand and read, not applied to Postgres.
- Not tried on a phone or in a simulator: the touch feel of the tap editor and the chord sheet (the drag, rubber band and fling were reasoned from the spring helpers and seen only in the web preview), the keyboard over the sheet's "Type a chord" field and the paste box (`useAnimatedKeyboard` on iOS, window resize on Android), and the top inset of the three screens on a real notch and on Android. The preview frame at 390 by 844 simulates the insets; the code reads them from `useScreenTop`.
- The rate limiter of the API lives in one process (it resets on restart and is not shared between instances); the daily allowance is in the database and is not affected.
- The real song picker (`PsSongChooser`) was not driven in the preview; the screens were opened with `?song=1`. The scenario "New, from the hub" was therefore seen only up to the picker.
- Migration `0043` was run on SQLite (the tests) and read for PostgreSQL, where it adds real foreign keys; it was not applied to a PostgreSQL database. Another migration (`0044`, practice and an optional set date, not part of this work) is written on top of it.
- The credit "Based on a chart by <name>" links to the original only when that chart is on the same song page and instrument tab; otherwise it is plain words.
- Team flows against the real API (the review endpoints for signed-in team members, notices to authors) are covered by API tests but were not tried end to end from the app.
- Russian and Spanish words have not been read by a native speaker (marked unreviewed in `locales/review.json`, including the new words for replaced charts, the credit, and the full drafts book).
- Chord content inside songs is English only for now; the screen words follow the usual i18n.
- The chart on the song page is drawn in Roman letters even when the page's main script is Devanagari or Bengali; the built-in chart follows the page script, the member charts do not yet.
- The song page's own transposition (`spTranspose`) still respells a chord with a fixed table (G#m shown as Abm when it moves); only the editor and the stored chart keep the author's spelling.
- Chords on the page are not played back and not checked for being musically right.
