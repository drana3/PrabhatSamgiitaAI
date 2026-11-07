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

Typed text (names, bios, comments, chord notes, playlist titles) goes through one helper, `app/services/invisible_text.py`: zero-width characters, bidi controls and other invisible characters are dropped, but the joiner and non-joiner (U+200D, U+200C) are kept where they shape letters, that is between two letters or marks of an Indic script (`क्‍ष`, `ক্‍ষ`), of the Arabic script (Persian `می‌خواهم`) or between two emoji, and dropped leading, trailing, doubled and next to Latin letters, digits or spaces. The staff and look-alike checks ignore joiners either way. Characters that look blank (Hangul fillers, braille blank, combining grapheme joiner, Khmer inherent vowels) are dropped, so a name or note made only of them is empty and refused; tag characters are dropped except in the three flags of England, Scotland and Wales (a waving black flag, tags spelling exactly `gbeng`, `gbsct` or `gbwls`, cancel tag); any other tag run is stripped to a bare flag, so tags cannot carry hidden text.

Slug rules: 3 to 30 characters, lowercase letters, digits and single hyphens, must contain a letter, must not be on the reserved list (app routes, `admin`, `api`, `upload`, `sign-in`, and similar, including variants with and without hyphens). Typed names are normalised (`Bábá Nám` becomes `baba-nam`). A name with no Latin letters gives an empty slug and the app asks for another.

## Flows

Create (app: Become an author, `app/become-author.tsx`):
1. Name and type, address (checked live with `GET /authors/slug-check`, with suggestions), short bio, place, languages.
2. Links and photo (optional).
3. Which uploads to show. Default is all of the member's published uploads. The member can switch off single recordings, or choose only some.
4. Choose "Save as draft" or "Publish". Publishing is refused with a plain message when the address or name needs the team, and the page then waits (see Moderation).

Appearance: the public page (app `app/author/[slug].tsx`, web `/author/<slug>`) shows photo, name, "Verified" mark if the team verified it, bio, place, numbers if allowed and enough, recordings grouped by kind, event playlists, about text, links. The app adds Play, Shuffle and Share.

Adding songs: nothing to do. Recordings the member uploads through the normal upload flow appear on the page when they are published and are included by the "which uploads" rule. The member manages exceptions in My author page, "Recordings" (`GET /authors/me/recordings`, `PUT /authors/me/recordings/{id}`).

How people see it:
- By address: `/author/<slug>` on the web, or the same address opened in the app (the deep link maps it to the author screen).
- In the app search, a block of matching authors above the recording results.
- On a recording page, a line "By <author>" when the uploader has a published page, and a "More from this author" list.
- In the directory, `/authors` in the app and on the web, sorted by monthly listeners, newest, or name.

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

Public numbers: monthly listeners (distinct listeners in the last 30 days) and total plays. Shown only when the page has at least 5 counted plays and the author has not switched numbers off. Below that the page says "Not enough listening yet" and the date counting started; it never shows a zero as if it were a measurement. In mock data the app labels every number "Demo".

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
- Old addresses: the API answers `301` with `{code: "moved", slug}`; the page calls `permanentRedirect`, which Next.js sends as `308`. Search engines treat 301 and 308 the same. A deleted or never-existing page answers `404`. The API says `410 Gone` for a deleted page, but the page shows the same 404 for both; this is deliberate so a deleted page does not announce that it existed.
- The page also offers "Open in the app" (`prabhatai:///author/<slug>`).
- Universal links: `/author/*` is not yet in `public/.well-known/apple-app-site-association` or the Android intent filter. Adding it makes https links open in the app on phones that have it, and needs a new native build for Android. Left out on purpose until Dada decides.

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
| `GET /admin/authors/suspensions` | team | Member suspensions with evidence |
| `POST /admin/authors/members/{member_id}/lift-suspension` | team | Allow the member a new page |

## Where it plugs into the app

