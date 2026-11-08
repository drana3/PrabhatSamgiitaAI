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

## Tests

API: `apps/api/tests/test_video_checks.py`. Mobile: `apps/mobile/__tests__/kiirtanVideo.test.ts`.
