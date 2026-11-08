# Author profiles

A member can open a public page of their own as an author. The page shows all their Kiirtan, bhajans, Prabhat Samgiita recordings and event playlists in one place, has an address people can share, can be found by search engines, and shows honest listening numbers. This document is the single source for how it works: the model, the flows, the privacy rules of the numbers, the search-engine spec, moderation, and what is not verified yet.

Status: API, mobile app and web page are written on branch `redesign/v2` (PR #23). The API and its tests are committed. See "Not verified" at the end before releasing.

## Summary of decisions already built in

1. One page per member. A member may have a draft, a published page, or a page suspended by the team.
2. Publish first, review after. A page goes live at once unless a rule below holds it for the team. Reports raise attention but never take a page down by themselves.
3. The page address (slug) is the permanent public name. Old addresses redirect for 90 days and cannot be taken by someone else during that time.
4. Numbers are shown only when there is enough data, and never in a way that identifies one listener.
5. Search engines see a page only when it is published, not suspended, not waiting for the team, and has at least one published recording.
6. The team can suspend a page, and the suspension belongs to the member, so deleting the page does not give a clean start (see "Suspension follows the member").

## Model

Tables are created by alembic revision `0033_author_profiles` (after `0032_recording_sets_and_categories`). Code is in `apps/api/app/models/author_profiles.py`.

- `AuthorProfile`: one row per member. Slug, display name, type (`solo` or `group`), short bio (280 characters), longer about text (4000), country and city (80 each), languages, up to 6 links, claimed artist name, status (`draft`, `published`, `suspended`), review state and reason, verified flag, which uploads to show (`all` or `chosen`), whether to show numbers, photo (stored in the database, at most 300 KB), publish and update times.
- `AuthorSlugHistory`: old addresses. Each is reserved for 90 days and answers with a redirect to the current address.
- `AuthorRecordingChoice`: the exceptions to the "which uploads" rule, one row per recording.
- `AuthorReport`: a report about a page (reason, comment, who, when).
- `AuthorSuspension`: one row per suspended member, independent of the page. Holds the reason, who suspended, and a JSON copy of the evidence if the page was deleted while suspended.
- `PlayEvent`, `PlayDaily`: listening statistics (see "Statistics").

Text rules (`apps/api/app/services/author_rules.py`): control characters and right-to-left override characters are removed, whitespace is folded, free text (name, bio, about, place) may not contain a web address or a domain name (links go only in the links list), and the list of links has these rules:

- https only. `javascript:`, `data:`, `file:`, `mailto:`, `ftp:` and plain `http:` are refused.
- No credentials in the address, no port, no private or local hosts (`localhost`, IP addresses, `.local`), no single-label hosts.
- A link of a known kind (YouTube, Instagram, Facebook, Telegram, Spotify, SoundCloud, Bandcamp, Apple Music, X) must point at that network's own domains. `website` is any public https host.
- At most one link per kind except `website`; at most 6 in all; repeats are dropped.
- On every page the link is rendered with `rel="nofollow ugc noopener noreferrer"` and opens in a new tab. The page also says that the team does not check the sites the links lead to.

Typed text (names, bios, comments, chord notes, playlist titles) goes through one helper, `app/services/invisible_text.py`: zero-width characters, bidi controls and other invisible characters are dropped, but the joiner and non-joiner (U+200D, U+200C) are kept where they shape letters, that is between two letters or marks of an Indic script (`क्‍ष`, `ক্‍ষ`), of the Arabic script (Persian `می‌خواهم`) or between two emoji, and dropped leading, trailing, doubled and next to Latin letters, digits or spaces. The staff and look-alike checks ignore joiners either way. A combining mark or variation selector is kept only while it sits on a base character before it (a Devanagari matra, a Vietnamese tone, an emoji selector); one with nothing to sit on is dropped, so a name made only of marks is empty and refused. No base character keeps more than 4 marks (`MAX_MARKS_PER_BASE`; real writing needs up to 3), so stacked zalgo text is cut to 4 marks per letter. Characters that look blank (Hangul fillers, braille blank, combining grapheme joiner, Khmer inherent vowels) are dropped, so a name or note made only of them is empty and refused; tag characters are dropped except in the three flags of England, Scotland and Wales (a waving black flag, tags spelling exactly `gbeng`, `gbsct` or `gbwls`, cancel tag); any other tag run is stripped to a bare flag, so tags cannot carry hidden text.

Slug rules: 3 to 30 characters, lowercase letters, digits and single hyphens, must contain a letter, must not be on the reserved list (app routes, `admin`, `api`, `upload`, `sign-in`, and similar, including variants with and without hyphens). Typed names are normalised (`Bábá Nám` becomes `baba-nam`). A name with no Latin letters gives an empty slug and the app asks for another.

## Flows

Create (app: Become an author, `app/become-author.tsx`), four steps:
1. Your name. The link to the page (`/author/<slug>`) is made from the name by itself and checked live with `GET /authors/slug-check`, which suggests free alternatives when it is taken. See "The page link" below.
2. About you: Singer or Group, short line, about text, place, languages, links and picture (all optional), and "Known under another name" for people who already appear in the library under another name (the team checks this before the page goes public).
3. Your recordings: all of the member's published uploads (default) or only chosen ones, and whether visitors may see the numbers.
4. Preview, then "Save as draft" or "Publish". Publishing is refused with a plain message when the name or link needs the team, and the page then waits (see Moderation).

Every step keeps what was typed when the network fails, leaving with unsaved text asks first (`LeaveCard`), and a missing required field is outlined in red and the screen scrolls to it (`lib/forms/focusInvalid.ts`, the helper shared with the upload form).

Appearance: the public page (app `app/author/[slug].tsx`, web `/author/<slug>`) shows photo, name, "Verified" mark if the team verified it, bio, place, numbers if allowed and enough, recordings grouped by kind, event playlists, about text, links. The app adds Play, Shuffle and Share.

Adding songs: nothing to do. Recordings the member uploads through the normal upload flow appear on the page when they are published and are included by the "which uploads" rule. The member manages exceptions in My author page, "Recordings" (`GET /authors/me/recordings`, `PUT /authors/me/recordings/{id}`).

How people see it:
- By address: `/author/<slug>` on the web, or the same address opened in the app (the deep link maps it to the author screen).
- In the app search, a block of matching authors above the recording results.
- On a recording page, a line "By <author>" when the uploader has a published page, and a "More from this author" list.
- In the catalog, `/authors` in the app and on the web (see "The catalog" below).

Edit, unpublish, delete, export: `PATCH /authors/me`, `POST /authors/me/unpublish`, `DELETE /authors/me` (the page, photo and choices are removed; uploads stay), `GET /authors/me/export` (all the data the page holds, as JSON). Changing the address is limited to once in 30 days.

## Statistics

Events and counting rules (`apps/api/app/services/author_stats.py`):

- The app reports a play when the listener has listened 30 seconds, or half of a track shorter than 60 seconds, but never less than 10 seconds. Seeking ahead does not count; only time actually played does.
- A play is unique per recording, listener key and day. Replaying the same track the same day by the same listener is one play.
- The author's own listening is not counted.
- Batches of at most 50 events per request (the schema accepts 200 and the server counts the first 50; the rest are rejected as `batch_limit`). Events older than 7 days are rejected, as are events more than 5 minutes in the future. One listener counts at most 300 plays a day.
- The app sends events in batches (`POST /plays`) and keeps them on the device if offline.

Listener identity: the server computes `HMAC(secret, "m:<member id>" or "d:<random device id>")`, truncated to 24 bits, and stores only that. No device id, no member id and no address is kept in the statistics tables. Because 24 bits collide, the count of distinct listeners is corrected with the linear-counting estimate (`estimate_distinct`). The secret is `AUTHOR_STATS_PEPPER`; if it is not set the server falls back to the recording signing secret, then the member proxy key, then a development value. Production must have one of the first two (see Not verified).

Made-up device ids: a signed-out listener is only a random device id, so one client could invent listeners. Each signed-out play stores `client_key`, a short keyed hash of the client address (an IPv6 client by its /64; never the address itself). One client may add at most 10 new device listeners per recording per day and 30 in all per day (`NEW_LISTENERS_PER_CLIENT_PER_RECORDING_DAY`, `NEW_LISTENERS_PER_CLIENT_PER_DAY`). Beyond that the play still counts as a play but the device is stored with `counts_listener = false` and is not a listener in any number. A device already counted today is never dropped. Signed-in members are not capped. Plays have their own cap: the same client may add at most 200 signed-out plays per recording per day and 1000 in all per day (`UNSIGNED_PLAYS_PER_CLIENT_PER_RECORDING_DAY`, `UNSIGNED_PLAYS_PER_CLIENT_PER_DAY`). A play over the cap is stored (so it can be looked at) but is not added to the public plays, the 30-day plays or the listeners, and the app is told it was accepted so a script cannot find the limit. The cap counts every play received from the client that day, over-cap ones included, so a client that has passed it stays over it until the next day (UTC). The batch rate limit (120 batches a minute per host) is separate. The cap assumes the API sees the real client address; behind a proxy that hides it, all signed-out listeners look like one client and listener numbers would be low (plays stay right).

Retention: `play_events` rows are deleted after 400 days. `play_daily` (per recording per day: plays and listeners) is kept for the life of the page. Deleting the page deletes its statistics.

Public numbers: monthly listeners (distinct listeners in the last 30 days) and total plays. Shown only when the page has at least 10 counted plays and the author has not switched numbers off. Below that the page says "Not enough listening yet" and the date counting started; it never shows a zero as if it were a measurement. In mock data the app labels every number "Demo".

Weekly series (`PublicStats.weeks`, `weekly_plays` in `author_stats.py`): the last 12 blocks of seven days ending today, each `{start, plays}`, oldest first. It is only the plays of the page's own public recordings (the same set as the page lists), summed per week from `play_daily`, so the daily caps above already apply and the author's own listening is not in it. It carries no listener, device or country. Weeks before counting started are left out; weeks since then with no plays are present with `plays: 0`. It is `null` when the owner has switched the numbers off, and `null` below 10 counted plays (exactly 10 gives a series, 9 does not). Author blocks (`AuthorBlock`) hide a page from one viewer's directory only and the public page response is cached for everyone, so the series is a page-level aggregate and does not change per viewer. No migration was needed.

Statistics block on the page (variant A falling back to D; `PublicStatsStrip` in `components/authors/StatsViews.tsx`, rules in `lib/authors/statsView.ts`, tests in `__tests__/authorStatsView.test.ts`). `statsMode` picks one of four views:

- `none`: the owner hid the numbers; the page has no block at all.
- `quiet`: under 10 counted plays; one sentence "counting since <date>", never a number.
- `line` (variant D): 10 or more plays but fewer than 3 weeks of data (`MIN_CHART_WEEKS`) or plays in fewer than 2 of the weeks (`MIN_ACTIVE_WEEKS`), or an older server that sends no series; one plain line, "312 listeners a month · 3.3K plays".
- `chart` (variant A): the total plays big, "plays since <date>", a 12-week line with a soft fill and one orange dot for this week, "9 weeks ago" to "this week", then "312 people listen every month".

Variants B and C of the board were never built. Tests cover exactly 10 and 9 plays, no weeks, one week short of the chart, one active week only, hidden numbers (API and screen helper), and the line geometry.

Owner numbers (`GET /authors/me/stats?days=7|30|90`): plays and listeners per day, top recordings, plays by kind, monthly listeners, total plays, and countries. Countries come from the device region (two letters), which the app does not send unless the member allows it. A country is listed only with at least 5 listeners, and only when the whole sample is at least 20 listeners; otherwise the answer is hidden. The response carries `notes` that the app shows as plain sentences: how a play is counted, that own plays are excluded, that the listener count is an estimate, and when there is no or not enough data.

Not counted: plays on the web page (the audio element there is a plain player). This is a decision for Dada.

## Search engines (`apps/web`)

Spec, implemented in `app/author/[slug]/page.tsx`, `app/authors/page.tsx`, `app/sitemap.ts`, `app/robots.ts`, helpers in `lib/authors.ts`:

- Server-rendered. All text, recordings and links are in the HTML. Data is cached for 60 seconds (directory and sitemap 300).
- Title: `<Name>: <Kiirtans and bhajans> | Prabhat Samgiita`. Description: the bio, cut to 200 characters; if there is no bio, a plain sentence.
- Canonical: `<site origin>/author/<slug>`, where the origin is `NEXT_PUBLIC_SITE_URL` (default `https://www.prabhatasamgiita.org`).
- Open Graph (`type=profile`, title, description, url, photo) and Twitter card (`summary_large_image` when there is a photo).
- Robots meta: `index, follow` only when the API says `indexable: true`. That is true when the page is published, not suspended, not waiting for the team, and has at least one published recording. Everything else is `noindex, nofollow`, including the not-found and error pages.
- JSON-LD (`@graph`): `ProfilePage`, the author as `Person` (solo) or `MusicGroup` (group) with `sameAs` links (https only), and up to 50 `MusicRecording` items that point back with `byArtist`, with ISO 8601 duration, language and year when known. The JSON is escaped (`<`, `>`, `&`, line separators) so a name can never close the script tag.
- `sitemap.xml`: `/authors` plus every address returned by `GET /authors/sitemap`, which already applies the indexable rule. `robots.txt`: allows `/author/` and `/authors`, closes `/api/`, `/admin` and sign-in areas, and names the sitemap.
- Old addresses: the API answers `301` with `{code: "moved", slug}`; the page calls `permanentRedirect`, which Next.js sends as `308`. Search engines treat 301 and 308 the same. A deleted page answers `410 Gone`, one that never existed `404`.
- The real status codes come from `middleware.ts` (via `lib/author-status.ts`), not from the page. The site's root `loading.tsx` makes every page stream, and a streamed page has already sent `200` when it learns that an author moved or is gone, so a `permanentRedirect()` or `notFound()` inside the page only produced a client-side redirect or a `200` with `noindex`. The middleware asks the API first (2.5 s limit, never blocks the page if the API cannot be reached) and answers `308` with the new address, or a small `noindex` page with `404` or `410`. Every other answer, including an API error, is left to the page, which then renders its own error state with `200` and `noindex`; answering `503` there instead is a possible later improvement.
- The page also offers "Open in the app" (`prabhatai:///author/<slug>`).
- Universal links: `/author/*` is not yet in `public/.well-known/apple-app-site-association` or the Android intent filter. Adding it makes https links open in the app on phones that have it, and needs a new native build. It stays for the native build.

## Moderation

Rules are in `author_rules.py` and `services/author_profiles.py`. Team tools are in `app/api/v1/author_profiles.py`, `admin_router` (all under `/api/v1/admin/authors`).

Publish first: a page goes live at once, except when one of these holds it for review (`review_needed`, with `review_reason`):
- `protected_name`: the name or address contains the founder's name, the organisation's name or the app's name (`Anandamurti`, `Ananda Marga`, `Prabhat Samgiita` and spelling variants).
- `staff_name`: the name or the address contains a word that sounds like staff (whole words `team`, `official`, `support`, `moderator`, `admin`, `verified`, `staff`, also with a number or an s, as in `admin1` or `admins`; and the longer ones inside a word, as in `officialps`), or an owner's name (`Dada Maetreya`, `Maitreya`, `Maetreya`). The text is first reduced to plain Latin letters (the table is built from Unicode character names: every `LATIN LETTER SMALL CAPITAL X`, and named Greek and Cyrillic letters; the same folding is used by the protected-name and look-alike checks), so disguises do not get past it: look-alike Cyrillic and Greek letters (`Аdmin Теаm` written with Cyrillic А, е, Т), Greek capitals such as Mu (`Μoderator`), Latin small capitals (`ᴀdmin`), mathematical letters, fullwidth letters (`Ａｄｍｉｎ`), zero-width, soft-hyphen and bidi characters inside a word, and simple leetspeak (`4dm1n`, `supp0rt`, `0ff1c14l`; `0` is o, `1` is i, `3` is e, `4` is a, `5` is s, `7` is t). `Teamwork` and `steamboat` are still ordinary names. A page the team has verified is not held for this, so the team's own pages work. The slug check warns about it up front (`held_for_review`).
- `artist_claim`: the member wrote a claimed artist name ("I am the artist known as ..."). Claimed names are not shown as verified until the team approves.
- `look_alike_page`, `look_alike_artist`: the name is alike (after folding spelling, order, digits-for-letters) an existing published page or an artist name in the catalogue.
- `reported:<reason>`: the page got 3 reports, or one report with reason `impersonation` or `copyright`. The page stays up; it is put at the top of the team list.

A page held for review is saved as a draft with a plain explanation to the owner and is not indexable.

Reports: the count that raises review is the number of reports since the last approve; approving sets it to zero, so old reports do not hold the page again on the next one. `POST /authors/<slug>/report` with a reason (`impersonation`, `offensive`, `spam`, `copyright`, `wrong_info`, `other`) and an optional comment up to 1000 characters. One report per reporter per page; a second answers `already_reported`. The reporter's identity is never shown to the author.

Team actions: list pages (filters: `status`, `needs_review`, `reported`, text search `q`), read the reports of a page, approve (clears the holds; publishes only a page that was held for its name after the owner sent it for publishing, never a draft the owner saved or a page the owner unpublished; starts the count of reports from zero, the reports themselves are kept), verify and unverify, suspend with a reason, unsuspend, list suspensions, lift a member's suspension.

Rate limits (per member unless noted): create tries 20 per hour per member and 60 per day per host; deletes 5 per day; edits 40 per hour; slug checks 60 per minute per host; reports 5 per hour; plays 120 batches per minute per host and 600 per hour per listener.

Reserved addresses: a fixed list (app routes, roles) plus every literal segment right under `/authors`, derived from the router when the module loads (`sitemap`, `slug-check`, `me`, `by-recording`, ...), so a new route can never be taken as an address. Tested against the router. Reserved and protected words, bio and link validation, `rel="nofollow ugc noopener noreferrer"` and the content-rules paragraph: the validation is server-side and tested (`test_author_rules.py`). The visible rules text for members is the `authors.*` strings in en, ru, es.

### Review flags and verification

Two rules close ways to lose or skip a review (security review, medium):
- A report-driven hold has its own field, `report_reason` (the reason of the report that crossed the threshold), apart from the name-check fields `review_needed` and `review_reason`. Name checks, publishing, unpublishing, renaming and verifying never touch it, and it can never be overwritten by a name-check reason. Only the team's approve clears it. The owner and team views merge the two: the name-check reason is shown first, else `reported:<reason>`. A page with a report hold is not indexable and not in the sitemap, but stays public. The column arrives in migration `0035_author_review_and_play_caps` (after `0034_recording_extras`); `0033_author_profiles` is unchanged from its first commit. The revision moves existing `reported:<reason>` holds into `report_reason`, is safe to run twice or after `create_all`, and its downgrade puts them back.
- A verified artist claim exempts only the claim itself. Every publish still runs the protected-name check and both look-alike checks (`review_reason_for(..., skip_claim=profile.verified)`). Changing the display name, the address or the claimed name also removes the verification, because the team verified the old identity.
- Tests: `test_unpublishing_and_publishing_keep_a_flag_raised_by_reports`, `test_a_name_check_never_overwrites_a_report_hold`, `test_unpublishing_still_clears_a_name_check_flag`, `test_a_verified_claim_does_not_skip_the_other_name_checks`, `test_renaming_or_moving_a_verified_page_removes_the_verification`.

### Suspension follows the member (QA-031)

Problem found by QA and by the security review: suspend a page, then delete it, then create a new page with another address, and the new page was published clean.

Rule now: a suspension is stored as an `AuthorSuspension` row per member, not only on the page.
- `POST /authors/me` for a member with such a row answers `403` with code `suspended`. `GET /authors/me` returns `can_create: false` and the `suspended_reason`, so the app shows the reason and no create button.
- `DELETE /authors/me` of a suspended page succeeds (the member may remove their data) but stores the evidence first: address, display name, claimed name, deletion time and all reports (reason, comment, time), as JSON in the member's suspension row. The team can read it in `GET /admin/authors/suspensions`.
- `POST /admin/authors/{id}/unsuspend` and `POST /admin/authors/members/{member_id}/lift-suspension` remove the member's row, so only the team can give the member a new page.
- Tests: `test_the_suspension_evasion_sequence_is_closed`, `test_deleting_a_suspended_page_does_not_give_a_clean_start`, `test_lifting_the_suspension_of_a_page_lifts_the_member_record` (in `apps/api/tests/test_author_profiles.py`).

Note on identity: members sign in with their own account, but the member-auth layer between the web and the API still uses a shared key (see `docs/security-member-auth.md`). A suspended person who signs up with a second account is not stopped by this rule. This is the same weakness that applies to every member rule in the app.

## Endpoints

All under `/api/v1`.

| Method and path | Who | What |
| --- | --- | --- |
| `GET /authors/slug-check?slug=` | member | Is this address free; problem code and suggestions |
| `GET /authors/me` | member | Own page (or null), `can_create`, `suspended_reason` |
| `POST /authors/me` | member | Create (draft or publish) |
| `PATCH /authors/me` | member | Edit |
| `POST /authors/me/publish`, `/unpublish` | member | Change status |
| `DELETE /authors/me` | member | Delete the page |
| `GET /authors/me/export` | member | All own page data |
| `PUT /authors/me/photo`, `DELETE /authors/me/photo` | member | Photo, 300 KB |
| `GET /authors/me/recordings` | member | Own uploads with shown/exception state |
| `PUT /authors/me/recordings/{id}` | member | Show or hide one recording |
| `GET /authors/me/stats?days=7\|30\|90` | member | Owner statistics |
| `GET /authors` | public | Directory (`q`, `sort=listeners\|new\|name`, `limit`, `offset`) |
| `GET /authors/sitemap` | public | Addresses and update times of indexable pages |
| `GET /authors/by-recording/{id}` | public | The author line of a recording |
| `GET /authors/{slug}` | public | Page; `301` with `{code: "moved", slug}`, `410` gone, `404` |
| `GET /authors/{slug}/photo` | public | Photo (the URL carries a version for caching) |
| `GET /authors/{slug}/recordings` | public | Recordings (`kind`, `collection_id`, `exclude`, `limit`, `offset`) |
| `GET /authors/{slug}/collections` | public | Event playlists |
| `POST /authors/{slug}/report` | member | Report a page |
| `POST /plays` | member or device | Batch of play events |
| `GET /admin/authors`, `GET /admin/authors/{id}/reports` | team | List, read reports |
| `POST /admin/authors/{id}/approve`, `/verify`, `/unverify`, `/suspend`, `/unsuspend` | team | Team actions |
| `GET /authors/me/claims/summary`, `/suggestions`, `/search`, `GET\|POST /authors/me/claims`, `DELETE /authors/me/claims/{id}`, `GET\|POST /authors/me/aliases`, `DELETE /authors/me/aliases/{key}` | member | Claiming recordings (see below) |
| `GET /admin/authors/claims`, `POST /admin/authors/claims/bulk`, `POST /admin/authors/claims/{id}/approve\|reject\|revoke` | team | Claims desk |
| `GET /admin/authors/suspensions` | team | Member suspensions with evidence |
| `POST /admin/authors/members/{member_id}/lift-suspension` | team | Allow the member a new page |

## Where it plugs into the app

Done: screens and routes in `app/_layout.tsx`, the play reporter host, locale strings (en, ru, es) in `locales/authors.ts`, rows `author-pages` and `author-forms` in `lib/playerPolicy.ts` and `docs/player-visibility.md`, deep link mapping in `lib/deepLinks.ts`, and the reset of author data on account deletion.

For the owners of those screens to add (one line each, components exist):
- Upload hub: `<AuthorHubRow theme={theme} />`.
- Recording page: `<AuthorLine theme={theme} recordingId={kirtan.serverId} />` under the title, and `<MoreFromAuthor theme slug name excludeId />` below.
- Unified search: `<AuthorsSearchBlock theme={theme} query={query} />` (the search owner places it; the route `/authors` it links to is stable).

Done by the authors owner: the "Authors" shelf on the Kiirtan tab (`components/authors/AuthorsShelf.tsx`, one `<Reveal>` block in `app/kiirtan.tsx`), with "See all" into `/authors`.

## The page link (what used to be called "address")

**Hidden for now (2026-11-08, Dada):** the interface does not show the page link at all (no field, no "Change link", no link line on "Your author page", no word about it in the first step). The flag is `SHOW_PAGE_LINK` in `apps/mobile/lib/authors/constants.ts`; set it to `true` to bring everything below back. The link is still made from the name, kept by the API and used by Share and Copy; if the made-up link is taken, the next free suggestion is taken silently.

The link is the public name of the page: `www.prabhatasamgiita.org/author/anna-rao`. People open it in a browser, search engines list it, and members send it to friends. It cannot be removed, because without it there is no page, so the form no longer asks for it as a main field.

- It is made from the name while typing (`lib/authors/slug.ts`), checked against the server (free or taken, with two suggestions that take one tap), and shown as one line under the name field with the label "Your page link" and one sentence of explanation.
- A small "Change link" link opens the field for people who want something else. Rules: Latin letters, numbers and hyphens, 3 to 30 characters.
- Changing it later: once in 30 days, the old link keeps working for 90 days and no one else can take it meanwhile.

## Page layout

The public author page has one layout, "Showcase" (Dada chose it; the other two and the `?v` switch are gone): a round photo beside the name, "Play all" with a count, the numbers, then a "Most played" shelf and the recordings. It works with and without a photo. The code is `components/authors/AuthorShowcase.tsx`, used by `app/author/[slug].tsx` for everyone. The cover hero (`AuthorHero.tsx`) stays only for the preview in "Become an author".

### Hiding the numbers

The setting "Show my listening statistics on my public page" (`show_stats`, default on) is the switch. When it is off the public page shows no number at all: no monthly listeners, no total plays, no "Most played" shelf, and `GET /authors/{slug}/recordings` returns `plays: null` for every recording (`AuthorRecordingOut`). The owner still sees every number on "Your author page". Tests: `test_author_stats.py::test_switched_off_numbers_show_nowhere_on_the_public_page` (signed out, another member, the owner) and `__tests__/authorDemo.test.ts`. Board of the statistics block: `Для-Дады/автор-статистика-варианты/index.html` (A to D; Dada chose A with a fallback to D, built, with real 390 px screenshots at the top).

## The catalog

One screen, `/authors` (`app/authors.tsx`): search, order (most listened, new, A to Z), filters by kind (Kiirtan, Bhajan, Prabhat Samgiita, and the rest of the kinds) and by language, a way into "Become an author" or "Your author page" (it asks the store whether the member has a page, so it is right even when the screen is opened from a link), every empty and error state, and "Clear filters". The API takes `kind` and `language` and each snapshot stores the kinds it has (`kinds` column, migration 0038).

Where it is reached from (three placements were drawn, board 7): A, a shelf on Today; B, a block in the search tab; C, a shelf on the Kiirtan tab. Built: C, because people on the Kiirtan tab are the ones who care who sings, the shelf is narrow (round photos), and under a kind chip it shows only that kind. The search block (B) stays as an extra door, placed by the search owner. Today (A) is left out: it is already a dense shelf of the song of the day and festivals.

## Claiming recordings that somebody else added

A performer who makes a page can ask for recordings that already sit in the library under their name, whoever added them. Two ways in (Dada chose them): suggestions (a card on "Your author page", opened by "Look through them", `app/author-claims.tsx`) and a search page "Find my recordings" (`app/author-find.tsx`). Code: `services/author_claim_rules.py` (pure matching), `services/author_claims.py` (finding, the ladder, the team desk), `api/v1/author_claims.py`, migration `0045_author_claims` (tables `author_claims`, `author_claim_events`, `author_aliases`).

Decided by Dada: the uploader is **not asked** and cannot dispute; the uploader only gets an information notice (`claim_on_your_recording`, no actions; none for library recordings). One recording may be on several pages. Pages of deceased or unreachable performers are run by the team.

Matching. A credit is split into names (`,` `;` `&` `+` `/`, "and", "with", "feat.", "x"). Two names are "the same" when their `match_key` is equal: case, accents and look-alike letters folded, Devanagari and Bengali transliterated, and the usual spelling variants made equal (Dewi/Devi, Shri/Sri, sh/s, dh/d, aa/a, ii/i, doubled letters). "Alike" is a near name (one letter off, words reordered, one name inside a longer one). "Title" is the name written only inside the title; only the search page offers it.

The ladder (`Ladder.standing()`). A claim is **approved at once** (route `self`) only when all hold: the page is published and verified, has no review or report flag, is a solo page, the credit names one person, the level is "same" against the **trusted names** of the page, and the name is not protected, famous or already asked for by another page. Otherwise it goes **to the team** (route `team`) with the first matching reason: `protected_name`, `famous_name`, `taken_by_other`, `alias_match`, `group_credit`, `group_page`, `not_same_name`, `unverified_page`, `draft_page`, `review_flag`. The screens show the reason to the person.

- Famous name: credited on 25 or more library recordings (no uploader), or equal to another published verified page's name or claimed name, or protected or staff-like (`FAMOUS_RECORDING_COUNT = 25`).
- Trusted names are the display name and, only for a verified page, the claimed name. **A name the member adds as "written another way" (an alias) is never trusted.** A match found only through an alias always goes to the team as `alias_match`. Aliases are limited to 5 per page and checked when added: not protected, not staff-like, not the name of another page (`alias_not_allowed`, `alias_taken`, `alias_limit`). Tests (`test_author_claims.py`): an alias equal to a famous name or to another page's name never approves by itself; alias-only matches go to the team; a verified page with its exact claimed name still approves by itself; an alias flood is capped.
- Limits: 30 requests a day, 200 waiting, a pause of 7 days after 3 refusals in a row, at most 50 recordings in a call.
- Once approved, the recording is on the page (`attribution()` includes recordings with an approved claim) and counts in the page's statistics like any other (statistics follow the recordings on the page; the member's own plays are still not counted). The owner can take a waiting or approved request back (`DELETE /authors/me/claims/{id}`); the team can reject or revoke.
- The old rule stays: a verified page also shows recordings whose credit equals its claimed name exactly (no backfill into claims).

