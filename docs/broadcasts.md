# Broadcasts: a link to something that is on the air

A broadcast is a link to a live or announced event that happens somewhere else: a Zoom meeting, a YouTube Live
stream, a Facebook or Instagram Live, any other site. A member shares the link, the app lists it while it is on and
for a week after it ends, and people join with one tap. A broadcast may last days (a retreat, a week of Kiirtan), not
only hours. The app hosts nothing and plays nothing of its own: it is a notice board with a safe way to open the link.
When a broadcast has ended, its author (or the team) can attach the recording, and the recording stays in the library.

Broadcasts are started by ANY people: a centre, a teacher, a member. Nobody needs to register with us or to do
anything for the status check described below.

Code: API `apps/api/app/api/v1/broadcasts.py`, `app/services/broadcasts.py`, `broadcast_review.py`,
`broadcast_recordings.py`, `youtube_status.py`, `app/models/broadcasts.py`, migrations `0061_broadcasts` and
`0062_broadcast_duration_review_recordings`. Phone `apps/mobile/lib/broadcasts/*`, `lib/broadcastReview/*`, screens
`app/upload-broadcast.tsx`, `app/broadcast/[id].tsx`, `app/broadcasts.tsx`, `app/broadcast-recording.tsx`,
`app/team-broadcasts.tsx`, shelf `components/broadcasts/BroadcastsShelf.tsx`. Words `locales/broadcasts.ts` (en, ru, es;
ru and es are marked "not read by a native speaker" in `locales/review.json`).

## Резюме по-русски

Трансляция это ссылка на то, что идёт или скоро пойдёт в эфире на стороне (Zoom, YouTube Live, Facebook, Instagram,
любой другой сайт). Трансляции запускают ЛЮБЫЕ люди: центр, учитель, участник. Участник вносит ссылку, латинское
название, при желании начало и конец (дата, время, часовой пояс телефона; конец не позже 14 дней от начала), описание
и организатора. Трансляция появляется сразу и висит на полке «В эфире и скоро» экрана Киртан, пока идёт.

Длительность: трансляция может идти днями (7–10 дней). Если конец не указан, она «идёт», пока организатор не нажмёт
«Закончено», но не дольше 14 дней от начала: потом закончится сама. Отметка «В эфире» показывает весь срок («В эфире ·
день 3 из 9»). Через 7 дней после ФАКТИЧЕСКОГО конца трансляция уходит с полок и остаётся только у автора.

«Идёт сейчас». Для YouTube сервер спрашивает у YouTube Data API (нашим ключом из переменной `YOUTUBE_API_KEY`), идёт ли
видео в эфире. Это работает для открытых и «по ссылке» видео и ничего не требует от организатора. Для закрытых
(private) видео статус определить нельзя, тогда «по часам организатора». Для Zoom и остальных проверить нельзя,
всегда «по часам организатора». Без ключа всё работает по часам, как раньше.

Команда видит на телефоне экран «Модерация трансляций» (очередь жалоб, включая анонимные, которые не считались, и
скрытые автоматически; «Оставить» / «Скрыть» / «Удалить» с причиной; история решений). Автор получает уведомление.
После «Оставить» стоит отметка «проверено»: те же люди не могут пожаловаться снова с той же причиной, а новые жалобы
других считаются заново.

Запись. Когда трансляция закончилась, автор и команда нажимают «Добавить запись», остальные участники «Предложить
запись» (решает команда). Запись это либо ссылка (YouTube, облачная запись Zoom, Vimeo, archive.org, только https), либо
файл, загруженный через обычный мастер. Мы НИЧЕГО не скачиваем с YouTube или Zoom сами. Запись остаётся навсегда у автора
и в библиотеке, даже когда трансляция ушла в архив. На странице записи видно «Из прямого эфира: название, дата».

## What a person sees

* Upload hub: a tile "A live broadcast" and a quiet row "My broadcasts".
* The form: link, Latin title, optional start (date `YYYY-MM-DD`, time `HH:MM`, "Today" and "Tomorrow" chips; the
  phone's own time zone is sent by name), optional "Ends" (a date and a time, chips "Today", "Tomorrow", "In a week"; up
  to 14 days after the start), description, organizer. A note says it goes live at once and anyone can report
  it. The form is not the recording form, so it does not show the recording moderation notice (that text promises a
  moderator will listen to a recording).
* The Kiirtan screen: a shelf "Live and upcoming" near the top. It is drawn only when at least one broadcast is on the
  air or announced; an empty shelf takes no room. "See all" opens the list (tabs Live and upcoming, Recent, Mine).