Done: screens and routes in `app/_layout.tsx`, the play reporter host, locale strings (en, ru, es) in `locales/authors.ts`, rows `author-pages` and `author-forms` in `lib/playerPolicy.ts` and `docs/player-visibility.md`, deep link mapping in `lib/deepLinks.ts`, and the reset of author data on account deletion.

For the owners of those screens to add (one line each, components exist):
- Upload hub: `<AuthorHubRow theme={theme} />`.
- Recording page: `<AuthorLine theme={theme} recordingId={kirtan.serverId} />` under the title, and `<MoreFromAuthor theme slug name excludeId />` below.
- Unified search: `<AuthorsSearchBlock theme={theme} query={query} />`.

## Decisions for Dada

1. Which uploads appear by default: all published uploads (`DEFAULT_INCLUDE_UPLOADS = "all"`), or only ones the member picks.
2. Listener key rotation: `LISTENER_SALT_ROTATION_DAYS = 0` (the key is stable). A daily key would be more private but would make monthly listeners impossible to count. Recommended: keep stable.
3. Minimum before public numbers: 5 plays. Country threshold: 5 listeners per country and 20 in all.
4. Address change: once in 30 days; old address held 90 days.
5. Reports: 3 reports raise review; impersonation and copyright raise it at once.
6. Photo kept in the database (300 KB). Alternative is object storage.
7. Claimed artist names need team verification before any "Verified" mark.
8. Keep evidence of a suspended page after deletion, and for how long (currently without a time limit).
9. Device region is not sent by default; countries appear only for members who allow it.
10. Plays are counted without a separate consent screen, since only a short keyed hash is stored. Confirm that this is acceptable for the stores' privacy forms.
11. Web plays are not counted yet.
12. Add `/author/*` to universal links (needs a native build).
13. Language rule for uploads (Dada's rule): language is REQUIRED for Bhajan and Spiritual song; Kiirtan has none; Prabhat Samgiita optional; Dance song: dance is required and language optional. Older rows without a language keep working, and My uploads gives a gentle "Add language" prompt for old bhajans. This is enforced by the upload code (`add-kirtan`, `lib/kirtan`, the recordings API), which another change owns, not by the author pages. Author pages only show a language when a recording has one; the owner recordings endpoint already returns `language`.
14. Caps for made-up device ids: 10 new listeners per recording and 30 per day per client. Lower is safer against a script but undercounts a sangha hall where many phones share one wifi. The play caps (200 per recording per day, 1000 per day, per client) are a judgment call in the same way: a hall of 300 phones playing one song on one wifi would have its 100 last plays held out of the public number.
15. The list of staff words and the owners' names that hold a page for the team (see Moderation). A verified page is exempt; a team member's own page must be verified by the team.

## Not verified

- The web pages were written without installing the web dependencies on this machine, so `next build`, the web type check and `next lint` have not run. The helper library has 16 passing tests (`apps/web/tests/authors.test.ts`, run with the mobile vitest binary). Open `/author/<slug>` against a running API before release.
- Nothing was run against PostgreSQL. API tests use SQLite; the migration has a test (`test_author_profiles_migration.py`) but a real upgrade on a copy of production is needed.
- `AUTHOR_STATS_PEPPER` (or the recording signing secret) must be set in production; without both, a development value is used.
- Real devices: the play reporter was exercised in the web preview and unit tests only. Background playback, offline batching and app restarts on iOS and Android are not tested.
- Search engines: robots, sitemap and JSON-LD follow the spec above, but indexing was not tested with Google's rich results test or Search Console.
- The preview in the browser sometimes shows a red overlay from the audio player library (circular initialisation, `CAPABILITY_PLAY`). It also happens without the author screens; it is not caused by this feature.
- The i18n coverage script reports 5 false positives in `authors` files (dynamic key families); the locale test (`authorLocales.test.ts`) checks them properly.
- The full mobile suite has one failing test outside this feature (`kirtanSets.test.ts`, daily limit).
