# Recording extras: comments, chords and videos

Every recording in the app (Kiirtan, Bhajan, Spiritual song, Dance song, Prabhat Samgiita recording) now has a page of its own, `/recording/<id>`. The page carries three things members can add to: **comments**, a **chord chart**, and **video links**. Video links also work on a Prabhat Samgiita song page, in its Recordings section. This note says what the data looks like, what the API does, what the limits are, how moderation works, why some choices were made, and what is **not** built or not checked.

Code: API `apps/api/app/api/v1/recording_comments.py`, `recording_chords.py`, `video_links.py` (services in `app/services/`, models in `app/models/recording_extras.py`, migration `0034_recording_extras`, tests `tests/test_recording_comments.py`, `test_recording_chords.py`, `test_video_links.py` with the shared fixture `tests/extras_support.py`). App `app/recording/[id].tsx`, `app/recording-chords.tsx`, `components/recording-extras/`, `components/comments/`, `lib/recordingComments/`, `lib/recordingChords/`, `lib/recordingVideos/`, `lib/recordingExtras/`, `stores/recordingChordsPendingStore.ts`, words in `locales/recordingExtras.ts`.

## Where things are

- **The recording page.** Header (title, who sang it, kind), a Play button, then three blocks in a calm stack: Chords (a summary and "Open chords"), Videos (list and "Add a video"), Comments. Sheets (the chord viewer and the add-a-video sheet) sit at the page root, outside the scroll view, so they cover the page and not a part of it.
- **The full player.** The player screen keeps its fixed height. For a published Kiirtan it only gets two more rows in the More sheet: "Chords" (opens the chord sheet right there) and "Comments, chords and videos" (closes the player and opens the recording page). Nothing was added to the player body.
- **The mini-player never covers content.** `lib/playerPolicy.ts` lists `/recording` with the Kiirtan pages (the mini-player stays, the page keeps bottom room for it) and `/recording-chords` with the upload form (the mini-player hides, as it does for every form with a keyboard). `docs/player-visibility.md` is changed to match, and `__tests__/playerPolicy.test.ts` still passes.
- **Upload.** The add-Kiirtan form, every row of the file queue and every track of a set have a collapsed row: "Do you know the chords? Add guitar chords". It is optional and closed by default.
- **The hub** (`/upload`) has a new section, "Your recording chords", under "Your chord charts" (which is unchanged): state, the reason if the team declined, open, change, delete.
- **PS song page.** A Videos block under Recordings (or before the comments when a song has no recordings yet).

## Data model

One migration, `0034_recording_extras`, six tables. All of them hang off `recordings.id` or a song number, and none of them touches an existing table.

| Table | What it holds |
| --- | --- |
| `recording_comments` | one comment under a recording: body (up to 2000), anonymous flag, status, reports count, who removed it and why |
| `recording_comment_reports` | one report per reporter and comment (unique), reason, note |
| `recording_chord_sheets` | one chord chart: recording, member, instrument (`guitar` or `harmonium`), optional key, plain-text body (up to 8000 characters, 250 lines, 120 per line), chord count, "I played it", optional note (300), anonymous flag, status `pending`, `published` or `rejected`, reports count, review data |
| `recording_chord_reports` | one report per reporter and sheet |
| `video_links` | one video: target (a recording or a song), provider (`youtube`, `vimeo`, `archive`), the video's own id, the rebuilt https address, optional title (80), member, anonymous flag, status `published` or `removed`, who removed it and why |
| `video_link_reports` | one report per reporter and video |

Deleting a recording deletes its comments, sheets and video links with it (`ON DELETE CASCADE`). A member's own deletion leaves a tombstone for comments (see below) and a wiped row for videos, both marked in `removed_by` with a reserved author-delete marker.

### Why a new table for chord sheets, and not `song_chord_proposals`

`song_chord_proposals` stores a chart as **placements**: "this chord starts on word 3 of line 7 of song 1234". That only works because a song has fixed lyric lines the app knows by heart. A recording has no lyric lines in the app: it may be a Kiirtan with three words repeated, a Bhajan in another language, a talk-song nobody has typed. There is nothing to hang a placement on.

So a recording sheet is a **plain-text chart**: the chords on a line of their own over the words, or `[Am]` inside the words, kept exactly as typed. The server cleans it (invisible characters, control characters, line limits), checks it holds real chords (see "What counts as a chord chart" below), and keeps it. Putting this into the song table would have meant either a nullable song number and a nullable lines column (two shapes in one table, a check constraint for each, every query filtering on both) or inventing fake lyric lines. A separate table keeps the song proposals untouched, lets each table keep a strict shape, and lets the review queue and the hub query one shape at a time.