* The broadcast page: the phase mark (word and dot: Live, Upcoming, Ended), title, time, organizer, description, then
  how to join. YouTube: "Watch here" opens the site's own embed on the page (starting it pauses the player's audio,
  starting the audio closes it, it closes when the page loses focus: the same hook as video links). Anything else: only
  "Open", which leaves the app. The author can mark it over or delete it; everybody else can report it.
* A broadcast that lasts days shows its span ("12 Nov to 20 Nov") and the Live mark says which day it is ("Live · Day 3 of 9").
  With no declared end the mark shows only the day, from the second day on.
* Once it has ended, a "Recording" block lists the recordings and the button "Add the recording" (author and team) or
  "Suggest a recording" (anybody else).
* The team sees a row in the upload hub that opens the moderation desk (`/team-broadcasts`).

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

The phase is worked out when read, never stored. Constants: `MAX_SPAN` 14 days, `ARCHIVE_AFTER` 7 days.

* upcoming: the start is in the future.
* now: the start has come and it has not ended. Without a start it is "now" from the moment it was posted.
* ended: whichever comes first of
  1. the declared end ("Ends" in the form, at most 14 days after the start);
  2. "It is over", pressed by the author or the team;
  3. YouTube says the video is no longer live (only when the status check below is on and the video is a YouTube one);
  4. 14 days after the start (or after it was posted, with no start): the automatic end for a broadcast without an end.

A broadcast of 9 days therefore stays Live for 9 days; one with no end stays on until somebody presses "It is over" or
day 14 arrives.

A start may be at most six hours in the past (somebody posts a little late) and at most a year ahead. A start or an end
without an offset needs the zone's IANA name (`Europe/Berlin`); the server turns it into UTC. The end must be after the
start, not in the past, and not more than 14 days after the start.

Archive: seven days after the ACTUAL end (not after the declared one if somebody ended it early, and not after day 14
if it ended sooner) the broadcast leaves every public list and its page closes for everybody but its author and the team;
"My broadcasts" keeps it. Its recordings stay (see "Recordings").

### "Is it live now": the YouTube Data API

For a broadcast whose link is a YouTube video the server can ask YouTube whether the video is live, upcoming or neither
(`videos.list`, part `liveStreamingDetails` and `snippet`). It uses OUR key on the video's public address, so it works for
public and unlisted videos by link and needs nothing from the organizer: they do not sign in, share a key, or add us
anywhere. For a PRIVATE video YouTube returns nothing, the status cannot be determined and the broadcast is "on" by the
organizer's clock. Zoom, Facebook, Instagram and every other site cannot be checked and always use the organizer's clock.

* The key comes only from the environment variable `YOUTUBE_API_KEY` (`apps/api/app/config.py`, `.env.example` has the
  name without a value). Without it, or with `YOUTUBE_STATUS_ENABLED=false`, nothing runs and the old clock behaviour holds.
* An answer is kept on the broadcast row and reused for `YOUTUBE_STATUS_TTL_SECONDS` (60) for every viewer; a list asks for
  up to 50 videos in ONE call; a ceiling of `YOUTUBE_DAILY_REQUEST_LIMIT` (3000) calls per UTC day in one server process
  protects the quota; after a refusal or a network failure the API is left alone for a while. A failure never breaks a page:
  the clock rules.
* The key travels in the `X-Goog-Api-Key` header, never in an address. Nothing logs the link, the video id or the key
  (only the error class and the HTTP status). The client gets only the result: `live_source` is `youtube` or `clock`.

What Dada must do (nothing is registered or stored by the code):

1. In Google Cloud Console create (or pick) a project, enable "YouTube Data API v3", and create an API key.
2. Restrict the key: "API restrictions" to YouTube Data API v3 only. (An application restriction by IP is possible when
   the API has a fixed outgoing address; Azure Container Apps does not give one by default, so API restriction alone is
   the realistic setting.)
3. Put the key into the API's environment as `YOUTUBE_API_KEY` (a secret in Azure Container Apps), then redeploy.
   Never commit it.
4. The free quota is 10,000 units a day and `videos.list` costs 1 unit per call, whatever the number of ids, so the default
   ceiling of 3000 calls a day is far inside it. Watch "Quotas" in the same console after the first week.

## Limits

* Posting needs a signed-in member. Three broadcasts a day and five an hour per member (the team: sixty an hour), at most
  five live at once. The daily allowance is not given back when a broadcast is deleted.
