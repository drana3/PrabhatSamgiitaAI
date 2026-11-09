# Broadcasts: a link to something that is on the air

A broadcast is a link to a live or announced event that happens somewhere else: a Zoom meeting, a YouTube Live
stream, a Facebook or Instagram Live, any other site. A member shares the link, the app lists it while it is on and
for a week after, and people join with one tap. The app hosts nothing and plays nothing of its own: it is a notice
board with a safe way to open the link.

Code: API `apps/api/app/api/v1/broadcasts.py`, `app/services/broadcasts.py`, `app/models/broadcasts.py`, migration
`0061_broadcasts`. Phone `apps/mobile/lib/broadcasts/*`, screens `app/upload-broadcast.tsx`, `app/broadcast/[id].tsx`,
`app/broadcasts.tsx`, shelf `components/broadcasts/BroadcastsShelf.tsx`. Words `locales/broadcasts.ts` (en, ru, es;
ru and es are marked "not read by a native speaker" in `locales/review.json`).

## Резюме по-русски

Трансляция это ссылка на то, что идёт или скоро пойдёт в эфире на стороне (Zoom, YouTube Live, Facebook, Instagram,
любой другой сайт). Участник вносит ссылку, латинское название, при желании начало (дата, время, часовой пояс
телефона), описание и организатора. Трансляция появляется сразу, висит на полке «В эфире и скоро» экрана Киртан,
пока идёт, и ещё неделю в «Недавних»; потом уходит с полок и остаётся только у автора («Мои трансляции»).
YouTube играет внутри приложения через свой embed, как видеоссылки. Zoom и всё остальное никогда не открывается
внутри приложения: только кнопка «Открыть», которая выводит наружу. Ссылка никогда не скачивается. Пожаловаться
может кто угодно; на скрытие считаются жалобы двух устоявшихся участников (аккаунт старше трёх дней) или одна от
команды; анонимные жалобы идут команде в очередь, но не скрывают. «Идёт сейчас» значит «по часам организатора»:
проверить, что комната Zoom реально открыта, нельзя.

## What a person sees

* Upload hub: a tile "A live broadcast" and a quiet row "My broadcasts".
* The form: link, Latin title, optional start (date `YYYY-MM-DD`, time `HH:MM`, "Today" and "Tomorrow" chips; the
  phone's own time zone is sent by name), description, organizer. A note says it goes live at once and anyone can report
  it. The form is not the recording form, so it does not show the recording moderation notice (that text promises a
  moderator will listen to a recording).
* The Kiirtan screen: a shelf "Live and upcoming" near the top. It is drawn only when at least one broadcast is on the
  air or announced; an empty shelf takes no room. "See all" opens the list (tabs Live and upcoming, Recent, Mine).
* The broadcast page: the phase mark (word and dot: Live, Upcoming, Ended), title, time, organizer, description, then
  how to join. YouTube: "Watch here" opens the site's own embed on the page (starting it pauses the player's audio,
  starting the audio closes it, it closes when the page loses focus: the same hook as video links). Anything else: only
  "Open", which leaves the app. The author can mark it over or delete it; everybody else can report it.

## Link rules

The pasted text is read as a URL, never matched as text, and never fetched. The server (`parse_broadcast_url`, `urlsplit`)
and the phone (`parseBroadcastLink`, `new URL()`) apply the same rules and the server decides.

* https only (a link typed without a scheme is read as https). No user name or password, no port other than 443.
* An ASCII public domain name. Never an IP number (also `0x7f.1`, `2130706433`), never a one-label name, never a
  name that ends like a private network (`.local`, `.lan`, `.internal`, `.home`, `.corp`, `.intranet`, `.test`,
  `.localhost`, `.invalid`, `.arpa`).
* The provider comes from the host, compared whole: Zoom is `zoom.us`, `zoom.com`, `zoomgov.com` and their real
  subdomains (so `zoom.us.evil.com` and `evilzoom.us` are "another site"); Facebook and Instagram by exact host.
* YouTube must be one video (a live stream has its own watch address), not a channel; the stored address is rebuilt from
  the video id. Any other link is kept as given without its fragment (a Zoom link needs its `pwd`).
* A bare site name without a path is refused. Links in the title, description and organizer are refused (the link has its
  own field). The title is Latin letters only, 3 to 120 characters.

Before a link leaves the app, the page parses the stored address again (`addressToOpen`) and opens it only if it comes
back unchanged. Zoom and every other site are never loaded in a web view or a frame; the only embedded thing is the
YouTube embed, through `lib/recordingVideos/embed.ts`. A thumbnail is shown only from `i.ytimg.com` over https.

The only request the server makes is the YouTube oEmbed look of `video_checks`, to a fixed host with an address built
from the checked video id. It fills the link status (`ok`, `no_embed`, `unavailable`) and a thumbnail, after the answer
is sent, and never decides anything alone.

## State and time

The phase is worked out when read, never stored.

* upcoming: the start is in the future.
* now: the start has come and it has not ended. Without a start it is "now" from the moment it was posted.
* ended: the author or the team said so, or six hours (`ASSUMED_DURATION`) passed since the start.

A start may be at most six hours in the past (somebody posts a little late) and at most a year ahead. A start without an
offset needs the zone's IANA name (`Europe/Berlin`); the server turns it into UTC. Seven days after the end
(`ARCHIVE_AFTER`) the broadcast leaves every public list and its page closes for everybody but its author and the team;
"My broadcasts" keeps it.

"Live" means "by the organizer's clock". Nobody checks that a Zoom room is open, and YouTube's oEmbed does not say whether
a video is live, so the app cannot know. Reading it from YouTube would need the YouTube Data API and a key; it is not built.

## Limits

* Posting needs a signed-in member. Three broadcasts a day and five an hour per member (the team: sixty an hour), at most
  five live at once. The daily allowance is not given back when a broadcast is deleted.
* The same link cannot be on the list twice while it is not ended. Errors carry `X-Error-Code`: `broadcast_bad_link`,
  `broadcast_daily_limit`, `broadcast_live_limit`, `broadcast_duplicate`.

## Reports and the team

Anyone may report a broadcast, signed in or not (broken link, not a broadcast, offensive, spam, other). One report per
person; an anonymous reporter is told apart by network (the address, for IPv6 the /64), not by full address.

Hiding from the public lists needs reports that count, so a few addresses or new accounts cannot take down somebody
else's broadcast:

* a member whose account is at least three days old counts one; two of them hide the broadcast;
* a report from the team hides it at once;
* an anonymous report and a report from a fresher account are stored and reach the team's queue but weigh nothing.

A hidden broadcast stays readable to its author and the team. The team's queue (`GET /broadcasts/review`) holds every
broadcast with at least one report, the most counted first. "Keep" clears its reports (`POST /broadcasts/{id}/keep`),
"Remove" takes it down with a reason (`POST /broadcasts/{id}/remove`). The author deleting a broadcast wipes its link and
title. There is no team screen for this on the phone yet: the team uses the API.

## What is not verified

The migration was run only on SQLite in tests, not on PostgreSQL. Nothing was tried on a real phone. The server needs
the `tzdata` package (or the system zone database) for starts given with a zone name.