What is shared is the **ledger**: the daily and hourly allowance for chord offers is the same as for song chords (the same `song_chord_offers` ledger and the same limiter bucket), so one member cannot double the allowance by using both kinds. The chord-name grammar (`CHORD_PATTERN`) and the reviewing rules are the song proposals' own, imported.

### Why the comment allowance is asymmetric

Comments on a recording and comments on a song share **one** hourly limiter (the song comments' own, imported) and one daily number (20 in 24 hours), but the daily count is **not symmetric**:

- Posting under a **recording** counts the member's recording comments **plus** their song comments from the last 24 hours (`ensure_daily_allowance` in `services/recording_comments.py`).
- Posting under a **song** counts song comments only (the song side is the older code and was left alone).

So 20 song comments use up the day for recordings too, while 20 recording comments leave the song side open. Why it is built this way:

- The recording side is new code and can look at both tables, so one person cannot double the allowance by using both doors from the recording page.
- Making the song side count recordings as well would mean changing the song comments' service and its tests, which are not part of this work. That is the one-line follow-up if the asymmetry matters: add the recording count to `song_comments.ensure_daily_allowance`.
- The shared hourly limiter makes a burst on both doors hard either way.

Deleting a comment does **not** refund the allowance (removed and author-deleted comments still count).

## API

All under `/api/v1`. Every call needs a signed-in member except two kinds, which are open: the reads (a read adds the viewer's own "mine" flags when signed in) and the three report calls (comment, chord sheet, video), which a signed-out visitor may make too (see Reporting below). IDs are UUIDs for recordings and 1..5018 for songs.

**Comments** (`/recording-comments`)
- `GET /recordings/{id}` list, newest first, with tombstones; `total` pages through them, `live_total` is the count to show.
- `POST /recordings/{id}` post (body, anonymous). 201.
- `DELETE /{comment_id}` author deletes their own, or the team removes (with a reason). 204.
- `POST /{comment_id}/report` report (reason, optional note).
- `GET /reported` team only: reported comments with the author, even if anonymous.

**Chord sheets** (`/recording-chords`)
- `GET /recordings/{id}` published sheets, plus the viewer's own pending or rejected ones.
- `GET /mine` the signed-in member's own sheets (for the hub).
- `POST /recordings/{id}` offer a sheet. Team: published at once. Everybody else: `pending`.
- `PUT /{sheet_id}` change a waiting or rejected sheet of your own (a published sheet is changed by offering a new one and deleting the old, as with song chords).
- `DELETE /{sheet_id}` delete your own sheet for good.
- `POST /{sheet_id}/report` report (`wrong_chords`, `offensive`, `spam`, `other`).
- `GET /review/queue`, `POST /review/{id}/approve|reject|restore` team only.

**Video links** (`/video-links`)
- `GET /songs/{song}` and `GET /recordings/{id}` list.
- `POST /songs/{song}` and `POST /recordings/{id}` add (url, optional title, anonymous). 201.
- `DELETE /{video_id}` author deletes their own, team removes with a reason.
- `POST /{video_id}/report` report (`broken`, `not_about_this`, `offensive`, `spam`, `other`).
- `GET /review` and `POST /{video_id}/restore` team only.

A removed or unknown recording is a plain 404 on every call, so nobody learns a removed recording ever existed.

## Limits

| What | Limit |
| --- | --- |
| Comment length | 2000 characters, at most 2 links |
| Comments per member | 20 per 24 hours, 10 per hour (team: 120 per hour, no daily cap) |
| Chord sheets per member | 10 per 24 hours, 6 per hour (shared with song chord offers; team: 120 per hour, no daily cap) |
| Live chord sheets | 3 per member per recording and instrument (pending or published) |
| Chord sheet size | 8000 characters, 250 lines, 120 characters a line, at most 2000 chords; at least one real chord, and more than one lonely plain letter (below) |
| Chord sheet note | 300 characters, no web links |
| Videos per recording or song | 12 live |
| Videos per member per target | 3 live |
| Videos per member | 10 per 24 hours, 5 per hour (team: 60 per hour) |
| Video title | 80 characters; video address 300 |

Rate limits are checked **after** the input is validated, so a bad request never uses up an allowance. Deleting something never gives allowance back.

## Moderation

**Publish first, review after** for comments and videos. **Review first** for chord sheets, as for song chords: a team member's sheet is live at once, everybody else's waits as `pending` until the team approves or rejects it (a rejection carries a reason and sends the author a notice).

- **Reporting** is one rule for all three kinds. Signed-out visitors may report, exactly as under a Prabhat Samgiita song (the API keys a signed-out report by the caller's address; rate limited per address and per member). **Nobody reports their own item**: a comment, a chord sheet or a video of your own answers `422` ("This is your own ... You can delete it.") and the app shows Delete instead of Report. One report per person and item, with a reason. A report does not hide anything by itself; it puts the item in the team's list.
- The team can **remove** a comment or a video (with a reason) and **restore** a video or a sheet. A team-removed video cannot be re-added by a member: the address stays refused (`video_team_removed`), so a removed link does not come back under a new account.
- **Tombstones.** A comment its author deletes stays in the list as a tombstone: `deleted: true`, no text, no author, no id of a person, nothing to report or remove, and it shows as one quiet line ("Deleted by the author"). The text is wiped on the server. A **team removal leaves nothing** for readers: the comment just goes. (The song comments' own delete currently removes the line entirely; only recordings keep the tombstone.) A tombstone is counted in the page size (`total`, which drives paging) but not in the "N comments" count: the list answer carries `live_total`, the number of comments people can read, and the phone shows that number (it stays exact when only the first page is loaded, and after posting or deleting).
- **How the author's own delete is told from a team removal.** `removed_by` holds a reserved marker for an author delete (it starts with a control character). A team removal stores the member's display name with control characters stripped, so no name, not even one spelled `author`, can look like an author delete. Migration `0036_author_delete_marker` rewrites older rows that held the plain word.
- **Anonymous means hidden from members, not from the team.** The public view of an anonymous comment, sheet or video carries no author, no avatar and no id that links it to a person (`public_out`). The team sees who wrote it (`admin_out`) and the app says so next to the toggle.
- **Strangers' text.** Bidi and zero-width characters are stripped, control characters are dropped, spaces are collapsed. Nothing is rendered as HTML. The comment box (shared with the song comments) says "at most two links" **while the person types**, so a shut Post button is never a mystery.

## Videos: the provider allow-list

A video link is **link-out only**. The app shows the title (or the site name), who added it, and a button that opens the address in the system browser or the YouTube app. Opening goes through `openExternal`, guarded by `safeToOpen`.

The allow-list is short: **YouTube** (`youtube.com`, `m.youtube.com`, `youtu.be`, the no-cookie host), **Vimeo**, **Internet Archive**.
- YouTube is where nearly all Kiirtan and Prabhat Samgiita video lives.
- Vimeo is the other common home of a team's own films.
- Internet Archive has permanent addresses and keeps old film and audio nobody else keeps.

Everything else is refused: Facebook, Instagram and TikTok need a login and track the viewer; short-link services hide where a link really goes; a site of the sender's own can change tomorrow into anything. Adding a site is one entry in `video_links.py` and one in `lib/recordingVideos/`, in the same commit.

How a link is handled:
- **https only.** `http://`, `javascript:`, `data:` and the like are refused. No user info, no odd ports.
- **Rebuilt, not stored as pasted.** The server takes the site and the video's own id from the link and builds the canonical address itself (`https://www.youtube.com/watch?v=<id>`, `https://vimeo.com/<id>`, `https://archive.org/details/<id>`). Tracking parameters, playlists and time marks are dropped. The same video pasted in three shapes is one video.
- **De-duplicated** per target (`video_duplicate`).
- **Never fetched.** The server does not open the address: no download, no scraping, no preview request, so a link cannot make the API call an address of the sender's choosing, and the page shows only what the member typed (a title) and the site name.
- The phone runs the same parser for instant feedback; the **server has the final say**.

### In-app embed: the decision

Member links are **link-out only**. An embed would run a stranger's page inside the app, load a third party's scripts and cookies for every viewer, and stop working the day a site changes its embed rules. The app already has one embed, `WatchVideoCard`, used for the **curated** Prabhat Samgiita videos the team chose; it stays as it is. Making member links embed later is a small change (the id is stored) but it is a decision about trust, not code, so it is left to the owner.

## Chords: how it works

**At upload.** The prompt is a collapsed row on the add-Kiirtan form, on each queue row and on each set track: instrument (guitar or harmonium), an optional key, a monospace box for the chart, an optional note, "I played or checked these chords" and "Share without my name". It is optional and the upload never waits for it.

Because a recording only gets its server id **after** it is published, the chart is kept in `stores/recordingChordsPendingStore.ts`, keyed by queue row or set track, and sent once the upload outcome says "published". If the send fails, the upload is **not** failed: the draft stays, the row says the chords were not sent, and "Try again" sends it. A recording that is held for review is sent when it is published.

**Reading.** The "Chords" button on the recording page and in the player More sheet opens the chord sheet: instrument pills, one pill per chart, the chart in a monospace face with the chords picked out in the accent colour, a transpose stepper (plus and minus a semitone, up to 11 either way, the shown key moves with it), who made it, their note, "I played it", and Report or Change or Delete. The chart is **static**: no timing, no scrolling with the song. Timing was not asked for in v1 and is never guessed.

Transposing (`lib/recordingChords/transpose.ts`) reads a line as chords when every piece is a chord name, and handles `[Am]` inline marks too. A moved chart is written in **one** convention, never C# beside Bb: **flats** when the chart's key or any chord is written with a flat, or when the key it lands in is a flat key by convention (F, Bb, Eb, Ab, Db, Gb, and Dm, Gm, Cm, Fm, Bbm, Ebm); **sharps** otherwise. The landing key is the chart's key moved, or, with no key given, the first chord moved. At zero nothing changes, so a chart keeps its author's own spelling until moved. Words are never touched. (Em up one step becomes Fm Db Bbm Ab Eb Fm, not a mix.) The song page's own transpose (`spTranspose`) is not part of this work and was not changed.

### What counts as a chord chart

A body is accepted when it holds chords AND is more than one lonely plain letter. "A" alone is also an ordinary word, so a body of just "A" (or "A" and "A") is refused with its own sentence. Accepted: at least **two different** chords ("A" and "G"), or **one chord that is plainly a chord**: a quality, a number or a bass note (Am, G7, Cmaj7, D/F#). So real minimal charts such as "Am" over a line, or "Am" and "G", pass. The note under a chart takes no web links, like the chart and a video title. The phone applies the same rules for instant feedback; the API has the final say.

**Open decision for the owner:** a one-chord chart written as a plain letter (a drone kiirtan on just "G", "E" or "Bb") is refused too. The refusal sentence names the way out (write the chord in full: G5, Gsus4, Gmaj7 all pass). Whether such a chart should pass is not decided here.

**Adding or changing later.** "Add your own chart" in the viewer, or the Chords block, opens `/recording-chords?recording=<id>` (a modal). The same form, the same checks, a sent screen that says whether the chart is live (team) or waiting. "Change" opens it with `edit=<sheet>` for a waiting or rejected chart.

**The font exception.** The chart is the one place that does not use Roboto: a chord chart only works in a **fixed-pitch** face, where a chord stands exactly over a syllable. The platform monospace (`Menlo` on iOS, `monospace` on Android and the web) is used. No monospace font is bundled, so the app grows by nothing. Everything around the chart stays Roboto.

## What is NOT built, and what was not checked

Not built:
- **A team review screen for pending recording chord sheets in the app.** The API has the queue and the approve/reject/restore endpoints and they are tested, but there is no screen yet. Until there is one, the team can use the API, and a team member's own sheets publish at once.
- **A team screen for reported comments and videos** in the app (API only, same reason).
- **Chord timing**, word alignment, capo or strum fields, diagrams of finger shapes, or a count-in. A chart is text.
- **Editing a published sheet in place.** To change a live chart, offer a new one and delete the old one.
- **Notifications** for comments or videos. Only the existing notice for a rejected or published chord sheet.
- **Embedding member videos**, previews, thumbnails, titles read from the site (see above).
- **Likes, replies or threads** on comments; comments are flat, as under songs.
- **Chords saved across an app close.** The pending-chords store is **in memory only**. If the app is killed between "published" and the send, the chart typed at upload is lost and the member has to add it again from the recording page. This was chosen over writing a half-typed chart to disk (a second place a private note can leak from, and a second retry queue). The upload itself is never affected.

Not checked:
- Everything on the API side ran on SQLite in tests. **PostgreSQL** (the real constraint behaviour, the migration upgrade and downgrade) has not been run.
- The app was checked in the web build with sample data (`EXPO_PUBLIC_MOCKUP_DATA=1`) at 1440, 768 and 390 pixels, with no console errors. It has **not** been run on a phone, so the monospace face on iOS and Android, the hardware back button on the sheets and the system browser hand-off are untested on a device.
- The new rows of the player More sheet are covered by unit tests; they were not seen on screen for a Kiirtan (the preview player holds a Prabhat Samgiita song, which does not get them).
- Uploads and audio against the real object store (R2) were not exercised; chords at upload only need the recording id.

## Tests

API: `pytest tests/test_recording_comments.py tests/test_recording_chords.py tests/test_video_links.py`. App: `npx vitest run` (`recordingComments`, `recordingChords`, `recordingChordsPending`, `recordingVideos`, `recordingExtrasLinks`), plus `i18nParity` for the three languages.