Team desk (API only, no screen yet): `GET /admin/authors/claims`, `POST /admin/authors/claims/bulk`, `POST /admin/authors/claims/{id}/approve|reject|revoke`. Each decision tells the member (`claim_approved`, `claim_rejected`, `claim_revoked`).

Member endpoints: `GET /authors/me/claims/summary`, `/suggestions`, `/search?q=`, `GET|POST /authors/me/claims`, `DELETE /authors/me/claims/{id}`, `GET|POST /authors/me/aliases`, `DELETE /authors/me/aliases/{key}`.

Board with the real screens and the decisions: `Для-Дады/автор-подтянуть-записи/index.html` (top section "Готово · фаза 1"; the four earlier proposals are kept below it as an archive). The preview demo (`lib/authors/demoClaims.ts`) answers the same calls from invented library recordings and can be put into states with `__authorsDemo.setClaims`, `setClaimLibrary` and `setClaimsPaused`.

Still for Dada: whether an unverified page may approve clear same-name recordings by itself; how fast the team verifies pages (verification gates every automatic approval); whether the member's own uploads credited to another name stay on the page by default; whether 25 is the right famous-name threshold; whether the team desk needs a screen; and the display of the new notice kinds in the notification centre (another agent's file).

## Scenarios that were worked through and tested

