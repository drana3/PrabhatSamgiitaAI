# Notifications

Phase 1 runs on the phone only. Phase 2 adds a server. The bell, the inbox and the settings screen are the same in both.

## Kinds

| Kind | Trigger | Where it comes from | Tap opens |
| --- | --- | --- | --- |
| `song` | Song of the day: 8:00 local by default; the person sets up to 3 times a day, any minute | scheduler; "composed on this day" when the song list has the date, else a daily pick | `/song-v2/ps-N` |
| `festival` | 17:00 on the eve of a festival | scheduler, from `data/festivals.ts` | `/festival/<id>` |
| `words` | 18:00 local by default; the person sets up to 5 times a day, any minute; only when words are due | scheduler, from the word cards in `stores/learnStore.ts` | `/learn/words` |
| `streak` | 20:00, only when a streak of 2+ days could end today (off by default) | scheduler, from card review history (`lib/learn/streak.ts`) | `/v2/learn` |
| `live` | not scheduled on the phone any more, and not a setting. The kind stays so that a server push (phase 2) or an old inbox item can still show | server only (TODO(api)) | `/kiirtan-live?id=<id>` |
| `story` | a new story | fixture in the preview only (TODO(api)) | `/story-sheet/<slug>` |
| `upload` | an uploaded Kiirtan or Bhajan was removed by the team (a published one needs no notice: the author sees it live) | copy and shape in `lib/notifications/serverKinds.ts`; no trigger yet (TODO(api)) | `/v2/kiirtan` |
| `announcement` | a message from the team | same file; no trigger yet (TODO(api)) | `/v2/today` or the given route |

Copy is short, sentence case, no exclamation marks, verb first where there is an action ("Starts in 15 minutes.", "3 words are due. It takes a minute.").

## Phase 1: how it works

- `lib/notifications/schedule.ts` is pure. `plan(input, from, to)` returns notifications with a deterministic id (`song:2026-11-05@0745`, `words:2026-11-05@1800`, `festival:<id>`, `streak:<date>`). A time the person chose is in the id (`@HHMM`), so every time of every day is its own notification and scheduling again replaces instead of duplicating. Moving a time changes its id: the old notification is cancelled, the new one scheduled.
- Rules: a kind or the master switch that is off makes nothing; every time the person chose is its own notification at exactly that minute; words only when some are due at that time. There are no quiet hours and no daily limit (see "What changed" below).
- iOS keeps 64 pending local notifications at most. `capForPlatform` keeps the soonest 60 of the plan; the rest is planned again whenever the app runs. The fullest week the settings allow (3 song + 5 word times a day) is 56, so this only bites when festivals and streak come on top.
- `scheduleNext7Days` gives what the phone should hold. `firedSince` gives what has already fired; the inbox fills from it. Both come from the same `plan`.
- `lib/notifications/native.ts` is the only file that touches `expo-notifications`: Android channel `reminders`, schedule and cancel by id (`diffSchedule`), badge, tap handling. On the web preview every call is a no-op.
- `components/notifications/NotificationsHost.tsx` (mounted once in `app/_layout.tsx`) reschedules on start, when the app comes to the front, and when a setting, the word cards or the song list change. It never asks for permission.
- Permission is asked only when the person turns a reminder on in the settings screen, or taps "Allow notifications" there. If the OS says no, the settings screen shows "Notifications are off in system settings" with an "Open settings" button.
- The inbox (`stores/notificationsStore.ts`) keeps fired items with their time, which are read, and which were deleted (so a deleted item does not come back). Items older than 30 days are dropped. "Today" and "Earlier" sections, "Mark all read", an X on each row, empty state "You're all caught up.".
- Settings (`stores/notificationSettingsStore.ts`, shape and migration in `lib/notifications/settings.ts`, version 2): master on; song 8:00 on; festivals on; words 18:00 on; streak off. `song` and `words` each hold `times`, minutes after local midnight, sorted, without duplicates, 1 to 3 (song) or 1 to 5 (words) entries.
- Times are free. Tapping a time (or "Add time") opens a bottom sheet (`components/notifications/TimePickerSheet.tsx`) with an hour wheel and a minute wheel (every minute), AM and PM on a 12-hour clock (the device locale decides between 12 and 24 hours), a live line ("Every day at 7:45 AM"), Cancel and Done. Nothing is saved until Done. An existing time can be removed from the sheet (the last one stays); a time already in the list cannot be chosen twice. At the limit "Add time" is disabled and the row says "Up to 3 times a day.".

