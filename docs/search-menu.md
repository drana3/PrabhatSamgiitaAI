# Search browse menu: blocks, adaptive rules, themes

Status: **built and wired** (round 3). Dada chose **variant D on top of A** (a "Listen again" strip from the phone's own history,
then stacked shelves block by block). The pure rules module is `apps/mobile/lib/searchMenu/*`; the live data layer is
`lib/searchMenu/live.ts` and `hooks/useSearchMenu.ts`; the screen is `components/search-v2/SearchMenuView.tsx` inside
`app/search-v2.tsx`; "See all" opens `app/browse-shelf.tsx`. Boards of every state: `Для-Дады/поиск-v2/`.
The decisions of round 3 are in section 9. Older layout boards: `Для-Дады/поиск-меню/`.
This page extends `docs/search-scenarios.md` (what Search does and where every control leads).

## 1. What the menu is

The idle state of Search (`/search-v2`, nothing typed) shows a browse menu split into blocks. It is **prepared in advance** and it
**adapts by itself**: a shelf appears when the data behind it is big enough, and disappears when it is empty. People never see a
shelf with nothing in it, and never see a number the app did not count.

| # | Block | What is in it | Where the data is today |
|---|-------|---------------|-------------------------|
| 0 | Pulse (top) | New this month, Most played | `recordings.created_at`; play counts (see 4) |
| 0b | Baba's voice | One shelf, "Baba's Audio Discourses" (kind `baba_audio`); also on Today with "See all" | `recordings.kind = baba_audio` |
| 1 | Prabhat Samgiita | The real collections (moods, festivals, themes, occasions, seasons, languages) and, when there are enough, performances of PS songs | `lib/searchBrowse.ts` (collections), recordings of `kind = prabhat_samgiita` |
| 2 | Kiirtan | Categories by **type** (Baba Nam Kevalam, Lila, Festival, Other), "Events and retreats" (sets uploaded together), and "Indian Kiirtan by style" (Bengali, Hindi, Brajabuli, Dhrupad-flavoured, Folk, Other) | `recordings.type`, `recordings.collection_id`, `recordings.style` |
| 2b | Kiirtan for piano | One shelf, "Kiirtan for piano": recordings with accepted piano notes or whose lead instrument is the piano. No pinning, no empty state. Also a row on the Kiirtan tab | `GET /piano-notes/recordings` (ids with live notes), `recordings.lead_instrument = piano` |
| 3 | Kiirtans by authors | One shelf per author, named by the author | `recordings.author` (text) |
| 4 | Spiritual songs | One shelf | `recordings.kind = spiritual_song` (API has it; the phone's kind list does not yet) |
| 5 | Bhajans by language | One shelf per language that has Bhajans, then a "More languages" shelf, then types (morning, evening, devotional) | `recordings.language` (ISO code), `recordings.type` |
| 6 | Moods | The six moods (Joyful, Longing, Calm, Ecstatic, Devotion, Sad) as one row of chips, only for moods with enough confirmed recordings (section 6) | the tags do not exist yet (section 9.4) |

**Update of 9 Nov 2026 (wins over the rows above).** Block 2 is Baba Nam Kevalam only. Guru Puja, Pitr Yajina and the other mantras
of Ananda Marga are their own kind, `other_mantra`, shown as "Others": one tab chip of their own and, from the first recording, one
shelf per choice (`mantra:type:<id>`: Guru Puja, Pitr Yajina, Samgacchadhvam, Nityam Shuddham, Ananda Sutram, Shlokas, Something
else; block "Others", `docs/others-category.md`), counted and listed like every other kind, never mixed into the Kiirtan shelves. The style and mood fields are lists (`recordings.styles`, `styles_other`,
`moods`, `moods_other`; old rows read as a list of one): a style or mood shelf counts a recording once for each of its tags, and a
person's own word appears on a shelf only after the team accepted it (`docs/kiirtan-recording-info.md`). The shelf "Indian Kiirtan by
style" now lists the new styles (Indian style, Electronic, Acoustic guitar, African, Western); a recording that still carries an
old id (Bengali, Hindi, ...) keeps its place under that name.

### Honest limits of the data (nothing is invented)

* **"Indian Kiirtan" is now a field: the optional style.** A Kiirtan is Baba Nam Kevalam, so it has no sung language; the
  uploader may name an Indian style (a short list plus "Other"). Round 3 added `recordings.style` and `style_other` (Kiirtan
  only). A style shelf appears at 3 Kiirtans of that style (section 9.2). Types, authors, event sets and years stay as before.
* **Bhajan languages** come from the ISO code the uploader chose. Rows without a language, and "other", are not a language shelf;
  they go into "More languages" so no Bhajan is unreachable.
* **Authors** are free text typed by the uploader. The rules treat "Priya Devi", "priya  devi" and the first name of
  "Arun & Priya Devi" as the same person (`splitAuthors`/`artistKey` of `lib/kirtan/artists.ts`). Until the author-profile work
  links a recording to a profile, a misspelt name is another author. That is a limit of the data, not of the rules.
* The six **mood lists** of the Songs shelf (Longing, Devotion...) are curated keyword lists over the 5,018 PS songs. They are
  a different thing from the Kiirtan **themes** of section 6, and the two never mix on one shelf.
* The bundled app has no recordings at all. Every recording shelf is empty on a fresh install until the API answers.
  In the mock-data preview only, a small "Demo" tag marks shelves filled from sample data (`searchMenu.demo`).

## 2. The adaptive rules

The module is `buildMenu(stats) -> { shelves, memory, hidden, authorsTitleKey }`. Same input, same output; no clock, no
storage, no network inside. `aggregateRecordings(recordings, now, extra)` makes the `stats` from the recordings the app holds.
All numbers live in `lib/searchMenu/config.ts` (`MENU_RULES`). **Thresholds below are proposals for Dada to change; a change is one number.**

### 2.1 Thresholds (on = appears, off = may leave)

| Shelf | Appears when | Leaves when | Items shown |
|-------|--------------|-------------|-------------|
| PS collections | always, if the collection is not empty | when empty | all |
| Performances of PS songs | 3+ recordings | under 2 | 12 |
| New this month | 3+ recordings created in the last 30 days | under 2 | 12 |
| Most played | real play counts: 5+ recordings with plays and 50+ counted plays in all | counts missing | 10 |
| Kiirtan type | 3+ Kiirtans of that type | under 2 | all, newest first |
| Events and retreats | 2+ sets with 2+ tracks each | under 1 | all |
| Author (popular) | 3+ published recordings AND 5+ distinct listeners in 30 days | see hold | 12 |
| Author (you listen) | you played them 5+ times over 3+ different recordings in 60 days, and they have 2+ recordings | see hold | 12 |
| Author (cold start) | no listener counts anywhere yet: 5+ recordings | see hold | 12 |
| Spiritual songs | 3+ | under 2 | all |
| Bhajan language | 3+ Bhajans in that language | under 2 | all |
| More languages | 3+ Bhajans in languages past the top five, or with "other" | under 2 | all |
| Bhajan type | 3+ | under 2 | all |
| Theme (mood) | 3+ recordings that carry the mood (section 10) | under 2 | all |
| Baba's Audio Discourses | 1+ recording | under 1 (empty) | all, newest first |
| Kiirtan for piano | 1+ Kiirtan with accepted piano notes or a piano lead instrument (`MENU_RULES.kiirtanPiano`) | under 1 (empty) | all, newest first |
| Kiirtan style | 3+ Kiirtans of that style | under 2 | all, newest first |
| Style typed under "Other" | 3+ Kiirtans carry the same typed name (spelling variants count together); fewer stay inside "Other styles" | under 2, after the hold | all, newest first |
| Dance (Dance music) | 3+ recordings of that dance | under 2 | all, newest first |
| Any other facet value (tempo, solo or group, occasion, event name ...) | 3+ recordings carry it; at most 6 values per facet | under 2 | all, newest first |

### 2.2 Windows

* "New": `created_at` within **30 days** (not `published_at`: a recording uploaded in a batch is new when it arrives).
* "Popular" and "Most played": **30 days** of counted plays (`play_daily`); until daily counts exist, the lifetime counter
  `recordings.plays` is used and the shelf says "Since the start" instead of "In the last 30 days". The screen must show which.
* "You listen": **60 days**, from a small log kept **on this phone only** (author key, recording id, day). Never uploaded.

### 2.3 Maximums and order

* At most **14 shelves** in all. Over the cap, **the shelf with the fewest recordings goes first** (a tie: the one lower in
  the block order). Pinned shelves, Baba's voice (it stays even at one recording), the Prabhat Samgiita collections (one tile
  grid) and the mood chips (one row) are never dropped, and the last two do not use up the 14.
