# Video links on Kiirtan recordings and PS songs

Links only. The app never stores or uploads a video; it keeps a link and shows it.

## What a link may be

YouTube, Vimeo and the Internet Archive. The pasted text is checked for the host, normalized to
the canonical address (`apps/api/app/services/video_links.py`, `parse_video_url`), and a link that
is already on that recording or song is refused as a duplicate. Added from the Kiirtan upload form
(only for a single-file upload, sent after the upload is done), from the recording page and from
the PS song page (same `VideosSection` / `AddVideoSheet`).

## Showing it

- Where the site allows it, the video plays **inside the app**, through the site's own embed
  (YouTube IFrame, Vimeo player, archive.org embed). Button: "Watch here".
- If the owner does not allow embedding (`no_embed`) only "Open on site" is offered.
- If the link looks gone (`unavailable`) a soft note is shown and "Open on site" stays.

The recording page puts the featured video in a block of its own with the list of the others below.

## Aliveness check

`video_links.link_status`: `unknown`, `ok`, `no_embed`, `unavailable` (plus `checked_at`,
`check_fails`). Code: `apps/api/app/services/video_checks.py`. Only three hosts are called
(`youtube.com/oembed`, `vimeo.com/api/oembed.json`, `archive.org/metadata/<id>`), with an address
built from the video's id, never from the member's text. A link becomes `unavailable` only after
it was gone twice in a row; a timeout, a 5xx or rate limit changes nothing. Nothing is hidden or
blocked because of the status.

It runs: in the background after a link is added; in the background when a page is read and the
last look is old; after a "broken" report; and from the team endpoint
`POST /api/v1/video-links/review/recheck`. There is no scheduler.

## Reporting

Any member can report a link (`POST /api/v1/video-links/{id}/report`, reasons include "broken").
The team sees links in `GET /video-links/review`, and can keep, restore or delete.

## Audio policy (what happens to the recording audio)

- Starting a video **pauses** the recording audio. The queue and the radio are not touched, and
  nothing resumes by itself afterwards.
- If audio starts while a video is open, the video closes.
- A video never plays in the background: it closes when the page loses focus or the app leaves the
  foreground.

Code: `components/recording-extras/{VideoBlock,WatchPlayer,VideoEmbed,useVideoWatch}.tsx|ts`,
`lib/recordingVideos/embed.ts`.

## Previews (the picture of a video)

Every place that shows a video draws one 16:9 box with `components/video/VideoThumb.tsx`: the Kiirtan Video tab (the headline block
and each row), the "Add a video" sheet and the upload form (`VideoLinkPreview`, under the field), the broadcast tiles and the video
cards of the Prabhat Samgiita song page. The box never changes size, so nothing jumps.

Where a picture comes from, per site (`lib/recordingVideos/thumbnail.ts`, and the same rules on the server in `video_checks.py`):

- YouTube: `https://i.ytimg.com/vi/<id>/mqdefault.jpg`, built from the id (16:9, exists for every public video). `maxresdefault` is never used:
  it is missing for many videos and the site then answers with a grey 120x90 stand-in that still "loads".
- Internet Archive: `https://archive.org/services/img/<id>`, built from the id.
- Vimeo: no address by id. The server asks Vimeo's oEmbed once per link (the same check that finds out whether it may be shown inside the
  app), keeps the `thumbnail_url` on the link (`video_links.thumbnail_url`) and a link that has none is looked at again after 6 hours.
- Broadcasts: the picture the first look found, else the YouTube picture by id.

A picture address is never typed text: the server builds it from the checked id or takes it from the site's own answer, with the image host
compared whole (`i.ytimg.com`, `i.vimeocdn.com`, `archive.org`; https, no user name, no port). The phone checks every address again
(`safeThumbnailUrl`). The server never downloads a picture or a video; only the phone's image loader fetches the picture.

`GET /api/v1/video-links/preview?url=` is for the forms: the typed link is parsed (https, the three sites, one video), then the one request
goes to the site's own answer for that id (timeout, size cap), remembered for 10 minutes (45 seconds when the site did not answer).
Signed-in members only, 40 a 10 minutes; a refused link costs nothing.

What the loader does (`VideoThumb`, state machine `thumbNext`):

- a placeholder is always under the picture: the site's name and the title on a dark ground (a calm opacity pulse while loading, none with
  reduced motion). The picture fades in over it (opacity only);
- sources are tried in order (the server's kept picture, then the one built from the id). A source that fails or is the 120x90 stand-in moves on;
- when all fail it waits 1.5 s, 4 s and 9 s and tries again, tries once more when the app comes back to the front, and then stops and shows
  "Try again" (a tap starts over). A source that failed is not asked again for a minute (so a long list does not hammer a dead address);
- expo-image keeps the files in its disk cache, so a picture seen once shows offline.

Why previews used to vanish: a picture that failed once stayed blank for good (no failure handling, no retry); the Prabhat Samgiita cards showed a
stock image instead of the video's own; Vimeo and Archive links never had a picture; the broadcast tile took its picture from one look at the
moment of creation (a timeout left it empty forever) and accepted only YouTube's host; nothing showed under a link typed in a form.

## Tests

API: `apps/api/tests/test_video_checks.py`, `apps/api/tests/test_video_previews.py`. Mobile: `apps/mobile/__tests__/kiirtanVideo.test.ts`, `apps/mobile/__tests__/videoThumbnails.test.ts`.
