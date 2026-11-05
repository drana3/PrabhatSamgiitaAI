# Photo system (mobile app)

Status: design proposal, nothing here is implemented beyond what section 1 calls "today". Written for the redesign (`redesign/v2`).
Code today: `apps/mobile/lib/photos/` (`photoData.ts`, `amPhotoData.ts`, `assets.ts`, `catalog.ts`, `pick.ts`, `credits.ts`), images in `apps/mobile/assets/photos/{cover,thumb}`, tests in `apps/mobile/__tests__/stockPhotos.test.ts`.

## 0. What exists now

- 49 photos: 27 from Unsplash (n 2..36) and 22 from Ananda Marga's gallery (anandamarga.org/gallery, used with the organisation's permission; n 103..164, where n is the number in the site's original file name `g-NNN`).
- Files: `cover` (long side up to 1400 px, never upscaled) and `thumb` (480 px wide). Together about 12.7 MB (cover 10.8 MB, thumb 1.9 MB; about 220 KB per cover on average, the largest 712 KB). All of it is bundled and `require`d by literal paths in `assets.ts` (Metro needs literal paths).
- Metadata: `category`, `tone` (warm/cool), `moods[]` (morning, evening, night, long, live, festival, calm), `people` (none/far/close/children), `lowRes`, `tint` (dark colour of the lower third), size, credit, page URL, licence.
- Picking (`pick.ts`): `photoForSeed(seed, mood, {allowPeople, size})` is deterministic (FNV-1a of the seed picks from the eligible pool). Eligible = no `close`/`children` unless `allowPeople`, no `lowRes` unless `size: "small"`; warm first, cool only for night and long; if the mood has no match it falls back to any eligible photo.
- Used by: Kiirtan covers (`KiirtanCover`), live cards, mixes (`photoForMix`), stories (`storyPhoto`), library tile, artist avatar placeholder, player and share sheet. The Today "song of the day" card still uses one fixed asset (`todayAssets.hero`), not the catalogue.
- Gaps found while reading the code: `docs/photo-credits.md` is referenced in `photoData.ts` but does not exist; there is no focal point, no safe-text area and no per-photo "allowed use"; no placeholder while an image decodes; the pool per mood is small (about 33 photos pass the default rules by my count, with 13 for morning, 10 for evening and 3 to 6 for night).

## 1. Where photos appear and what they do

Ratios are targets for the layout; use `contentPosition` from the focal point (section 3) so the crop keeps the subject. Sizes are in dp; "asset" is which file to load (`thumb` 480 px up to 240 dp wide, otherwise `cover`).

| Place | Role | Ratio / size | Asset | Scrim | Text on the photo |
|---|---|---|---|---|---|
| Today hero (song or photo of the day) | mood of the day, first thing seen | full width, 4:5 on Today, about 4:3 as the shortened card on the shelf page | cover | top gradient (amScrimPhotoTop) and bottom gradient (amScrimPhoto), always | date label, kind chip, title, play. White text, chips are dark glass. Text only in the `safeText` zone |
| Today morning / evening shift | same slot, different photo by time of day (section 2.3) | same as hero | cover | same | same; cross-fade 400 ms, never a hard swap while the user looks |
| Today shelves and cards (Collections, "continue", live) | rhythm and recognition | 4:3 or 16:10 cards, 240 dp wide | thumb (cover when wider than 240) | bottom gradient only if a title sits on it | title and one meta line at the bottom; no text in the middle |
| Kiirtan and Bhajans covers | identity of a recording, same photo everywhere it appears | 1:1, from 44 dp (row) to about 300 dp (player) | thumb up to 240 dp, cover above | none for plain covers; 0.55 black at the bottom if a badge or duration sits on it | none except badges; badge is neutral dark glass with white text |
| Collections / mixes | cover of a system mix, by its mood | header about 2:1 (190 dp tall on `kirtan-mix`), tile 1:1 | cover | bottom gradient | mix title and caption bottom-left |
| Stories | magazine feel; the only place people are welcome | featured card 28 dp radius, tall; thumb 16 dp radius square | cover and thumb | top 96 dp and bottom 230 dp gradients (already in `StoryParts`) | title bottom, label top |
| Song page and player background | continuity with the cover | top block `playerSize.photoHeight` full bleed, fades into the surface colour (use `tint`) | cover, blurred on small screens | gradient into surface | no text on the photo; title sits below on the surface |
| Share sheet image | what leaves the app | 9:16 and 1:1 exports | cover | bottom gradient | song title, "Prabhat Samgiita" mark; credit line in small type when a photo is used |
| Learn (hub, cards, daily plan) | quiet context, never decoration that competes with practice | 4:3 small cards, 1:1 chips | thumb | light bottom gradient | at most a one-line label; chips `PS` etc. are dark glass |
| Empty states | warmth where there is nothing | 16:9, 60 percent opacity or soft mask, above the message | cover | fade to surface | none: message is below the photo, on the surface |
| Welcome and Sign in | first impression | full bleed 9:19.5 | cover (portrait or crop of a wide one) | 0.35 to 0.75 vertical gradient | wordmark and buttons only; the same photo for everyone (fixed id, not random) |
| Notifications (optional, later) | rich image on a daily reminder | 2:1, under 300 KB | derived thumb | none | none, the OS draws the text |