* Authors: at most **4** shelves, at most **2** of them personal, at most **3** in cold start. Languages: top **5** plus "More languages". Moods: **8**. Any other facet: **6** values each.
* Blocks come in a fixed order (pulse, Baba, Prabhat Samgiita, Kiirtan, authors, spiritual, Bhajans, Dance music, More ways to listen, moods). Inside a block: pinned first, then "you listen" shelves, then shelves that were already
  visible (in their old order), then newcomers by score. Scores: authors by distinct listeners (then recording count), languages
  and types by count, Kiirtan types by count with "Other" last.
* The module returns **counts, not recordings**. Which items sit on a shelf (newest first, most played first) is the screen's query.

### 2.4 Anti-flicker

* **Two thresholds.** A shelf needs `on` to appear and falls only below `off` (on > off). A shelf at the edge does not blink.
* **Hold.** A shelf that appeared stays at least **7 days** unless it is empty. Empty hides it at once: an empty shelf is a dead end.
* **Stable order.** Shelves that were visible keep their relative order; a newcomer is inserted by score. The module returns
  `memory` (`shown` times, `order`) for the phone to store and pass back.
* **Compute once per app start**, not on every render, so the menu does not move while a person looks at it.

### 2.5 Cold start

With no recordings the menu shows only block 1 (the real collections), exactly what Task 1 of Search already does. With some
recordings but no listener counts: New this month (if 3+), Kiirtan types, **catalogue** author shelves (5+ recordings, at most 3,
block titled "Kiirtans by author", not "popular"), Spiritual, Bhajan languages. Most played and "popular" wait for real counts.
The block title is chosen by `authorsTitleKey`: "popular" only when at least one author shelf is backed by listener counts.