* The same link cannot be on the list twice while it is not ended. Errors carry `X-Error-Code`: `broadcast_bad_link`,
  `broadcast_daily_limit`, `broadcast_live_limit`, `broadcast_duplicate`, and for recordings `broadcast_not_ended`,
  `broadcast_recording_link`, `broadcast_recording_duplicate`, `broadcast_recording_full`; a verdict without a reason
  gives `broadcast_reason_needed`.

## Reports and the team

Anyone may report a broadcast, signed in or not (broken link, not a broadcast, offensive, spam, other). One report per
person and reason; an anonymous reporter is told apart by network (the address, for IPv6 the /64), not by full address.

Hiding from the public lists needs reports that count, so a few addresses or new accounts cannot take down somebody
else's broadcast:

* a member whose account is at least three days old counts one; two of them hide the broadcast;
* a report from the team hides it at once;
* an anonymous report and a report from a fresher account are stored and reach the team's queue but weigh nothing.

A hidden broadcast stays readable to its author and the team.

### The team's desk (phone: `/team-broadcasts`, team only)

The screen is patterned on `/team-review` and `/team-claims`. Every call is checked again on the server (a member who is
not on the team gets 403 from every route below). Tabs:

* Queue: broadcasts with reports not yet judged (`GET /broadcasts/review?which=queue`), the ones the reports hid first.
  Each card shows the reasons, how many people reported, how many of them anonymous and therefore not counted, and the
  notes. The link is shown as text with an "Open" button that leaves the app; it is never embedded or fetched, so the
  team judges it before anybody plays it.
* Recordings: recordings that members suggested for ended broadcasts, "Accept" or "Reject"
  (`/broadcasts/recording-suggestions`).
* Hidden and Removed: what the team took off, to look again (`which=hidden|removed`).
* History: every verdict, with who, when, the reason and the numbers at that moment (`GET /broadcasts/decisions`).

Actions: Keep (`POST /broadcasts/{id}/keep`), Hide and Remove (`POST /broadcasts/{id}/hide|remove`, a reason of 3 to
500 characters is required: the author reads it). Every verdict clears the reports that were open (they stay in the
table, stop counting, and still stop the same person sending the same reason again) and is written to the history.

Keep and repeat reports: a Keep marks the broadcast as reviewed (who, when, how many people had reported). The same
participants cannot report it again for the same reason. Reports from OTHER people sent after the Keep count on their
own, from zero, beyond the reviewed ones, so a broadcast the team kept is not hidden by the same old reports, and is
still hidden by a real new wave.

The author is told through the notification centre (server notices `broadcast_hidden`, `broadcast_removed`,
`broadcast_restored`, shown as important items with the reason). The author deleting a broadcast wipes its link and
title.

## Recordings

A broadcast that has ended can have recordings (at most five accepted, at most five waiting).

* "Add the recording" for the author and the team: accepted at once. "Suggest a recording" for any other member: waits for
  the team's desk (at most two waiting per member).
* Path (a), a link: YouTube, a Zoom cloud recording (`/rec/` addresses only, not a meeting link), Vimeo or archive.org,
  https only, domains compared whole (`zoom.us.evil.com` is refused). The parser is `parseRecordingLink` on the phone and
  the same rules on the server. A YouTube recording plays through the site's own embed; every other link is "Open", which
  leaves the app. Zoom is never embedded.
* Path (b), a file: "Upload a recording file" opens the normal upload wizard (`/add-kirtan?broadcast=<id>`) with a banner
  "For the broadcast: <title>". The publish call carries `broadcast_id`, so the recording is linked to the broadcast. The recording itself is live
  at once like every upload (see `docs/kiirtan-publishing.md`); on the broadcast the link is accepted at once for the
  author and the team, and for anybody else it waits on the team's desk like a suggested link.
* The broadcast page shows a "Recording" block; the recording's own page shows "From a live broadcast: <title>, <date>"
  (`from_broadcast` on `GET /recordings/{id}`).
* Nothing is downloaded by the server from YouTube or Zoom, ever. We store only the link or the file a person supplied.
* A recording stays with its author and in the library for good, also after the broadcast is archived or hidden: the
  archive affects the broadcast, not its recordings.

## What is not verified

The migrations were run only on SQLite in tests, not on PostgreSQL. Nothing was tried on a real phone. The server needs
the `tzdata` package (or the system zone database) for starts and ends given with a zone name. The YouTube status check is
tested only against a mock: no real key was used, so the real answers of the API (and the daily ceiling, which is per
server process) are unseen until a key is set. The recordings of a Zoom cloud meeting may need a passcode that the viewer
types on Zoom's side; the app cannot know.
