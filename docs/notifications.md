# Notifications

Phase 1 runs on the phone only. Phase 2 adds a server. The bell, the inbox and the settings screen are the same in both.

## Kinds

| Kind | Trigger | Where it comes from | Tap opens |
| --- | --- | --- | --- |
| `song` | Song of the day, 8:00 local (6:00 to 10:00 by choice) | scheduler; "composed on this day" when the song list has the date, else a daily pick | `/song-v2/ps-N` |
| `festival` | 17:00 on the eve of a festival | scheduler, from `data/festivals.ts` | `/festival/<id>` |
| `words` | 18:00 local (7:00 to 20:00 by choice), only when words are due | scheduler, from the word cards in `stores/learnStore.ts` | `/learn/words` |
| `streak` | 20:00, only when a streak of 2+ days could end today (off by default) | scheduler, from card review history (`lib/learn/streak.ts`) | `/v2/learn` |
| `live` | 15 minutes before a broadcast the person set a reminder for | scheduler, from `stores/kirtanLiveStore.ts` and the live list | `/kiirtan-live?id=<id>` |
| `story` | a new story | fixture in the preview only (TODO(api)) | `/story-sheet/<slug>` |
| `upload` | an uploaded Kiirtan was approved or rejected | copy and shape in `lib/notifications/serverKinds.ts`; no trigger yet (TODO(api)) | `/v2/kiirtan` |
| `announcement` | a message from the team | same file; no trigger yet (TODO(api)) | `/v2/today` or the given route |

Copy is short, sentence case, no exclamation marks, verb first where there is an action ("Starts in 15 minutes.", "3 words are due. It takes a minute.").

## Phase 1: how it works

- `lib/notifications/schedule.ts` is pure. `plan(input, from, to)` returns notifications with a deterministic id (`song:2026-11-05`, `festival:<id>`, `words:<date>`, `streak:<date>`, `live:<id>`). The id never holds the time, so scheduling again replaces instead of duplicating.
- Rules, in order: a kind or the master switch that is off makes nothing; times inside quiet hours (default 21:00 to 7:00) move to the end of quiet hours; at most 2 a day with priority live > festival > words > song > streak; words only when some are due at that time.
- Exception: a live reminder ignores quiet hours. The person asked for that moment, and a reminder moved to 7:00 would arrive after the broadcast started. It still counts toward the limit of 2 and wins every tie.
- The limit is judged per local day over the whole day. What is already past counts as sent and is judged among itself first; the rest of the day fills the places that are left.
- `scheduleNext7Days` gives what the phone should hold. `firedSince` gives what has already fired; the inbox fills from it. Both come from the same `plan`.
- `lib/notifications/native.ts` is the only file that touches `expo-notifications`: Android channel `reminders`, schedule and cancel by id (`diffSchedule`), badge, tap handling. On the web preview every call is a no-op.
- `components/notifications/NotificationsHost.tsx` (mounted once in `app/_layout.tsx`) reschedules on start, when the app comes to the front, and when a setting, a live reminder, the word cards or the song list change. It never asks for permission.
- Permission is asked only when the person turns a reminder on in the settings screen, taps "Allow notifications" there, or sets their first live reminder. If the OS says no, the settings screen shows "Notifications are off in system settings" with an "Open settings" button.
- The inbox (`stores/notificationsStore.ts`) keeps fired items with their time, which are read, and which were deleted (so a deleted item does not come back). Items older than 30 days are dropped. "Today" and "Earlier" sections, "Mark all read", an X on each row, empty state "You're all caught up.".
- Settings (`stores/notificationSettingsStore.ts`, shape and migration in `lib/notifications/settings.ts`): master on; song 8:00 on; festivals on; words 18:00 on; streak off; live on; quiet hours 21:00 to 7:00.

Limits of phase 1: a notification is only scheduled while the app has run within the last 7 days (iOS and Android hold local notifications, the app has to refill them). The inbox shows what should have fired from the app's current data, so a words reminder that fired before the person reviewed is not reconstructed with its old count. There is no cross-device state. The "composed on this day" text needs a song date that the app does not have yet.

## Phase 2: server

Local stays for everything the phone can know alone (song of the day, words, streak, live reminders set on the phone). The server adds what the phone cannot know: team announcements, upload decisions, new stories, and live broadcasts that start without a reminder.

Tables:

```
notifications(id, kind, audience, payload, target, created_at, expires_at)
notification_reads(user_id, notification_id)
device_tokens(user_id, token, platform, locale, tz)
```

- `audience`: `all`, a group, or one user id. `payload` is the title and text per locale. `target` is an app route, the same routes the local kinds use.
- Scheduler job: every minute, pick notifications that are due, resolve the audience to device tokens, send through Expo push (APNs and FCM), skip a user who is over the daily limit or in quiet hours (use `tz`), and write nothing twice (idempotent by notification id and token).
- Admin broadcast: an admin screen creates an `announcement` with audience, text, target and expiry; it goes through the same job.
- Uploader-status triggers: when a Kiirtan changes to approved or rejected, create a `notifications` row with `kind = upload` for the uploader, with the copy from `serverKinds.ts`.
- The app lists unread items from `GET /notifications` (not expired, minus `notification_reads`) and merges them into the inbox by id, next to the local ones. Read state syncs through `notification_reads`.
- `device_tokens` is written only after the person has allowed notifications. Sign-out deletes the row.

## Privacy and rate limits

- Phase 1 sends nothing off the phone. Settings, the inbox, word cards and live reminders stay on the device.
- Phase 2 stores a device token, platform, locale and time zone per user, and nothing about what the person learns or plays. Targeting is by audience only, never by listening history.
- No sensitive text in a notification body: nothing about health, location, or private notes.
- Limits that both phases enforce: at most 2 a day per person, quiet hours respected (the server uses the stored time zone), priority live > festival > words > song > streak. A server notification takes a place in the same count.
- Permission is asked in context, never at first launch. Turning the master switch off cancels all scheduled notifications and, in phase 2, stops pushes for that device.