## What changed in version 2 (and why)

- Times are free, several a day. Before: one time per kind, from a fixed list (song 6:00 to 10:00 in 30 minutes, words 7:00 to 20:00 hourly). Now any minute, up to 3 song times and 5 word times. A saved version 1 `at` becomes `times: [at]`; the value is kept exactly, even one that was off the old list.
- Live Kiirtan reminders are gone: the `live` setting, local scheduling of `live:<id>`, and the "Remind me" bells on the live Kiirtan cards and screen (a bell that schedules nothing would be a lie). `stores/kirtanLiveStore.ts` was removed with them; its saved key `prabhat-kirtan-live` is simply never read. The `live` inbox kind stays for server pushes.
- Quiet hours are gone: the setting, `setQuietHours`, `QUIET_*`, the shifting in the scheduler. Reason: the person picks exact times, so a second window that moves those times is redundant, and it would silently change a time the person typed.
- The daily limit of 2 is gone too. It protected the old crowded days (live + festival + words + song) and quiet-hours shifts, and it cannot coexist with "each time is its own notification": 3 song times would always lose to the cap. The person's own times are now the limit (at most 8 a day from song and words, plus the festival eve and the streak reminder). The footer text "We send at most 2 a day" is removed. If an overall cap is wanted again, it belongs in `plan()` and must say so on the page.
- Migration: `migrateSettings` reads version 0, 1 and 2 the same way and drops `live` and `quiet`. An empty or damaged `times` falls back to the default time (8:00 / 18:00); a list is sorted, de-duplicated and cut to its limit (earliest times kept).


Not yet tried on a real phone: native scheduling of several times a day, iOS delivery with 60 pending, and Android exact alarms (from Android 12 an app needs the exact-alarm permission to fire on the minute; without it the system may delay a reminder by minutes).

Limits of phase 1: a notification is only scheduled while the app has run within the last 7 days (iOS and Android hold local notifications, the app has to refill them). The inbox shows what should have fired from the app's current data, so a words reminder that fired before the person reviewed is not reconstructed with its old count. There is no cross-device state. The "composed on this day" text needs a song date that the app does not have yet.

## Phase 2: server

Local stays for everything the phone can know alone (song of the day, words, streak, festivals). The server adds what the phone cannot know: team announcements, upload decisions, new stories, and live Kiirtan broadcasts (the person cannot set live reminders on the phone any more).

Tables:

```
notifications(id, kind, audience, payload, target, created_at, expires_at)
notification_reads(user_id, notification_id)
device_tokens(user_id, token, platform, locale, tz)
```

- `audience`: `all`, a group, or one user id. `payload` is the title and text per locale. `target` is an app route, the same routes the local kinds use.
- Scheduler job: every minute, pick notifications that are due, resolve the audience to device tokens, send through Expo push (APNs and FCM), write nothing twice (idempotent by notification id and token).
- Admin broadcast: an admin screen creates an `announcement` with audience, text, target and expiry; it goes through the same job.
- Uploader-status triggers: when the team removes a Kiirtan or Bhajan, create a `notifications` row with `kind = upload` for the uploader, with the copy and the reason from `serverKinds.ts` (the API also stores a member notice, `GET /recordings/notices`).
- The app lists unread items from `GET /notifications` (not expired, minus `notification_reads`) and merges them into the inbox by id, next to the local ones. Read state syncs through `notification_reads`.
- `device_tokens` is written only after the person has allowed notifications. Sign-out deletes the row.

## Privacy and rate limits

- Phase 1 sends nothing off the phone. Settings, the inbox and word cards stay on the device.
- Phase 2 stores a device token, platform, locale and time zone per user, and nothing about what the person learns or plays. Targeting is by audience only, never by listening history.
- No sensitive text in a notification body: nothing about health, location, or private notes.
- Limits: the phone sends only at the times the person picked (no quiet hours, no daily cap). Server pushes are rare by design (announcements, upload decisions, live broadcasts); if volume grows, add a per-person daily cap on the server and show it on the settings page.
- Permission is asked in context, never at first launch. Turning the master switch off cancels all scheduled notifications and, in phase 2, stops pushes for that device.