### 2.6 Honesty and non-manipulation

* A shelf is never filled with made-up items, made-up counts or recordings from another category. Under threshold means absent.
* "Most played" and "popular" use **counted plays by distinct listeners** (`play_events`/`play_daily`: 30 seconds of real
  listening, one count per listener per recording per day, the owner's own plays excluded). A shelf of authors needs **5 distinct
  listeners**, so one person looping a track cannot create a "popular author".
* No pay-to-rank, no hidden boosts. The only human lever is the **team pin** (below), and a pinned shelf is marked in the team tools.
* The "you listen" shelves read a log that stays on the phone; the server learns nothing new.
* Ties break by name, so the order is the same for everyone with the same data.
* The numbers on the page are the numbers the rules used. No rounding up, no "trending" label without a counted reason.

### 2.7 Team pins

The team may pin up to **3** shelves (for example a festival set during a festival). A pinned shelf skips the thresholds but not
the "not empty" rule, goes first in its block, counts toward the 14, and shows "Chosen by the team". Stored in a tiny table,
`search_menu_pins` (shelf id, position, who pinned, when); the API is `GET /api/v1/search-menu/pins` (public, the phone reads it
at most once a day and keeps the last list for offline) and `PUT /api/v1/admin/search-menu/pins` (team only, replaces the list,
at most three ids, an id is lowercase letters, digits, `:`, `_`, `-`). There is no team screen for it yet (section 9.5).

## 3. Data the rules need

| Need | From | State |
|------|------|-------|
| Published recordings with `kind`, `type`, `language`, `author`, `created_at`, `collection_id` | API `GET /recordings` | exists |
| Lifetime `plays` per recording | `recordings.plays` | exists (a counter) |
| Counted plays per recording per day | `play_daily` (author-profile work, `apps/api/app/models/author_profiles.py`) | in progress (not committed when this was written); read-only for Search |
| Distinct listeners per author, 30 days | derived from `play_events.listener_key` (`services/author_stats.py` `estimate_distinct`) | in progress; the menu must call a cached aggregate, never scan events |
| One endpoint for the menu counts | e.g. `GET /recordings/menu-stats` returning exactly `MenuStats` minus `listener`/`pins`/`memory` | to build; cache 15 minutes like the author snapshots |
| This listener's plays by author and language | a small local log on the phone | to build; today the app keeps only the last 12 played songs |
| Confirmed theme tags per theme | `recording_tags` (section 6) | to build |
| Team pins | table or remote config | to build |

Until the endpoint exists the phone can fill `stats` from the recordings it already loaded (`aggregateRecordings`), which is correct
for small libraries and wrong for large ones (it only counts what was fetched), so the endpoint is the real source.

## 4. "New this month" and "Most played"

Dada likes both. They come back as the **Pulse** block at the top.

* **New this month** works today: it is `created_at` in the last 30 days, shown when there are 3 or more. No fake data.
* **Most played** needs counts. Today there is only the lifetime counter. Rule: it appears only when the counts are real and
  there are enough of them (5 recordings with plays, 50 plays in all); then it shows the top 10 and says "Since the start" or
  "In the last 30 days". Before that it is absent, not empty and not faked. In the mock-data preview it may show sample numbers
  under a "Demo" tag.

## 5. Layout variants (Dada picks one)

Boards: `Для-Дады/поиск-меню/`. All four use the same real content and the same rules; only the structure differs.

| Variant | Structure | Best for | Would touch |
|---------|-----------|----------|-------------|
| A | Stacked horizontal shelves with headers, block title above each group | the most content visible, familiar | new `BrowseShelves.tsx`; replaces the tile grid in `BrowseBlocks.tsx` |
| B | Big category tiles grouped by block, chips for small groups | quick scanning, fewer scrolls, tap opens a list page | tile grid per block in `BrowseBlocks.tsx`; a list page per tile (`/collections-v2` already exists for PS; Kiirtan and Bhajan pages need a recordings list route) |
| C | Tabs by block (Prabhat Samgiita, Kiirtan, Bhajans, Spiritual), shelves inside | many shelves without a long page; one block at a time | tab strip in `search-v2.tsx` and one view per block |
| D | A pinned "For you / Trending" strip on top, then A | rewards listening, shows adaptation most clearly | strip component plus the personal log; otherwise A |

Every variant needs a recordings list page for Kiirtan types, authors, languages (`kind` + `type`/`author`/`language` filters on the
existing recordings list). Search-v2 and `lib/searchBrowse.ts` are the only existing files touched; no main file is rewritten.

## 6. Themes of Kiirtans (sad, joyful ...)

Dada does not know how to decide that a Kiirtan is "sad" or "joyful". The honest answer: nobody can do it by machine reliably, and
the right label is a human judgement that people disagree about. Six mechanisms compared:

| | Mechanism | Accuracy | Effort | Abuse | Cost | Verdict |
|-|-----------|----------|--------|-------|------|---------|
| a | Uploader picks from a fixed list (with "I am not sure") | good when the uploader knows the piece; blank otherwise | low | low (self-label of own upload) | none | good first step |
| b | Listeners vote or suggest, with thresholds | good at scale, empty at the start | medium | needs rate limits, one vote per member | none | good as a check, bad alone |
| c | Team curates a short official list | highest | high per recording, low for a **list of themes** | none | team time | needed for the **list** and for overrides |
| d | Automatic audio analysis (essentia, librosa) | poor: valence of devotional music is unreliable (tempo and mode do not map to feeling; many joyful Kiirtans are slow and minor) | high | none | server | do not use as a label; at most an experiment |
| e | AI suggestion from title and description, a human confirms | weak: Kiirtan titles are mostly the mantra and a name | medium | low | API cost | skip for now |
| f | Hybrid: uploader suggests, listeners confirm, team can override | good and honest | medium | handled by thresholds | none | **recommended** |

### Recommendation: (f), built on (c)

1. **The team fixes the short list of themes** (for example 5 to 6: joyful, longing, calm, ecstatic, devotion, surrender; Dada and
   the team decide the words, the module takes them as data). Fewer, clearer themes are more reliable than many.
2. **Uploader suggests** one or two themes, or "I am not sure". "Not sure" is a normal answer and means no tag.
3. **Listeners confirm.** After a *counted* play of that recording, a signed-in member can tap "Yes, this fits" or "No" on a theme.
4. **Rule:** a tag becomes **confirmed** when the uploader suggested it and at least **3 distinct members** voted yes with at least
   70 percent yes; or, if the uploader suggested nothing, when **5 members** suggested the same theme with 70 percent agreement.
   It becomes **rejected** under 30 percent yes after 5 votes.
5. **The team can override** any tag (confirm or reject) and lock it; locked tags ignore votes.
6. **The Themes shelf** (`theme:<id>`) appears only with **5 or more confirmed recordings** and leaves under 3. Counts come from
   confirmed tags only, never from suggestions.

### Data model (new tables, API side)

```
theme_tags            id, slug, label_en, label_ru, label_es, sort, active          -- the team's list (c)
recording_tags        recording_id, tag_id, status (suggested|confirmed|rejected),
                      source (uploader|listeners|team), locked bool, confirmed_at, confirmed_by
                      unique (recording_id, tag_id)
recording_tag_votes   recording_id, tag_id, voter_key, vote (+1|-1), created_at
                      unique (recording_id, tag_id, voter_key)
```

`voter_key` is the member id of a signed-in account, kept only for votes (the vote is not shown to anyone but is needed to stop
double votes). A deleted account's votes are deleted with it (GDPR), and the tag status is recomputed.

### Anti-abuse and moderation

* One vote per member per recording per theme; a vote is allowed only after a **counted play** of that recording by the same listener.
* Accounts younger than 7 days cannot vote. At most 30 votes per member per day.
* The uploader's own votes on their own recording are ignored (the suggestion already counts as theirs).
* Votes that arrive in a burst from new accounts for one recording are held and flagged for the team, not counted.
* Reports on a theme go to the existing recording report queue. The team can lock a tag and see its vote history.
* A confirmed tag is a public statement, so it is only ever based on people, never on a guess by a model.

If audio analysis is ever tried, it should only **order** the voting queue (show likely candidates first) and never write a tag.

### Built (round 5)

The hybrid (f) is built: API in `apps/api/app/api/v1/recording_moods.py`, rules in `apps/api/app/services/recording_moods.py`,
tables `recording_moods` and `recording_mood_votes` (migration `0059_recording_moods`), phone block `components/kirtan/MoodBlock.tsx`
on the recording page. The six words are Joyful, Longing, Calm, Ecstatic, Devotion, Sad (the "surrender" of the first proposal is
not among them). Numbers as built, all constants at the top of the service:

* **Uploader** suggests one or two moods (`PUT /recording-moods/recordings/{id}/suggest`), or says "I am not sure" (an empty list,
  no tag). Only the member who added the recording can do it.
* **Confirmed** when the uploader suggested the mood and **3** members said yes with at least **70 percent** yes; when nobody
  suggested it, **5** members with 70 percent. In both cases at least one of the yes votes must come from a **veteran**
  account (older than 30 days). **Rejected** under 30 percent yes after 5 votes. A mood leaves "confirmed" again if later votes
  push it under the line.
* **Who can vote** (`PUT /recording-moods/recordings/{id}/votes/{mood}`): a signed-in member with an account older than **7 days**,
  after a **counted play** of that recording (a row in the play log under the member's own listener key), at most **30 votes per day**,
  not the uploader on their own recording (they suggest instead), and at most 20 requests a minute. A vote can be changed or taken back.
  A listener can also start a mood nobody has suggested yet; it then waits for 5 yes votes.
* **Burst rule, simplified:** instead of detecting and holding bursts, an account must be 7 days old to vote and one yes
  of every confirmation must come from a veteran (30 days). A burst of new accounts therefore cannot confirm anything.
  Detecting and flagging bursts for the team is not built.
* **Team** can confirm, reject or clear a mood and lock it (`PUT /admin/recording-moods/recordings/{id}/{mood}`); a locked mood
  ignores votes. There is no team screen for it yet (admin API only). `POST /admin/recording-moods/recompute` rebuilds all
  statuses. It is not yet called by the account deletion (docs/account-deletion.md): votes of a deleted account must be removed
  and this endpoint run afterwards; wiring that is open.
* **Feed to the menu:** `GET /recording-moods/confirmed` (public, cached 5 minutes) returns the confirmed moods per recording.
  The phone merges them into each recording's `moods` (`lib/recordingMoods/confirmed.ts`, `hooks/useConfirmedMoods.ts`), so the
  mood chips, the `theme:<id>` shelves and the "Mood" row of "Search by" count confirmed moods and nothing else.
  Suggestions never reach the menu.

## 7. Module reference

* `lib/searchMenu/types.ts`: `MenuStats`, `MenuShelf`, `MenuResult`, `MenuMemory`.
* `lib/searchMenu/config.ts`: `MENU_RULES` (all thresholds), `MENU_TITLE_KEYS` (visible words; en/ru/es in `locales/searchMenu.ts`).
* `lib/searchMenu/rules.ts`: `buildMenu`, `isColdStart`, `rankBhajanLanguages`.
* `lib/searchMenu/live.ts`: `buildLiveMenu` (recordings, history, pins, memory to shelves), `shelfItems` (the recordings on a
  shelf, from the same filter that counted it), `shelfTitle`, `shelfHref`, `labelFromId`. `lib/searchMenu/remote.ts`: the pins calls.
* `lib/listening/*` and `stores/listeningHistoryStore.ts`: the local history.
* Preview only: `lib/fixtures/searchMenuDemo.ts`; `/search-v2?menu=new|early|grown` picks the sample stage (default grown).
* `lib/searchMenu/aggregate.ts`: `aggregateRecordings`, `normalizeKindId` (an old `devotional_song` reads as a Bhajan).
* Labels of types, languages, authors, collections and themes are resolved by the screen from the app's own dictionaries
  (`kt.type.*`, `kt.btype.*`, `lang.<code>`), not by the module.

## 8. Open questions for Dada

Answered in round 3 (see section 9): 1 style field (yes, optional, built on the API), 2 six moods, 4 pins in a table, 5 variant D on A,
6 a local history screen (the log feeds "you listen" on the phone only). Still open:

1. The thresholds below are Dada's to keep or change; each is one number in `lib/searchMenu/config.ts`.
2. The upload forms do not offer the style field yet (section 9.2). Moods can be tagged (section 6, "Built"); the team has no screen to override one yet.
3. A screen for the team to edit the pins (section 9.5).

## 9. Round 3 decisions

### 9.1 Layout: D on A

Top of the idle Search: recent searches, the four section tiles, then **"Listen again"** (the last eight tracks of this phone's own
history, tap = play again, "My listening history" opens the whole screen). While the history is empty the old "Recently played"
songs strip shows instead. Then the shelves the rules chose, block by block, each with its real count and a "See all" button:
Baba's voice, Prabhat Samgiita (collection tiles and, when 3+ exist, "Sung by our community"), Kiirtan (types, events, then the
sub-heading "Indian Kiirtan by style"), authors, spiritual songs, Bhajans by language, Moods. The "Discover" photo shelf stays at
the end. A typed search also shows the **Authors** block (`<AuthorsSearchBlock>`, route `/authors`) for names that match.

### 9.2 The style field ("Indian kiirtan / style")

Optional, Kiirtan only: Bengali, Hindi, Brajabuli, Dhrupad-flavoured, Folk, or Other with a name (up to 80 characters). API:
`recordings.style` + `style_other` (migration 0039), refused for other kinds, "Other" needs a name. Phone: `lib/kirtan/styles.ts`
(ids, labels, `cleanStyle`), the read side (`Kirtan.style/styleOther`, `RemoteRecording.style/style_other`, the publish payload) and
the picker `components/kirtan/add/StyleField.tsx`. **Not done:** placing the picker in the add form and the playlist/bulk-queue rows
(the drafts are being changed by the batch-upload work). The shelf rule: 3+ Kiirtans of one style to appear, under 2 to leave.

### 9.3 Baba's Audio Discourses

Kind id `baba_audio` (owned by the upload work; the menu only reads the id). One shelf as soon as one recording exists, never
dropped by the 14-cap. On Today a shelf "Baba's voice" with "See all"; in Search a block of its own at the top of the menu.

### 9.3b Kiirtan for piano

One shelf, `kiirtan:piano`, in the Kiirtan block. A Kiirtan is on it when members' piano notes for it are published
(`GET /piano-notes/recordings`, read at most every two minutes) or when its lead instrument is the piano (the upload form's
field; read defensively, so the shelf works before the field exists). Only Kiirtans count. One recording is enough
(`{ on: 1, off: 1 }`), so a new shelf appears at the first piano Kiirtan and goes when none is left. The Kiirtan tab shows the
same recordings as a row with "See all". Design of the notes: docs/piano-notation.md.

### 9.4 Moods

Six have words: Joyful, Longing, Calm, Ecstatic, Devotion, Sad (ru: Радостное, Тоска, Спокойное, Экстатическое, Преданность, Грустное;
es likewise). Since round 4 the six are not a gate: the menu finds the moods the recordings carry (section 10). A mood chip appears
at 3 recordings that carry it and leaves under 2 (after the hold). The words live in `lib/kirtan/moods.ts` and
`locales/searchMenu.ts` (`mood.*`). **The tagging is built (section 6, "Built")**: the menu reads `themes` from the recordings' confirmed
`moods`, so a chip shows only after listeners confirmed a mood. In the preview, the moods are sample data (a mock of the API in `lib/recordingMoods/mock.ts`).

### 9.5 Team pins

Table and endpoints in section 2.7. The phone reads the list at most once a day. A team-only toggle in the team screen was left out
(not cheap); until then the list is set with the admin API.

### 9.6 Listening history (phone only)

Screen `/listening-history`: "My listening history", grouped Today / Yesterday / Earlier. A row shows the title, a kind icon and the
time; tap plays it again; the cross removes one; "Clear all" asks first; a switch pauses logging; an empty state explains. An entry is
added only after a **counted play** (30 seconds, or half of a short track and never under 10, the same rule as the author numbers),
one entry per track per day, newest 500 kept. Nothing is sent anywhere. The same log feeds the "you listen" author and language
rules locally (`lib/listening/stats.ts`). Reachable from Today ("Listening history") and the profile menu. Store
`prabhat-listening-history` (persist version 1); the menu's memory and pins are `prabhat-search-menu` (version 1).

### 9.7 Thresholds (unchanged, written down)

Appear at 3, leave under 2, plus a 7-day hold so a shelf does not blink. A popular author needs 3+ recordings and 5+ distinct
listeners in 30 days. At most 14 shelves (compact groups excepted, section 2.3). Baba's voice: 1 / 1 (one knob, `MENU_RULES.baba`). Kiirtan for piano: 1 / 1 (`MENU_RULES.kiirtanPiano`). Style: 3 / 2.
Mood: 3 / 2 (round 4, was 5 / 3). Every discovered facet value: 3 / 2. When the 14 are exceeded, the shelf with the fewest
recordings is dropped; Baba's voice, pinned shelves and the compact groups are never dropped (Baba stays at 1 recording).

## 10. Categories appear on their own (round 4)

Dada's rule: **a field or category shows only if songs of it exist; nothing empty is ever shown, and a new category appears
without anyone writing code for it.** This applies to Kiirtan styles, moods, Baba's Audio Discourses, dances, languages, types,
authors and any tag the library carries (tempo, solo or group, occasion, event name ...).

### 10.1 How it works

```
recordings in the library
   |  lib/searchMenu/facets.ts   discoverFacets(): every value a recording carries, per facet, with counts (decides nothing)
   v
stats (counts)  <- aggregate.ts (also kinds, types, languages, authors, sets, plays)
   |  lib/searchMenu/rules.ts    buildMenu(): a value becomes a shelf at 3, stays at 2, leaves under 2 after the 7-day hold;
   v                              caps (14, per facet 6, moods 8), block order, pins
shelves and chips   <- the screens draw exactly these (SearchMenuView), Today reads the same rule for Baba
   |  lib/searchMenu/live.ts     shelfItems(): the list behind "See all" is the same filter that made the count
   v
titles: a translated word when the app has one, otherwise the value's own words, title-cased
```

* **The library is the only source.** The module scans `kind`, `type`, `language`, `author`, `style` (+ the typed name), `moods`,
  `dance` and `tags` (any facet: `tags = { tempo: ["slow"], performance: ["solo"], occasion: [...], event: [...] }`). Adding a
  field to the API means mapping it into `tags` in `toMenuRecording`; no list of categories has to change.
* **Nothing hard-coded except labels.** The six moods and the five styles still have translations (`locales/searchMenu.ts`), but
  they are only words: a mood or style that is not in those lists is found just the same and titled from its own words
  ("deep-peace" becomes "Deep Peace"). A value is matched case-, spacing- and punctuation-insensitively ("Baul", " baul ").
* **A new style someone types under "Other"** goes into "Other styles". When 3+ Kiirtans carry the same name it gets a shelf of
  its own, titled automatically; when it falls under 2 it returns to "Other styles" after the hold.
* **Empty means absent.** No recordings of a facet value: no shelf, no chip, no empty title. In real builds an empty Baba shelf
  does not exist (Today and Search use the same count). The preview's demo discourses exist only in the preview's sample
  library (stages below) and all say "Demo".
* **Renaming.** The team can give any shelf another title in `MENU_LABEL_OVERRIDES` (`lib/searchMenu/config.ts`, shelf id to
  title). A server-side rename (a team screen) is not built. Numbers per facet live in `FACET_OVERRIDES` (same file).
* **Caps.** 14 shelves in all; the Prabhat Samgiita tiles and the mood chips are outside it. Since round 5 the cap drops **the
  shelf with the fewest recordings** (a tie: the lower one in the block order) instead of the last block, so a shelf with two
  recordings goes before a shelf with fifty wherever it stands. Never dropped: pinned shelves, `baba` (even at one recording),
  the pulse block, the compact groups. `__tests__/searchBy.test.ts` pins these cases.
* **Server.** No separate endpoint: the phone counts the library it already loads. If the library grows past what the phone
  loads, the same `discoverFacets` result can move to `GET /search-menu/facets` without changing the rules (open question).
* **Not available yet in the data:** tempo, solo/group and occasion do not exist as recording fields today. The module is ready
  for them (they arrive as `tags`); until the API sends them, no such shelf exists.

### 10.2 Preview stages (`?menu=`, MOCKUP_DATA only)

`new` empty library; `early`; `grown` (with 3 demo discourses); `nobaba` (grown without discourses: no Baba shelf);
`newstyle` (nobaba plus 3 Kiirtans of a style nobody listed ("Baul") and a sample solo or group tag: new shelves appear).
Tests: `__tests__/searchMenuFacets.test.ts` (no Baba items means no shelf, 3 show it, removal, new style, thresholds and hold,
caps, the preview library).

## 11. Fields feeding categories (upload side)

Which recording field becomes which browse category. "Exists" means the API and the upload form carry it today. The rest is
a proposal for Kiirtan uploads (board `Для-Дады/киртан-загрузка-поля`) and is not built; the menu would pick each one up
through `tags` (section 10.1) without a change to the rules.

| Field (API name) | Exists | Required at upload | Becomes |
|---|---|---|---|
| `kind` | yes | yes | the type chips and the type shelves |
| `style` (+ typed name) | yes | yes for a Kiirtan | "Indian kiirtan / style" shelves, "Other styles" |
| `language` | yes | Bhajan, Spiritual song, Baba's discourse | the language filter and language shelves |
| `dance` | yes | Dance music | Tandava / Kaushiki shelves |
| `practice` = `"avarta"` | yes (Kiirtan only) | no | "Avarta Kiirtan" choice inside the Kiirtan tab, only when data exists (`docs/kiirtan-practice.md`) |
| `moods` | yes | no | mood chips |
| `tempo` | yes (Kiirtan, Dance music; `docs/kiirtan-recording-info.md`) | no | tempo shelf (slow, medium, fast), arrives as `tags.tempo` |
| `performance` (solo or group) | yes (Kiirtan, Bhajan) | no | "Solo" and "Group" shelves, arrives as `tags.performance`; singers by name stay unbuilt |
| `lead_instrument` (+ typed name) | yes (every kind of music except Baba's Audio Discourses; `docs/kiirtan-recording-info.md`) | no | an instrument shelf ("Kiirtans for piano"), when 3+ share one, arrives as `tags.instrument`. A typed word reaches the shelf only after the team accepts it or merges it into a listed instrument |
| `occasion` or `event` | no (a playlist already names an event) | no | an occasion shelf |
| `recording_type` (studio, live, home, ai) | yes (Kiirtan required; Dance music, Bhajan, Spiritual song optional; `ai` not for a Bhajan) | Kiirtan | "Studio", "Live", "At home" and "Made by AI" shelves, arrives as `tags.recorded`. An AI shelf is titled plainly "Made by AI": the listener always knows |

`tempo`, `performance`, `recording_type` and `lead_instrument` were added with `docs/kiirtan-recording-info.md`; `moods` and `occasion`
or `event` stay unbuilt until Dada decides the upload steps (board `Для-Дады/мастер-загрузки-киртана`).

## 12. "Search by": what can be searched, written out (round 5)

Dada's rule: a person must **see** what they can search by, including for Prabhat Samgiita, and see how many recordings stand
behind each choice. The block "Search by" sits at the top of the Search screen, above the shelves (`components/search-v2/SearchByBlock.tsx`,
rows built by the pure `lib/searchMenu/searchBy.ts`, tests in `__tests__/searchBy.test.ts`).

* **Three tabs:** Kiirtan, Prabhat Samgiita, Bhajans by language. Dance music, spiritual songs and any other discovered facet go
  into the Kiirtan tab as further rows (the facets of "More ways to listen").
* **Kiirtan tab rows:** Style, Mood (confirmed only), Main instrument, How it was recorded, Solo or group, Tempo, Type, Events and
  sets, Performer. Each value is a chip with its count; a tap opens the same list as the shelf (`/browse-shelf?id=...`).
  Values come from the facets the library carries (`discoverFacets`), up to 10 per row, most recordings first.
* **A row with nothing yet is still shown**, with one sentence saying when it will fill ("Appears when a recording says how it was
  recorded"). This is the single exception to "empty means absent" (section 10): the rows are the answer to "what can I search by?",
  the shelves stay absent.
* **Prabhat Samgiita tab:** Collections (Moods, Festivals, Themes, Occasions, Seasons, Languages, each with how many collections
  it holds), Mood (the six lists of the Songs shelf with their song counts), Song number (an example, typed into the search field),
  First line (an example), How you feel (an example). Examples are typed into the field, which already finds a song by number, by first
  line in any spelling, and by a feeling word.
* **Bhajans tab:** Language and Type, with counts.
* **Alignment with the main instrument.** The instrument row shows the same "Kiirtans for piano" shelf (`kiirtan:piano`, section 9.3b);
  the facet `instrument = piano` is skipped in the generic shelves, so no second piano shelf appears. Other instruments
  appear as shelves of their own when 3+ recordings share one.
* **Preview:** at `/search-v2` with the sample stage `grown`; other stages (`?menu=new|early`) show rows with their "appears when" sentences.
