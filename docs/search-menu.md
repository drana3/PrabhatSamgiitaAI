# Search browse menu: blocks, adaptive rules, themes

Status: design plus a pure rules module (`apps/mobile/lib/searchMenu/*`, tests in `apps/mobile/__tests__/searchMenu.test.ts`).
Nothing is wired to a screen yet. Dada picks a layout variant first (boards in `Для-Дады/поиск-меню/`).
This page extends `docs/search-scenarios.md` (what Search does and where every control leads).

## 1. What the menu is

The idle state of Search (`/search-v2`, nothing typed) shows a browse menu split into blocks. It is **prepared in advance** and it
**adapts by itself**: a shelf appears when the data behind it is big enough, and disappears when it is empty. People never see a
shelf with nothing in it, and never see a number the app did not count.

| # | Block | What is in it | Where the data is today |
|---|-------|---------------|-------------------------|
| 0 | Pulse (top) | New this month, Most played | `recordings.created_at`; play counts (see 4) |
| 1 | Prabhat Samgiita | The real collections (moods, festivals, themes, occasions, seasons, languages) and, when there are enough, performances of PS songs | `lib/searchBrowse.ts` (collections), recordings of `kind = prabhat_samgiita` |
| 2 | Kiirtan | Categories by **type** (Baba Nam Kevalam, Lila, Festival, Other) and "Events and retreats" (sets uploaded together) | `recordings.type`, `recordings.collection_id` |
| 3 | Kiirtans by authors | One shelf per author, named by the author | `recordings.author` (text) |
| 4 | Spiritual songs | One shelf | `recordings.kind = spiritual_song` (API has it; the phone's kind list does not yet) |
| 5 | Bhajans by language | One shelf per language that has Bhajans, then a "More languages" shelf, then types (morning, evening, devotional) | `recordings.language` (ISO code), `recordings.type` |
| 6 | Themes | Joyful, longing... only after the team has confirmed enough recordings (section 6) | does not exist yet |

### Honest limits of the data (nothing is invented)

* **"Indian kiirtans" has no field behind it.** A Kiirtan is Baba Nam Kevalam, so it has no sung language, and the API has no
  origin or style. The categories that really exist for a Kiirtan are its type (BNK, Lila, Festival, Other), its author, its
  event set and its year. Block 2 uses those. If Dada wants an "origin" or "style" category, someone must first add that field
  to the upload form (open question 1).
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
| Theme | 5+ confirmed recordings | under 3 | all |

### 2.2 Windows

* "New": `created_at` within **30 days** (not `published_at`: a recording uploaded in a batch is new when it arrives).
* "Popular" and "Most played": **30 days** of counted plays (`play_daily`); until daily counts exist, the lifetime counter
  `recordings.plays` is used and the shelf says "Since the start" instead of "In the last 30 days". The screen must show which.
* "You listen": **60 days**, from a small log kept **on this phone only** (author key, recording id, day). Never uploaded.

### 2.3 Maximums and order

* At most **14 shelves** in all. Over the cap, the lowest-priority shelves go first. Prabhat Samgiita collections and pinned
  shelves are never dropped.
* Authors: at most **4** shelves, at most **2** of them personal, at most **3** in cold start. Languages: top **5** plus "More languages". Themes: **6**.
* Blocks come in a fixed order (0 to 6). Inside a block: pinned first, then "you listen" shelves, then shelves that were already
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
the "not empty" rule, goes first in its block, and counts toward the 14. Where the pin list is stored (a small `menu_pins` table
or a remote config file) is open question 4.

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

## 7. Module reference

* `lib/searchMenu/types.ts`: `MenuStats`, `MenuShelf`, `MenuResult`, `MenuMemory`.
* `lib/searchMenu/config.ts`: `MENU_RULES` (all thresholds), `MENU_TITLE_KEYS` (visible words; en/ru/es in `locales/searchMenu.ts`).
* `lib/searchMenu/rules.ts`: `buildMenu`, `isColdStart`.
* `lib/searchMenu/aggregate.ts`: `aggregateRecordings`, `normalizeKindId` (an old `devotional_song` reads as a Bhajan).
* Labels of types, languages, authors, collections and themes are resolved by the screen from the app's own dictionaries
  (`kt.type.*`, `kt.btype.*`, `lang.<code>`), not by the module.

## 8. Open questions for Dada

1. Do you want an "Indian" or "style" category for Kiirtans? There is no data for it; it needs a field on the upload form.
2. The list of themes (sad, joyful, ...): which words, and how many? Five to six is a good size.
3. Are the thresholds right (3 recordings to appear, 5 listeners for a popular author)? Small numbers show more shelves early.
4. Where should team pins live: a table in the admin, or a small config file?
5. Which variant (A, B, C or D)?
6. Should "You listen" shelves exist at all, or is a local listening log more than you want to keep on the phone?