Create (four steps, draft, publish, claimed name, network error, leave guard, signed out, blocked, load error), edit (picture add and remove, name, link with cooldown, saved, save error, leave guard), my page (published, draft, waiting for the team, verified, reported, suspended, small-listener state, no plays and no recordings, hide a recording, unpublish, delete with confirmation, statistics error, load error, no page, signed out), public page (signed out, signed in, own page, report form, report sent, report again, moved, deleted, not found, small listeners, error, playlists, empty about), the page layout, the catalog (filters, no match, error, with my page) and the Kiirtan shelf. Screenshots of every state at 390 pixels are in `Для-Дады/автор-v2/` (made with `scratchpad` scripts against the preview, where `authorsApi()` is an in-memory demo that can be put into any of these states with `globalThis.__authorsDemo`). Rules are covered by `__tests__/authorScenarios.test.ts` and the existing author tests.

## Test data

User-made author profiles live only in memory in the preview, so a reload clears them. The only persisted store touched is `playQueueStore` (persist version 2), so old test queues vanish. Seed demo data is kept.

## Decisions

Decided by the authors owner (change any of them by one constant; each is recorded here so it is not a surprise):

1. Uploads shown by default: all published uploads (`DEFAULT_INCLUDE_UPLOADS = "all"`); any single one can be switched off.
2. Listener key rotation: stable (`LISTENER_SALT_ROTATION_DAYS = 0`). A daily key would be more private but would make monthly listeners impossible to count.
3. Numbers become public after 10 plays (Dada, 2026-11). Country threshold: 5 listeners per country and 20 in all.
4. Link change: once in 30 days; the old link held for 90 days.
5. Reports: 3 reports raise review; impersonation and copyright raise it at once. A report never takes a page down by itself.
6. Photo kept in the database (300 KB). Object storage is the alternative once volume grows.
7. A claimed artist name needs team verification before any "Verified" mark.
8. Evidence of a suspended page is kept after deletion, without a time limit for now.
9. Device region is not sent by default; countries appear only for members who allow it.
10. Plays are counted without a separate consent screen, since only a short keyed hash is stored. Check this against the stores' privacy forms before release.
11. Web plays are not counted yet.
12. Caps against scripts: 10 new listeners per recording and 30 per day per client; 200 plays per recording per day and 1000 per day per client. A sangha hall of 300 phones on one wifi would have its last plays held out of the public number. The proxy address is not trusted for caps beyond that.
13. Team members' own pages are exempt from nothing: a page that uses a staff word or an owner's name is held for the team until verified, so a team member's page needs the team's verification once.
14. Upload language rule (Dada's): required for Bhajan and Spiritual song, none for Kiirtan, optional for Prabhat Samgiita, and for Dance music the dance is required and the language optional. Owned by the upload code, not by the author pages.
15. Statistics block: variant A (big number and a 12-week line), falling back to variant D (one text line) when the history is too short (Dada, 2026-11). The weekly series is public, aggregate and per page only.

Needs Dada (changes what people see):

1. Whether the catalog also gets a door on Today (built: Kiirtan tab shelf and the search block).
2. Universal links for `/author/*` (https links opening in the app; needs a new native build).

## Not verified

- The web pages are built and tested: `next build` passes, the standalone server renders `/author/<slug>` and `/authors` with title, description, canonical, `index, follow`, JSON-LD (`ProfilePage`, `Person`, `MusicRecording`), and serves `sitemap.xml`, `robots.txt`, `308` for a moved link, `404` and `410`. This was checked against a small stub API that returns the documented shapes, not against the real API with real data; run the same URLs against a staging API before release. Unit tests: `apps/web/tests/authors.test.ts` and `apps/web/tests/author-status.test.ts`.
- Nothing was run against PostgreSQL. API tests use SQLite; the migration has a test (`test_author_profiles_migration.py`) but a real upgrade on a copy of production is needed.
- `AUTHOR_STATS_PEPPER` (or the recording signing secret) must be set in production; without both, a development value is used.
- Real devices: the play reporter was exercised in the web preview and unit tests only. Background playback, offline batching and app restarts on iOS and Android are not tested.
- Search engines: robots, sitemap and JSON-LD follow the spec above, but indexing was not tested with Google's rich results test or Search Console.
- The preview in the browser sometimes shows a red overlay from the audio player library (circular initialisation, `CAPABILITY_PLAY`). It also happens without the author screens; it is not caused by this feature.
- The i18n coverage script reports 5 false positives in `authors` files (dynamic key families); the locale test (`authorLocales.test.ts`) checks them properly.
- The full mobile suite has one failing test outside this feature (`kirtanSets.test.ts`, daily limit).