General rules for text over a photo: always a scrim (colour from the photo's `tint`, not pure black); check WCAG AA (4.5:1) against the brightest pixel row in the safe zone; never put text in the focal zone; chips and badges on photos are neutral dark glass with white text whatever the photo; in Light and Dark theme the photo is the same, only the surface under the fade changes; `accessibilityIgnoresInvertColors` on every photo.

## 2. Choosing a photo

### 2.1 Layers (apply in order)

1. **Eligibility.** `status = approved`; `allowed_uses` contains the place (`hero`, `cover`, `mix`, `story`, `player`, `empty`, `welcome`); people rule (2.4); resolution rule (`lowRes` only for thumbs and small covers, never full-bleed).
2. **Object type.** Song or Kiirtan: `cover` pool; mix: mood of the mix; story: `story` pool, people allowed; hero: `hero` pool.
3. **Mood.** Same moods as now. Warm tone first; cool photos only for `night`, `long` and calm screens.
4. **Time of day** (hero and shift only): the photo's `time_of_day` matches the bucket, else mood match, else any eligible.
5. **Season** (hero only): photos tagged `winter` (snow, ice) are used only in winter months; an empty `season` list means "any". Hemisphere is ignored at first (the audience is mostly northern), a setting later if needed.
6. **Seed.** Inside the pool, FNV-1a of the seed picks the index. This stays as it is, so one song or mix always gets one photo.

### 2.2 Per-seed stability and repeats in a list

- A song, Kiirtan, mix or story keeps **one photo for life**: cover, mini-player and player background must agree, so the seed pick is never adjusted by what is next to it.
- To keep neighbours from looking identical without breaking that: (a) keep pools large (section 7, decision 4); (b) when the app itself builds a sequence of slots (shelves, a home page, Collections), use `pickSequence(slots, mood)`: it takes each slot's seed pick and, if the photo equals one of the previous 3 in the visible order, steps to the next photo in the pool. This runs only for slots the app composes, never for per-item covers; (c) rows in long lists use `thumb`, where a repeat costs nothing.
- A pool smaller than 6 photos is a catalogue bug: the test suite should fail on it (section 4.4).

### 2.3 Photo of the day and the shifts

- **Day key** = local calendar date. **Time bucket** from local hour: morning 04:00 to 10:59, day 11:00 to 15:59, evening 16:00 to 20:59, night 21:00 to 03:59. The hero follows the bucket (and swaps with a cross-fade when the bucket changes while the app is open); a festival or special day (the existing "kind of day") overrides the mood with `festival`.
- **No repeats for N days.** For each bucket build the hero pool `P` (N = its size, at least 10). For epoch `e = floor(dayIndex / N)` order `P` by `hash(id + e)`; the day shows `order[dayIndex mod N]`. Every photo appears once per N days; at the epoch boundary swap the first photo if it equals the last of the previous epoch. `dayIndex` = days since 2026-01-01 in local time. No state, no server, same result after reinstalling.
- **Shared, not personal.** Everyone with the same local date and bucket sees the same photo. Reasons: no storage, easy to reproduce a bug report, a shared "today" (people compare), and screenshots match. Personal variety comes only from the bucket (local time). If personalisation is ever wanted, add `hash(userId)` to the epoch hash; it costs one line and no new data.
- The song of the day and the photo of the day are separate choices: the song is editorial, the photo is mood. A day that has a story or festival may pin a photo id (`pinned_photo` in the day record).

### 2.4 People

- Default: only `none` and `far`. `close` and `children` are never picked unless the caller passes `allowPeople` (Stories, About, Credits).
- Hero, welcome and covers use `none` mostly; `far` is allowed when faces are unreadable (backs, silhouettes, small figures) and marked in the catalogue (a photo that depends on one readable face is `close`).
- Children: never on hero, welcome, covers or share images; stories about schools may use them only with written consent in the catalogue record (`consent` field), and the organisation's permission for photos does not by itself cover children or identifiable adults.
- Calm moods (night, long, morning) prefer `none` even when people are allowed (already in `pick.ts`).
- A photo with a visible religious portrait or altar is never cropped to the portrait alone.

## 3. Photo metadata (JSON schema)

One record per photo in `apps/mobile/lib/photos/photos.json` (source of truth; `photoData.ts` is generated from it). Existing records are migrated with the same ids; new fields are filled by the ingest script (section 4.1) and corrected by hand.

```json
{
  "id": "am-0143-sunset-behind-pines",
  "n": 143,
  "file": { "cover": "cover/am-0143-sunset-behind-pines.jpg", "thumb": "thumb/am-0143-sunset-behind-pines.jpg" },
  "width": 1280, "height": 960,
  "source": {
    "kind": "ananda-marga",
    "page_url": "https://anandamarga.org/gallery",
    "original_url": "https://anandamarga.org/gallery/full/294.jpg",
    "original_name": "g-143.jpg",
    "provenance": "anandamarga.org",
    "retrieved": "2026-11-05"
  },
  "credit": "Photo: Ananda Marga, anandamarga.org/gallery",
  "permission": { "scope": "organisation", "ref": "see docs/photo-credits.md", "consent": [] },
  "people": "far",
  "category": "light",
  "mood": ["evening", "calm"],
  "time_of_day": ["evening"],
  "season": [],
  "scene": ["forest", "sunset"],
  "tone": "warm",
  "palette": { "dominant": "#E0A24A", "tint": "#1B1208", "luma_top": 140, "luma_bottom": 34 },
  "focal": { "x": 0.55, "y": 0.42 },
  "safe_text": ["bottom"],
  "allowed_uses": ["hero", "cover", "mix", "story", "player"],
  "low_res": false,
  "status": "approved",
  "replaced_by": null,
  "added": "2026-11-05",
  "notes": ""
}
```

Field rules:
- `id`: `<source>-<nnnn>-<slug>`, never reused. `n` stays for backwards compatibility with `STOCK_PHOTO_CREDITS`.
- `people`: none, far, close, children (definitions in `photoData.ts`); `consent` lists who gave consent when `close` or `children` is used.
- `mood` and `tone`: as now. `time_of_day`: dawn-morning, day, evening, night; `season`: winter, spring, summer, autumn, or empty for any.
- `palette.tint`: dark version of the lower-third colour (for scrims and fades). `dominant` drives the accent tint of chips on the card.
- `focal`: normalised x, y (0..1) of what must stay in the crop; mapped to `contentPosition` in `expo-image`. `safe_text`: zones that are calm enough for text, `["top"]`, `["bottom"]` or both.
- `allowed_uses`: the closed list `hero, cover, mix, story, player, empty, welcome, share`. A photo is eligible for a place only if listed.
- `status`: `candidate` (downloaded, not reviewed), `approved` (usable), `retired` (never picked; the record stays so credits history and `replaced_by` work). Only `approved` ships.

## 4. From originals to the app

### 4.1 Ingest script (`scripts/photos/ingest.py`, Python with Pillow, same style as the other scripts in `scripts/`)

Input: a folder of originals plus an optional `tags.csv` (id, people, mood, time_of_day, scene, allowed_uses, source_url, credit). Steps per file:

1. Read size; reject if the long side is under 800 px; set `low_res` when under 1000 px.
2. Strip EXIF (GPS, camera, owner) and auto-rotate; apply manual crops from `tags.csv` (`crop=l,t,r,b`) for photos with a rounded-corner border or white frame.
3. Write `cover` (long side up to 1200 px, never upscaled, JPEG progressive, quality 76, 4:2:0) and `thumb` (480 px wide, quality 72), plus a placeholder (`thumbhash` or 24 px blur data string, about 30 bytes).
4. Compute `palette.tint` (lower third mean, darkened to 45 percent), `dominant`, `luma_top`, `luma_bottom`, `safe_text` (the calmer of top and bottom thirds by luminance variance) and a first guess for `focal` (peak of gradient energy on a 24 by 24 grid). These heuristics were tried on the 53 candidates of this round and are good for a first pass, not for the final focal point: the review step corrects it.
5. Write or update the record with `status: candidate`; never overwrites a human-edited field (it writes `_auto` copies instead).
6. `scripts/photos/ingest.py check` validates the catalogue against the disk (same checks as `stockPhotos.test.ts`: file exists, real size matches record, tint hex, ids unique) and prints per-mood counts.

### 4.2 Review (who and what)

- Owner: Dada approves and sets `approved`. A second pair of eyes (another teacher or editor) confirms people and rights for anything with faces.
- Checklist per photo: source and credit recorded; permission scope covers this source (see section 6); people tag is honest (would a viewer recognise the person? then `close`); no children without a consent entry; no logos, watermarks, text, political or commercial signs; no sacred portrait cropped out of context; crop has no frames or rounded corners; text zone really is calm; looks right at 44 dp (row) and at full width; the colour does not clash with the app's greens and oranges (no cold blue next to warm UI, except for `night`).
- Output of review: status, `allowed_uses`, corrected `focal` and `safe_text`. The review is a pull request that changes `photos.json` and adds the images, so every approval is in git history.

### 4.3 How editors add photos later without an app release

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Bundle only (today) | image files in the repo, `require` list, new build for every change | works offline from the first launch; no server; simple | each photo needs a release; app grows (about 0.2 MB per photo with cover and thumb); retiring a photo needs a release |
| B. CDN plus manifest | images on blob storage behind a CDN; `manifest.json` (the catalogue) fetched on launch and cached; `expo-image` disk cache holds files | new photos and takedowns in hours, no release; app stays small | needs hosting and a publish step; first launch offline has only the bundled core; one more thing to keep alive |
| C. Admin page | a page in the existing web app where an editor uploads, tags, previews crops and approves | friendliest for non-developers | most work; needs auth and storage; review is outside git unless exported |

**Recommendation: A now, B next, C only if editors really want it.** Ship the new photos in the bundle (a core pack of about 60 photos, sizes in 4.4) with the generated `photos.json`. Add B as an extension: the app always starts from the bundled catalogue, then fetches `GET <api>/photos/manifest?v=<catalogueVersion>` (or a static file in blob storage) at most once a day on Wi-Fi, merges it (new ids appear in pools, `retired` ids disappear, `replaced_by` is followed), caches the manifest, and downloads `thumb` first and `cover` on demand. A failed fetch changes nothing. The publish step is the same PR flow: merging a change to `photos.json` runs ingest checks in CI and copies images and manifest to storage. The existing FastAPI backend and the Azure container setup can host the manifest; images go to blob storage.

### 4.4 Budgets, offline, lazy loading

- **Bundle:** photos at most 14 MB (today 12.7 MB for 49; at cover 1200 px and quality 76 a cover is about 110 to 160 KB, a thumb 25 to 35 KB, so 60 photos are about 10 MB). Remote photos do not count toward the bundle.
- **Cache (option B):** at most 80 MB, least recently used first; always keep the hero pool of the current bucket and the next 3 hero days (prefetch on Wi-Fi only); never evict bundled files (they are not in the cache).
- **Offline:** bundled photos always work; if a remote photo is missing, `photoForSeed` falls back to a bundled photo of the same mood, so offline users never see a hole. The hero must never wait on the network.
- **Lazy loading:** lists load `thumb`; `cover` only when the card is wider than 240 dp or is the hero/player; `expo-image` with `cachePolicy="memory-disk"`, `recyclingKey` in recycled lists, `placeholder` (thumbhash or tint colour) and `transition` 250 ms (no transition under `prefers-reduced-motion`); decode at display size, not original.
- **Tests to add (pure, no images):** every hero bucket has at least 10 approved photos; every mood has at least 6 eligible photos under default rules; no `approved` photo lacks `focal`, `safe_text` or `allowed_uses`; day sequence has no repeat inside N days and no repeat across the epoch boundary; `pickSequence` never returns the same photo three times in a row.

## 5. Library size

Target for the default rules (people none or far, not `low_res`), counting a photo once per mood it carries:

| Pool | Today (approx.) | Target |
|---|---|---|
| hero morning | 13 (with a few people) | 12 |
| hero day | none tagged | 10 |
| hero evening | 10 | 12 |
| hero night (cool allowed) | 3 to 6 | 8 |
| calm (covers) | 19 | 16 |
| long | 11 | 8 |
| festival | 9 | 8 |
| live | 8 | 8 |
| stories (people allowed) | not counted separately | 12 |

That means about 60 distinct approved photos, most of them in two or three pools. Candidates from the Ananda Marga gallery cover morning, evening, forest, water, music and buildings well; they do not cover night, flowers, or empty temple interiors, so those still come from Unsplash (as for the current 27). The gallery itself is mostly people (604 photos, a quarter with children), which is why the usable set is small.

## 6. Credits and rights

- **Where the credit is shown:** (1) About, "Photo credits": one line per photo in use, from `credit` (the screen reads `STOCK_PHOTO_CREDITS`; group by source, link `page_url`); (2) on the share image as a small line when the photo is the visible background; (3) never on the photo in the UI itself, unless a story page asks for it. The line for Ananda Marga photos is required; for Unsplash it is appreciated.
- **About line:** "Photographs from Ananda Marga (anandamarga.org), used with the organisation's permission, and from Unsplash contributors."
- **Permission record:** keep the organisation's permission in writing (who, date, scope: which sites and which uses) outside the public repo; store only a reference in `permission.ref` and in `docs/photo-credits.md`, which is referenced by the code but does not exist yet and should be created in the first phase with the credit list and the permission summary.
- **Scope questions to settle:** the gallery on anandamarga.org also holds pictures that came from `yogamonastery.org` and `anandasambhuti.org` (named in the file origin) and some "drive" uploads with no stated source or author. Take them only when the permission explicitly covers them. Record `provenance` for every photo so this stays answerable. Photos marked with a personal name (for example "dada-...") need the owner's confirmation.
- **People:** permission to use a photo is not consent of the people in it; keep `far` and `none` by default and record `consent` for `close` and `children`.
- **If a source asks to remove a photo:** set `status: retired` and `replaced_by` the nearest photo of the same mood; publish the manifest the same day (option B) so apps stop using it and delete it from cache on the next sync; remove the files from the repo in the next release; answer the requester with the date it left the app. In bundled builds the file stays until the next release, so say that. Do not rely on rewriting git history unless the request requires it. Because seeds are hashed over pools, a retired photo changes some picks: `replaced_by` keeps those covers stable.

## 7. Plan and decisions

### 7.1 Phases (S small, M medium, L large)

| Phase | Work | Size |
|---|---|---|
| P0 | Choose from the candidates; settle rights for sister-site and "drive" photos; create `docs/photo-credits.md` | S |
| P1 | `photos.json` plus generator for `photoData.ts`; migrate 49 records; add `focal`, `safe_text`, `allowed_uses`, `time_of_day`, `season`, `status`; extend `pick.ts` (use filter, time of day, season, `pickSequence`); tests | M |
| P2 | `scripts/photos/ingest.py` (cover, thumb, placeholder, palette, focal, tint) and `check`; ingest the chosen candidates as `candidate` | M |
| P3 | Today: photo of the day with time buckets, epoch order, cross-fade; replace `todayAssets.hero`; welcome and empty states | M |
| P4 | Use `focal` for `contentPosition` and `safe_text` for title placement in hero, stories and mixes; placeholders and transitions; About credits screen | S |
| P5 | Remote manifest, cache, prefetch, retire flow, CI publish step | L |
| P6 | Admin page for editors (only if wanted) | L |

### 7.2 Top 5 decisions for Dada

1. **Bundle or CDN?** Recommend: bundle now (P1 to P4), add the remote manifest later (P5). Reason: no server work before the redesign ships, offline works from day one, and the hybrid path keeps every photo already bundled. Choose CDN-first only if photos must change weekly.
2. **Photo of the day: shared or personal?** Recommend shared by local date and time bucket, no repeats within the bucket's pool size (at least 10 days). It needs no storage and everyone's Today matches; personal rotation is a one-line change later.
3. **People in photos?** Recommend keep today's rule: default none and far, `close` only in Stories and About, children never outside school stories with recorded consent. Far figures are what make the forest and sunrise pictures work; a visible face makes a photo feel like an ad for a person.
4. **How big a library?** Recommend about 60 approved photos: 12 morning, 10 day, 12 evening, 8 night, 16 calm, 8 long, 8 festival, 8 live, 12 stories, with overlap. Today's 33 eligible ones cannot give 10 days of non-repeating evening or night. Of the 39 chosen candidates, 33 are none or far; they mostly fill morning and evening.
5. **Whose photos?** Recommend only photos the organisation has confirmed in writing (anandamarga.org `g-` and `hero-` files first), plus Unsplash for night, flowers and interiors; hold the sister-site and "drive" photos until their source is stated. Cheap to ask now, expensive after publication.
