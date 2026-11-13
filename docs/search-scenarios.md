# Search page: inventory, what was removed, scenario variants

Screen: `apps/mobile/app/search-v2.tsx` (route `/search-v2`). Blocks: `components/search-v2/*`, logic: `lib/unifiedSearch*.ts`, `lib/searchBrowse.ts`, `lib/kirtan/search.ts`.
Design board with phone mockups: `~/Documents/Carousel/Для-Дады/поиск-варианты/` (numbered .html + .png).

## 1. What the catalogue really has (checked in `data/generated`)

| Thing | Real? | Evidence |
| --- | --- | --- |
| Songs | yes | `songs.json`: 5,018 songs (number, title, first line, lyrics, English meaning; Devanagari for 5,017) |
| Ragas | **no** | `raga` is empty in all 5,018 songs. `tala`, `mood`, `difficulty`, `meditation_context` are empty too |
| Moods | partly | not a field of the songs. They are six curated keyword lists of the Songs shelf (Kiirtan 129, Dhyana 95, Morning 92, Evening 99, Nature 132, Children 4), made in `categorySongs` |
| Festivals / Themes / Occasions / Seasons / Languages | yes | `theme_collections.json`: 69 collections (8 festival, 32 theme, 15 occasion, 7 season, 7 language; "Bengali Dialect Songs" is hidden on purpose) |
| Stories | yes | `stories.json`: 24 stories; the Stories page already has a title / PS number / song name search |
| Kiirtans and Bhajans | only uploads | no bundled recordings; the lists come from the API and member uploads (sample ones show in the demo preview only) |
| Instruments | **no** | no data of any kind |
| Play counts ("Most played") | **no** | the app and the API keep none. The app does keep the last 12 songs this person played on this device (`preferencesStore.recentPlays`, no counts) |
| "New this month", "Made for you" | **no** | all songs are one fixed body of compositions; nothing is personalised |
| Search in Bengali script | **no** | the search index is Roman only (no Bengali-script field exists). Devanagari exists as text but is not indexed (see section 4) |

## 2. Inventory of the Search page

"Before" is the state of the preview (`EXPO_PUBLIC_MOCKUP_DATA=1`, localhost:8099). In a real build the six prototype tiles were already hidden by an earlier commit; the preview still showed them.

### Header and field

| Control | Opens / does | Before | Now |
| --- | --- | --- | --- |
| Avatar (idle) | `/profile-sheet` | ok | ok |
| Mic (header, field) | starts/stops voice; if the device has no speech engine it focuses the field | ok | ok |
| X (idle) / Cancel (typing) | back, or Today (`/v2/today`) when opened by a link | ok | ok |
| Field clear (x) | empties the field, keeps focus | ok | ok |
| Tab bar Today / Songs / Kiirtan / Learn | `dismissTo` the tab; the tab already active closes search | ok | ok |
| Upload "+" | upload flow (not part of Search) | ok | not touched |

### Empty field

| Control | Opens / does | Before | Now |
| --- | --- | --- | --- |
| Recent searches (chips, "Clear") | runs the search again / clears history | ok | ok |
| Tile Songs | `/songs-v2` (Songs tab) | ok | ok |
| Tile Stories | `/stories` | ok | ok |
| Tile Learn | `/v2/learn` | ok | ok |
| Tile Kiirtans | `/v2/kiirtan` | ok | ok |
| Recently played (cards) | `/song-v2/{id}` | did not exist | **new**: the app's own history, hidden while empty, named "Recently played" |
| #longing #devotion #surrender #morning | search that feeling in the bundled mood lists (6 songs each, no network) | ok | ok (test: every tag finds songs) |
| #kiirtan | searches the word "kiirtan": 2 lyric hits, Kiirtans from uploads | weak | kept, flagged (see questions) |
| Browse all: Moods | `/collections-v2?kind=mood` (6 lists) | ok | ok |
| Browse all: Festivals | `/collections-v2?kind=festival` (8) | ok | ok |
| Browse all: Languages | `/collections-v2?kind=language` (6) | ok | ok |
| Browse all: Themes | `/songs-v2` (the Songs tab, not themes) | **wrong page** | `/collections-v2?kind=theme` (32 themes) |
| Browse all: Occasions, Seasons | no tile | missing | **new**, `?kind=occasion` (14), `?kind=season` (7) |
| Browse all: Ragas | list "Meditation" titled "Ragas" | **fake** | **removed** (no raga data) |
| Browse all: Instruments | Songs tab, collections segment | **fake** | **removed** |
| Browse all: Stories | `/stories` (duplicate of the top tile) | duplicate | **removed** |
| Browse all: Made for you | Today tab | **fake** | **removed** |
| Browse all: New this month | Songs tab | **fake** | **removed** |
| Browse all: Most played | Songs tab | **fake** (no play counts) | **removed**; replaced by honest "Recently played" |

"Browse all" is now built from the data (`lib/searchBrowse.ts`): one tile per kind of collection that has at least one non-empty collection, each showing its real count and opening the All collections page on that kind. A kind that becomes empty loses its tile by itself.

### Typing (results)

| Control | Opens / does | Before | Now |
| --- | --- | --- | --- |
| Chips All / Songs / Kiirtans & Bhajans / Stories | filter the result blocks | ok | ok |
| Stories chip | a note "Stories are not searchable here yet" that opened `/stories` | **dead search** | real results: title, PS number or song name (the Stories page's own match), row opens `/stories/{slug}`; "Browse all stories" row; loading, failed + retry, none |
| Song result card | `/song-v2/{id}` | ok | ok |
| Number ("19", "PS 19", "ps-19") | the one song, "Number match"; 0 or 5019 gives the range sentence | ok | ok |
| Answer card song rows | `/song-v2/{id}` | ok | ok |
| Answer card "Ask the assistant" | `/assistant` | ok | ok |
| Collection chips ("Krsna Songs . 15") | fills the field with the name; the exact collection then lists up to 10 songs; there is no way to its full page | half | unchanged (depends on the variant) |
| Artist chip | `/kirtan-artist?id=` | ok | ok |
| Kiirtan / Bhajan row | plays it in the player | ok | ok |
| "Searching by meaning" / guest note | information, no tap | ok | ok |
| No results | one sentence, nothing to tap | dead end | sentence + **"Browse collections"** (`/collections-v2`) |

Unused code left in place (not rendered anywhere): `EmptyState` in `SearchBlocks.tsx` and its `searchHints.*` strings.

## 3. Scenario variants (pick one; none is implemented yet)

Common to all three: the idle page and the typed-number / empty / no-results states described in section 4. They differ in what a result list looks like once there are hits of several kinds (songs, collections, stories, Kiirtans, artists) and where a tap on a category leads.

### A. One page, grouped sections with "See all"

Typing shows blocks in a fixed order, each only if it has hits: Top match (number or exact collection), Songs (5 rows, "See all 21 songs"), Collections (cards, 3), Stories (3 rows), Kiirtans & Bhajans, Artists. The chips become shortcuts: tapping one shows only that block, in full (that is what "See all" does). Tapping a collection card opens its collection page (`/songs-v2-collection`), a story opens `/stories/{slug}`, a song opens the song page. Back from any of them returns to the same query, same scroll.

- Pro: one screen answers everything; a missing category simply does not appear; the closest to what the code already does (chips, blocks, StoryResults).
- Con: a long page for a broad word ("krsna": 21 songs + 2 collections + stories).

### B. Tabs: each category is a full result page

The chips are real tabs with counts, "Songs 21", "Collections 2", "Stories 0" (a tab with 0 is dimmed). "All" shows the three best of each. Each tab has its own list, its own empty state ("No stories match ...") and the scope is in the URL (`?scope=stories`), so a link or the back button returns to the same tab.

- Pro: predictable; each list can be long and sorted; deep-linkable.
- Con: the user has to know which tab to open; with 24 stories and 69 collections most tabs are nearly empty; four taps to compare categories.

### C. Category landing pages

The idle tiles are doors to a landing page of that category (Songs, Collections by kind, Stories, Kiirtans), each with its own field "Search in Festivals". The main field searches songs only and, under the song list, shows a strip "Also found in: Krsna Songs (collection), Stories (1)" whose chips open that category's page already filtered by the typed words.

- Pro: every category gets room to be browsed, not only searched.
- Con: the largest change: Stories, All collections and Songs pages must accept a query parameter and show a "filtered by" bar; two search fields to learn.

### Recommendation: A

Most searches in this app are a number or a first line (a song), so the song block must come first and sit at the top. Categories are rare, small and uneven (24 stories, 69 collections, Kiirtans only from uploads), so they should appear only when they have a hit instead of owning an empty tab (B) or a page of their own (C). A also costs the least: no other page changes.

What implementing A touches (all in the Search area): `app/search-v2.tsx` (block order, "See all" switching the scope, keep scroll and query on back), `components/search-v2/SearchBlocks.tsx` (a Collection card block, section headers with "See all"), `components/search-v2/StoryResults.tsx` (a `limit` prop for the top 3), `lib/unifiedSearch.ts` (collection hits keep their id so a card can open `/songs-v2-collection?id=...&title=...`), `lib/kirtan/search.ts` (scope list gains "Collections"), locales en/ru/es + `review.json`, tests `searchWiring.test.ts` (new routes). No other page changes. B adds URL scope handling and counts. C touches `app/stories/index.tsx`, `app/collections-v2.tsx` and `app/songs-v2-index.tsx` (a `q` parameter each).

## 4. States common to all variants

| Situation | Behaviour |
| --- | --- |
| Idle | Recent searches, the four section tiles, Recently played (only if there is history), Discover feelings, Browse all by kind of collection |
| Recent searches | up to 8, newest first, tap to repeat, "Clear" empties; a search is remembered when a result is opened or the keyboard is submitted |
| Number: "19", "PS 19", "ps-19" | the one song first (Number match). 0 and above 5018: "Prabhat Samgiita song numbers run from 1 to 5018." and "Browse collections" |
| Roman words ("bandhu", "krsna", any diacritic-free spelling) | first lines, lyrics, word glosses; spelling variants folded (krsna finds Krsna) |
| Feeling ("longing", "peaceful") | bundled mood lists first (no network), then meaning matches from the server when signed in; guests get a quiet note |
| **Bengali script** ("বন্ধু") | nothing found today. There is no Bengali-script text in the data, so it cannot be indexed; the honest options: say so ("Search in Roman letters, for example bandhu") |
| **Devanagari** ("बंधु") | nothing found today although `lyrics_devanagari` exists for 5,017 songs. It can be indexed in `lyric_search_index.json` (packages/core search) or the query can be transliterated to Roman; this is a separate piece of work and is not part of this change |
| Voice | the mic fills the field as you speak; the final text runs the local search and the server voice matcher (knows spoken Sanskrit spellings). No speech engine (web preview): the field is focused |
| No results | one sentence + "Browse collections" (`/collections-v2`) |
| Back | Cancel or X goes back to where Search was opened (Today if opened by a link); the system back does the same |

## 5. Open questions for Dada

1. Variant A, B or C?
2. "Recently played" on the idle page: keep (it is the only honest replacement for "Most played"), or drop it?
3. "#kiirtan" in Discover finds only 2 songs and depends on uploads: keep, or replace by "#bandhu" (8 songs, a first-line word) or remove?
4. Devanagari and Bengali-script search: do it (needs indexing work) or only show the honest hint?
5. Today's "Raga mix" (HOME_MIXES) has the same problem as the Ragas tile; it is not part of Search.
